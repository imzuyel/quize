import { db } from "@/db";
import { classes, quizResults, quizzes, users } from "@/db/schema";
import { guard, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { and, avg, count, desc, eq, gte, sql, sum } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * School-wide rankings. Supports several boards so a class that rewards
 * consistency isn't forced to rank purely on raw score.
 */
export async function GET(req: Request) {
  return guard(async () => {
    const me = await requireUser();
    const url = new URL(req.url);
    const metric = url.searchParams.get("metric") ?? "score";
    const scope = url.searchParams.get("scope") ?? "all";
    const classId = url.searchParams.get("classId");
    const period = url.searchParams.get("period") ?? "all";
    const limit = Math.min(100, Math.max(5, Number(url.searchParams.get("limit") ?? 50)));

    const filters = [eq(users.role, "student")];
    if (classId) filters.push(eq(users.classId, Number(classId)));
    // "My class" board for students who just want to see their own group.
    if (scope === "class" && me.classId) filters.push(eq(users.classId, me.classId));
    if (period !== "all") {
      const days = period === "week" ? 7 : period === "month" ? 30 : 365;
      filters.push(gte(quizResults.createdAt, new Date(Date.now() - days * 86400000)));
    }

    const rows = await db
      .select({
        userId: users.id,
        name: users.name,
        nameBn: users.nameBn,
        avatar: users.avatar,
        classId: users.classId,
        className: classes.name,
        xp: users.xp,
        level: users.level,
        totalScore: sum(quizResults.score),
        avgAccuracy: avg(quizResults.accuracy),
        quizzes: count(quizResults.id),
        bestScore: sql<number>`coalesce(max(${quizResults.score}), 0)::float`,
        wins: sql<number>`sum(case when ${quizResults.rank} = 1 then 1 else 0 end)::int`,
        podiums: sql<number>`sum(case when ${quizResults.rank} between 1 and 3 then 1 else 0 end)::int`,
      })
      .from(quizResults)
      .innerJoin(users, eq(users.id, quizResults.userId))
      .leftJoin(classes, eq(classes.id, users.classId))
      .where(and(...filters))
      .groupBy(users.id, users.name, users.nameBn, users.avatar, users.classId, classes.name, users.xp, users.level)
      .limit(300);

    const shaped = rows.map((r) => {
      const totalScore = Number(r.totalScore ?? 0);
      const accuracy = Number(r.avgAccuracy ?? 0);
      const attempts = Number(r.quizzes ?? 0);
      return {
        userId: r.userId,
        name: r.nameBn || r.name,
        avatar: r.avatar || "🙂",
        className: r.className ?? "—",
        xp: r.xp,
        level: r.level,
        totalScore: Math.round(totalScore),
        avgScore: attempts ? Math.round(totalScore / attempts) : 0,
        accuracy: Math.round(accuracy),
        quizzes: attempts,
        bestScore: Math.round(Number(r.bestScore ?? 0)),
        wins: Number(r.wins ?? 0),
        podiums: Number(r.podiums ?? 0),
      };
    });

    const sorters: Record<string, (a: typeof shaped[0], b: typeof shaped[0]) => number> = {
      score: (a, b) => b.totalScore - a.totalScore,
      average: (a, b) => b.avgScore - a.avgScore,
      accuracy: (a, b) => b.accuracy - a.accuracy || b.quizzes - a.quizzes,
      xp: (a, b) => b.xp - a.xp,
      wins: (a, b) => b.wins - a.wins || b.podiums - a.podiums,
      active: (a, b) => b.quizzes - a.quizzes,
    };
    const sorted = [...shaped].sort(sorters[metric] ?? sorters.score);

    // Dense ranking so ties share a position.
    const valueOf = (r: typeof shaped[0]) =>
      metric === "average" ? r.avgScore
      : metric === "accuracy" ? r.accuracy
      : metric === "xp" ? r.xp
      : metric === "wins" ? r.wins
      : metric === "active" ? r.quizzes
      : r.totalScore;

    let rank = 0;
    let prev: number | null = null;
    const ranked = sorted.map((r, i) => {
      const v = valueOf(r);
      if (prev === null || v !== prev) rank = i + 1;
      prev = v;
      return { ...r, rank, value: v };
    });

    const meRow = ranked.find((r) => r.userId === me.id) ?? null;

    // Top classes, so a whole section can be celebrated too.
    const classBoard = await db
      .select({
        classId: users.classId,
        className: classes.name,
        students: sql<number>`count(distinct ${users.id})::int`,
        avgAccuracy: avg(quizResults.accuracy),
        totalScore: sum(quizResults.score),
      })
      .from(quizResults)
      .innerJoin(users, eq(users.id, quizResults.userId))
      .innerJoin(classes, eq(classes.id, users.classId))
      .groupBy(users.classId, classes.name)
      .orderBy(desc(avg(quizResults.accuracy)))
      .limit(10);

    return ok({
      metric,
      period,
      scope,
      rows: ranked.slice(0, limit),
      me: meRow,
      totalRanked: ranked.length,
      classes: classBoard.map((c) => ({
        classId: c.classId,
        name: c.className,
        students: Number(c.students ?? 0),
        accuracy: Math.round(Number(c.avgAccuracy ?? 0)),
        totalScore: Math.round(Number(c.totalScore ?? 0)),
      })),
    });
  });
}

/** Per-quiz result table — "who scored what" for a single quiz. */
export async function POST(req: Request) {
  return guard(async () => {
    await requireUser();
    const body = (await req.json()) as { quizId?: number };
    const quizId = Number(body.quizId);
    if (!quizId) return ok({ rows: [] });

    const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1))[0];
    const rows = await db
      .select({
        id: quizResults.id,
        userId: quizResults.userId,
        playerName: quizResults.playerName,
        score: quizResults.score,
        accuracy: quizResults.accuracy,
        correctCount: quizResults.correctCount,
        totalQuestions: quizResults.totalQuestions,
        createdAt: quizResults.createdAt,
        avatar: users.avatar,
        className: classes.name,
      })
      .from(quizResults)
      .leftJoin(users, eq(users.id, quizResults.userId))
      .leftJoin(classes, eq(classes.id, users.classId))
      .where(eq(quizResults.quizId, quizId))
      .orderBy(desc(quizResults.score))
      .limit(300);

    return ok({
      quiz: quiz ? { id: quiz.id, title: quiz.title } : null,
      rows: rows.map((r, i) => ({
        ...r,
        rank: i + 1,
        score: Math.round(r.score),
        accuracy: Math.round(r.accuracy),
        avatar: r.avatar || "🙂",
        className: r.className ?? "—",
      })),
    });
  });
}
