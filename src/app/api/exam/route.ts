import { db } from "@/db";
import { examAnswers, examAttempts, questions, quizResults, quizzes, users } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { isAnswerCorrect, loadQuizQuestions, mergeSettings, type LiveQuestion } from "@/lib/live";
import { computeExamSeconds } from "@/lib/quiz-settings";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const attemptId = url.searchParams.get("attempt");
    if (attemptId) {
      const attempt = (
        await db.select().from(examAttempts).where(eq(examAttempts.id, Number(attemptId))).limit(1)
      )[0];
      if (!attempt || attempt.userId !== user.id) return fail("Not found", 404);
      const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).limit(1))[0];
      const all = await loadQuizQuestions(attempt.quizId);
      const order = attempt.order as number[];
      const ordered = order
        .map((id) => all.find((q) => q.id === id))
        .filter(Boolean) as LiveQuestion[];
      const saved = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attempt.id));
      const done = attempt.status !== "in_progress";
      return ok({
        attempt,
        quiz,
        settings: mergeSettings(quiz?.settings),
        questions: ordered.map((q) => ({
          ...q,
          correct: done || attempt.mode === "practice" ? q.correct : undefined,
          explanation: done || attempt.mode === "practice" ? q.explanation : null,
        })),
        answers: saved,
      });
    }
    const attempts = await db
      .select({
        id: examAttempts.id,
        quizId: examAttempts.quizId,
        score: examAttempts.score,
        maxScore: examAttempts.maxScore,
        status: examAttempts.status,
        mode: examAttempts.mode,
        submittedAt: examAttempts.submittedAt,
        title: quizzes.title,
      })
      .from(examAttempts)
      .innerJoin(quizzes, eq(quizzes.id, examAttempts.quizId))
      .where(eq(examAttempts.userId, user.id))
      .orderBy(desc(examAttempts.id))
      .limit(50);
    return ok({ attempts });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "start") {
      const quizId = Number(body.quizId);
      const mode = String(body.mode ?? "exam");
      const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1))[0];
      if (!quiz) return fail("Not found", 404);
      const settings = mergeSettings(quiz.settings);
      let list = await loadQuizQuestions(quizId);
      if (!list.length) return fail("এই কুইজে কোনো প্রশ্ন নেই");
      if (body.subjectId) {
        const sid = Number(body.subjectId);
        const filtered = list.filter((q) => q.subjectId === sid);
        if (filtered.length) list = filtered;
      }
      if (body.difficulty) {
        const filtered = list.filter((q) => q.difficulty === String(body.difficulty));
        if (filtered.length) list = filtered;
      }
      if (settings.randomQuestions || mode === "practice") list = shuffle(list);
      if (body.limit) list = list.slice(0, Math.max(1, Number(body.limit)));
      const existing = await db
        .select()
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.quizId, quizId),
            eq(examAttempts.userId, user.id),
            eq(examAttempts.status, "in_progress"),
          ),
        )
        .limit(1);
      if (existing[0] && mode === "exam") return ok({ attemptId: existing[0].id, resumed: true });
      // Time is derived from the questions themselves — more questions, more time.
      const totalSeconds = computeExamSeconds(list, settings);
      const attempt = (
        await db
          .insert(examAttempts)
          .values({
            quizId,
            userId: user.id,
            order: list.map((q) => q.id),
            endsAt: mode === "exam" ? new Date(Date.now() + totalSeconds * 1000) : null,
            maxScore: list.reduce((s, q) => s + q.marks, 0),
            mode,
          })
          .returning()
      )[0];
      return ok({ attemptId: attempt.id });
    }

    if (action === "save") {
      const attemptId = Number(body.attemptId);
      const attempt = (
        await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1)
      )[0];
      if (!attempt || attempt.userId !== user.id) return fail("Forbidden", 403);
      if (attempt.status !== "in_progress") return fail("এই অ্যাটেম্পট শেষ হয়ে গেছে");
      const questionId = Number(body.questionId);
      const q = (await db.select().from(questions).where(eq(questions.id, questionId)).limit(1))[0];
      if (!q) return fail("Not found", 404);
      const live: LiveQuestion = {
        id: q.id,
        index: 0,
        text: q.text,
        type: q.type,
        options: (q.options as string[]) ?? [],
        correct: (q.correct as (string | number)[]) ?? [],
        marks: q.marks,
        timer: q.timer,
        difficulty: q.difficulty,
        subjectId: q.subjectId,
        media: q.media,
        hint: q.hint,
        explanation: q.explanation,
      };
      const correct = isAnswerCorrect(live, body.answer);
      const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).limit(1))[0];
      const settings = mergeSettings(quiz?.settings);
      const points = correct ? q.marks : -Math.abs(settings.negativeMarking) * q.marks;
      await db
        .insert(examAnswers)
        .values({
          attemptId,
          questionId,
          answer: body.answer as object,
          correct,
          points,
          marked: Boolean(body.marked),
        })
        .onConflictDoUpdate({
          target: [examAnswers.attemptId, examAnswers.questionId],
          set: { answer: body.answer as object, correct, points, marked: Boolean(body.marked), updatedAt: new Date() },
        });
      const instant = attempt.mode === "practice";
      return ok({
        ok: true,
        ...(instant ? { correct, explanation: q.explanation, hint: q.hint, correctAnswer: q.correct } : {}),
      });
    }

    if (action === "mark") {
      const attemptId = Number(body.attemptId);
      const flags = (body.flags as number[]) ?? [];
      await db.update(examAttempts).set({ flags }).where(eq(examAttempts.id, attemptId));
      return ok({ ok: true });
    }

    if (action === "submit") {
      const attemptId = Number(body.attemptId);
      const attempt = (
        await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1)
      )[0];
      if (!attempt || attempt.userId !== user.id) return fail("Forbidden", 403);
      if (attempt.status !== "in_progress")
        return ok({ ok: true, score: attempt.score, maxScore: attempt.maxScore });
      const saved = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));
      const score = saved.reduce((s, a) => s + a.points, 0);
      const order = attempt.order as number[];
      const qRows = order.length
        ? await db.select().from(questions).where(inArray(questions.id, order))
        : [];
      const bySubject: Record<string, { c: number; t: number }> = {};
      for (const a of saved) {
        const q = qRows.find((x) => x.id === a.questionId);
        const key = String(q?.subjectId ?? "general");
        bySubject[key] = bySubject[key] ?? { c: 0, t: 0 };
        bySubject[key].t += 1;
        if (a.correct) bySubject[key].c += 1;
      }
      const breakdown: Record<string, number> = {};
      for (const [k, v] of Object.entries(bySubject))
        breakdown[k] = Math.round((v.c / Math.max(1, v.t)) * 100);
      await db
        .update(examAttempts)
        .set({ status: "submitted", submittedAt: new Date(), score })
        .where(eq(examAttempts.id, attemptId));
      const correctCount = saved.filter((a) => a.correct).length;
      const accuracy = order.length ? Math.round((correctCount / order.length) * 100) : 0;
      if (attempt.mode === "exam") {
        await db.insert(quizResults).values({
          quizId: attempt.quizId,
          userId: user.id,
          playerName: user.name,
          score: Math.max(0, score),
          accuracy,
          rank: 0,
          totalQuestions: order.length,
          correctCount,
          subjectBreakdown: breakdown,
        });
      }
      const { getFeatures } = await import("@/lib/features");
      if ((await getFeatures()).xpEnabled) {
        await db
          .update(users)
          .set({ xp: sql`${users.xp} + ${10 + correctCount * 2}` })
          .where(eq(users.id, user.id));
      }
      return ok({
        ok: true,
        score,
        maxScore: attempt.maxScore,
        accuracy,
        correctCount,
        total: order.length,
        breakdown,
      });
    }

    return fail("Unknown action");
  });
}
