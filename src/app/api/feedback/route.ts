import { db } from "@/db";
import { feedback, questionReports, questions } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { getCurrentUser, isStaff, requireUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (!isStaff(user.role)) return fail("Forbidden", 403);
    const url = new URL(req.url);
    const quizId = url.searchParams.get("quizId");
    const rows = quizId
      ? await db.select().from(feedback).where(eq(feedback.quizId, Number(quizId))).orderBy(desc(feedback.id))
      : await db.select().from(feedback).orderBy(desc(feedback.id)).limit(200);
    const reports = await db
      .select({
        id: questionReports.id,
        questionId: questionReports.questionId,
        reason: questionReports.reason,
        detail: questionReports.detail,
        status: questionReports.status,
        reporterName: questionReports.reporterName,
        createdAt: questionReports.createdAt,
        questionText: questions.text,
      })
      .from(questionReports)
      .leftJoin(questions, eq(questions.id, questionReports.questionId))
      .orderBy(desc(questionReports.id))
      .limit(200);
    return ok({ feedback: rows, reports });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await getCurrentUser();
    const body = (await req.json()) as Record<string, unknown>;
    const op = String(body.op ?? "feedback");

    if (op === "feedback") {
      await db.insert(feedback).values({
        quizId: Number(body.quizId),
        sessionId: (body.sessionId as number) ?? null,
        userId: user?.id ?? null,
        playerName: (body.playerName as string) ?? user?.name ?? "Guest",
        overall: Number(body.overall ?? 5),
        difficulty: Number(body.difficulty ?? 3),
        timerRating: Number(body.timerRating ?? 3),
        quality: Number(body.quality ?? 5),
        engagement: Number(body.engagement ?? 5),
        comment: (body.comment as string) ?? null,
      });
      return ok({ ok: true });
    }

    if (op === "report") {
      await db.insert(questionReports).values({
        questionId: Number(body.questionId),
        quizId: (body.quizId as number) ?? null,
        reporterId: user?.id ?? null,
        reporterName: (body.playerName as string) ?? user?.name ?? "Guest",
        reason: String(body.reason ?? "other"),
        detail: (body.detail as string) ?? null,
      });
      return ok({ ok: true });
    }

    if (op === "resolveReport") {
      const me = await requireUser();
      if (!isStaff(me.role)) return fail("Forbidden", 403);
      await db
        .update(questionReports)
        .set({ status: String(body.status ?? "resolved") })
        .where(eq(questionReports.id, Number(body.id)));
      return ok({ ok: true });
    }

    return fail("Unknown op");
  });
}
