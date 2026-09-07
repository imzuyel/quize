import { db } from "@/db";
import {
  playerAnswers,
  questions,
  quizQuestions,
  quizSessions,
  quizTemplates,
  quizzes,
  sessionPlayers,
  sessionTeams,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
  mergeSettings,
  type LiveQuestion,
  type Snapshot,
} from "./quiz-settings";

export {
  DEFAULT_SETTINGS,
  EXAM_SETTINGS,
  mergeSettings,
  isAnswerCorrect,
  computePoints,
  generatePin,
} from "./quiz-settings";
export type { QuizSettings, LiveQuestion, Snapshot } from "./quiz-settings";

export async function loadQuizQuestions(quizId: number): Promise<LiveQuestion[]> {
  const rows = await db
    .select({
      id: questions.id,
      text: questions.text,
      type: questions.type,
      options: questions.options,
      correct: questions.correct,
      marks: quizQuestions.marks,
      qmarks: questions.marks,
      timer: quizQuestions.timer,
      qtimer: questions.timer,
      difficulty: questions.difficulty,
      subjectId: questions.subjectId,
      media: questions.media,
      hint: questions.hint,
      explanation: questions.explanation,
      order: quizQuestions.orderIndex,
    })
    .from(quizQuestions)
    .innerJoin(questions, eq(questions.id, quizQuestions.questionId))
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.orderIndex));

  return rows.map((r, i) => ({
    id: r.id,
    index: i,
    text: r.text,
    type: r.type,
    options: (r.options as string[]) ?? [],
    correct: (r.correct as (string | number)[]) ?? [],
    marks: r.marks ?? r.qmarks ?? 1,
    timer: r.timer ?? r.qtimer ?? 30,
    difficulty: r.difficulty,
    subjectId: r.subjectId,
    media: r.media,
    hint: r.hint,
    explanation: r.explanation,
  }));
}

export async function getSessionByPin(pin: string) {
  const rows = await db.select().from(quizSessions).where(eq(quizSessions.pin, pin)).limit(1);
  return rows[0] ?? null;
}

/**
 * Server-authoritative auto-reveal.
 *
 * When a question's deadline passes we move the session to `answer_reveal`
 * ourselves instead of waiting for the teacher to press a button. Every client
 * therefore flips to the result at the same moment, and the teacher stays in
 * control of when the NEXT question begins.
 *
 * Returns true when the state actually changed.
 */
export async function autoAdvanceIfExpired(sessionId: number): Promise<boolean> {
  const rows = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).limit(1);
  const session = rows[0];
  if (!session) return false;
  if (session.state !== "question_active") return false;
  if (session.pausedAt) return false; // teacher paused — freeze the clock
  if (!session.questionEndsAt) return false;

  // Small grace window so an answer sent right on the buzzer still counts.
  if (Date.now() < session.questionEndsAt.getTime() + 600) return false;

  await db
    .update(quizSessions)
    .set({ state: "answer_reveal", version: session.version + 1 })
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.state, "question_active")));
  return true;
}

export async function buildSnapshot(pin: string): Promise<Snapshot | null> {
  const session0 = await getSessionByPin(pin);
  if (session0) await autoAdvanceIfExpired(session0.id);
  const session = await getSessionByPin(pin);
  if (!session) return null;
  const quizRows = await db.select().from(quizzes).where(eq(quizzes.id, session.quizId)).limit(1);
  const quiz = quizRows[0];
  if (!quiz) return null;
  const settings = mergeSettings(quiz.settings);
  const qs = await loadQuizQuestions(quiz.id);
  const current = qs[session.currentIndex] ?? null;
  const revealed = ["answer_reveal", "score_update", "leaderboard", "quiz_complete"].includes(
    session.state,
  );
  const players = await db
    .select()
    .from(sessionPlayers)
    .where(and(eq(sessionPlayers.sessionId, session.id), eq(sessionPlayers.removed, false)));
  const teams = await db.select().from(sessionTeams).where(eq(sessionTeams.sessionId, session.id));
  // Current-question answers power the tally and per-player reveal outcome.
  const answers = await db
    .select()
    .from(playerAnswers)
    .where(
      and(eq(playerAnswers.sessionId, session.id), eq(playerAnswers.questionIndex, session.currentIndex)),
    );
  const tally = new Array<number>(current?.options.length ?? 0).fill(0);
  const outcomes: Record<number, { correct: boolean; points: number; answer: (string | number)[] }> = {};
  for (const a of answers) {
    const picked = (a.answer as (string | number)[]) ?? [];
    outcomes[a.playerId] = { correct: a.correct, points: a.points, answer: picked };
    for (const v of picked) {
      const idx = Number(v);
      if (Number.isInteger(idx) && idx >= 0 && idx < tally.length) tally[idx] += 1;
    }
  }

  let theme: unknown = null;
  if (settings.templateId) {
    const t = await db
      .select({ config: quizTemplates.config })
      .from(quizTemplates)
      .where(eq(quizTemplates.id, settings.templateId))
      .limit(1);
    theme = t[0]?.config ?? null;
  }

  return {
    session: {
      id: session.id,
      pin: session.pin,
      state: session.state,
      currentIndex: session.currentIndex,
      total: qs.length,
      lobbyLocked: session.lobbyLocked,
      showLeaderboard: session.showLeaderboard,
      teamMode: session.teamMode,
      endsAt: session.questionEndsAt ? session.questionEndsAt.toISOString() : null,
      startedAt: session.questionStartedAt ? session.questionStartedAt.toISOString() : null,
      paused: Boolean(session.pausedAt),
      version: session.version,
    },
    quiz: { id: quiz.id, title: quiz.title, description: quiz.description, settings },
    theme,
    question: current
      ? {
          ...current,
          correct: revealed ? current.correct : undefined,
          explanation: revealed ? current.explanation : null,
          hint: current.hint,
          revealed,
        }
      : null,
    players: players
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
        correctCount: p.correctCount,
        answeredCount: p.answeredCount,
        teamId: p.teamId,
        connected: p.connected,
      }))
      .sort((a, b) => b.score - a.score),
    teams: teams.map((t) => ({ id: t.id, name: t.name, color: t.color, icon: t.icon, score: t.score })),
    // Counts stay hidden until reveal so nobody can infer the answer early.
    tally: revealed ? tally : [],
    answeredCount: answers.length,
    answeredBy: answers.map((a) => a.playerId),
    // Correctness stays hidden until the reveal so nobody can peek early.
    outcomes: revealed ? outcomes : {},
  };
}
