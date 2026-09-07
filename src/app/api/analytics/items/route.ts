import { db } from "@/db";
import { examAnswers, examAttempts, playerAnswers, questions, quizQuestions, quizzes } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { isStaff, requireUser } from "@/lib/auth";
import { analyseItems, reliability, type Response as ItemResponse } from "@/lib/psychometrics";
import { and, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Item analysis for one quiz, combining live-session answers and exam answers
 * so a paper used both ways is judged on all the evidence available.
 */
export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (!isStaff(user.role)) return fail("Forbidden", 403);
    const quizId = Number(new URL(req.url).searchParams.get("quizId"));
    if (!quizId) return fail("quizId required");

    const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1))[0];
    if (!quiz) return fail("কুইজ পাওয়া যায়নি", 404);

    const links = await db
      .select({ questionId: quizQuestions.questionId })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));
    const questionIds = links.map((l) => l.questionId);
    if (!questionIds.length) return ok({ quiz, items: [], reliability: null, questions: [] });

    const qRows = await db
      .select({
        id: questions.id,
        text: questions.text,
        type: questions.type,
        options: questions.options,
        correct: questions.correct,
        difficulty: questions.difficulty,
      })
      .from(questions)
      .where(inArray(questions.id, questionIds));

    const responses: ItemResponse[] = [];

    // Live sessions.
    const live = await db
      .select({
        playerId: playerAnswers.playerId,
        questionId: playerAnswers.questionId,
        correct: playerAnswers.correct,
        answer: playerAnswers.answer,
      })
      .from(playerAnswers)
      .where(inArray(playerAnswers.questionId, questionIds));
    for (const r of live) {
      const arr = r.answer as (string | number)[] | null;
      const first = Array.isArray(arr) && arr.length ? Number(arr[0]) : null;
      responses.push({
        playerId: r.playerId,
        questionId: r.questionId,
        correct: r.correct,
        choice: Number.isInteger(first) ? first : null,
      });
    }

    // Formal exam attempts. Offset the ids so they never collide with players.
    const attempts = await db
      .select({ id: examAttempts.id })
      .from(examAttempts)
      .where(and(eq(examAttempts.quizId, quizId), eq(examAttempts.status, "submitted")));
    if (attempts.length) {
      const answers = await db
        .select({
          attemptId: examAnswers.attemptId,
          questionId: examAnswers.questionId,
          correct: examAnswers.correct,
          answer: examAnswers.answer,
        })
        .from(examAnswers)
        .where(inArray(examAnswers.attemptId, attempts.map((a) => a.id)));
      for (const r of answers) {
        const arr = r.answer as (string | number)[] | null;
        const first = Array.isArray(arr) && arr.length ? Number(arr[0]) : null;
        responses.push({
          playerId: 1_000_000 + r.attemptId,
          questionId: r.questionId,
          correct: r.correct,
          choice: Number.isInteger(first) ? first : null,
        });
      }
    }

    const correctMap = new Map<number, number[]>(
      qRows.map((q) => [
        q.id,
        ((q.correct as (string | number)[]) ?? []).map(Number).filter(Number.isInteger),
      ]),
    );

    const items = analyseItems(responses, correctMap);
    const rel = reliability(responses);

    // Attach readable question text to each stat.
    const textById = new Map(qRows.map((q) => [q.id, q]));
    const enriched = items.map((it) => {
      const q = textById.get(it.questionId);
      return {
        ...it,
        text: q?.text ?? "",
        type: q?.type ?? "mcq",
        options: (q?.options as string[]) ?? [],
        taggedDifficulty: q?.difficulty ?? "medium",
      };
    });

    const learners = new Set(responses.map((r) => r.playerId)).size;

    return ok({
      quiz: { id: quiz.id, title: quiz.title },
      learners,
      totalResponses: responses.length,
      reliability: rel,
      items: enriched,
      summary: {
        excellent: enriched.filter((i) => i.verdict === "excellent").length,
        good: enriched.filter((i) => i.verdict === "good").length,
        review: enriched.filter((i) => i.verdict === "review").length,
        poor: enriched.filter((i) => i.verdict === "poor").length,
        insufficient: enriched.filter((i) => i.verdict === "insufficient").length,
      },
    });
  });
}
