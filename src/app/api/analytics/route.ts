import { db } from "@/db";
import {
  achievements,
  classes,
  examAttempts,
  parentLinks,
  playerAnswers,
  questions,
  quizResults,
  quizSessions,
  quizzes,
  studentAchievements,
  subjects,
  users,
} from "@/db/schema";
import { guard, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { teachingInsights } from "@/lib/ai";
import { and, avg, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const scope = new URL(req.url).searchParams.get("scope") ?? "teacher";

    if (scope === "admin") {
      const [quizCount] = await db.select({ c: count() }).from(quizzes);
      const [examCount] = await db.select({ c: count() }).from(quizzes).where(eq(quizzes.mode, "exam"));
      const [teacherCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "teacher"));
      const [studentCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "student"));
      const [qCount] = await db.select({ c: count() }).from(questions);
      const [sessionCount] = await db.select({ c: count() }).from(quizSessions);
      const [avgScore] = await db.select({ a: avg(quizResults.score) }).from(quizResults);
      const popularSubjects = await db
        .select({ name: subjects.name, c: count() })
        .from(questions)
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .groupBy(subjects.name)
        .orderBy(desc(count()))
        .limit(8);
      const topClasses = await db
        .select({ name: classes.name, avg: avg(quizResults.accuracy) })
        .from(quizResults)
        .innerJoin(users, eq(users.id, quizResults.userId))
        .innerJoin(classes, eq(classes.id, users.classId))
        .groupBy(classes.name)
        .orderBy(desc(avg(quizResults.accuracy)))
        .limit(8);
      const activeTeachers = await db
        .select({ name: users.name, c: count() })
        .from(quizzes)
        .innerJoin(users, eq(users.id, quizzes.createdBy))
        .groupBy(users.name)
        .orderBy(desc(count()))
        .limit(8);
      return ok({
        totals: {
          quizzes: quizCount.c,
          exams: examCount.c,
          teachers: teacherCount.c,
          students: studentCount.c,
          questions: qCount.c,
          sessions: sessionCount.c,
          averageScore: Math.round(Number(avgScore.a ?? 0)),
        },
        popularSubjects: popularSubjects.map((r) => ({ label: r.name, value: r.c })),
        topClasses: topClasses.map((r) => ({ label: r.name, value: Math.round(Number(r.avg ?? 0)) })),
        activeTeachers: activeTeachers.map((r) => ({ label: r.name, value: r.c })),
      });
    }

    if (scope === "student" || scope === "parent") {
      const targetId =
        scope === "parent"
          ? Number(new URL(req.url).searchParams.get("studentId") ?? 0)
          : user.id;
      if (scope === "parent") {
        const links = await db.select().from(parentLinks).where(eq(parentLinks.parentId, user.id));
        const children = links.length
          ? await db
              .select({ id: users.id, name: users.name, classId: users.classId, xp: users.xp, level: users.level })
              .from(users)
              .where(inArray(users.id, links.map((l) => l.studentId)))
          : [];
        const childId = targetId || children[0]?.id;
        if (!childId) return ok({ children: [], results: [], summary: null });
        const results = await db
          .select({
            id: quizResults.id,
            score: quizResults.score,
            accuracy: quizResults.accuracy,
            rank: quizResults.rank,
            createdAt: quizResults.createdAt,
            breakdown: quizResults.subjectBreakdown,
            title: quizzes.title,
          })
          .from(quizResults)
          .innerJoin(quizzes, eq(quizzes.id, quizResults.quizId))
          .where(eq(quizResults.userId, childId))
          .orderBy(desc(quizResults.id))
          .limit(30);
        return ok({ children, childId, results });
      }

      const results = await db
        .select({
          id: quizResults.id,
          score: quizResults.score,
          accuracy: quizResults.accuracy,
          rank: quizResults.rank,
          createdAt: quizResults.createdAt,
          breakdown: quizResults.subjectBreakdown,
          quizId: quizResults.quizId,
          title: quizzes.title,
        })
        .from(quizResults)
        .innerJoin(quizzes, eq(quizzes.id, quizResults.quizId))
        .where(eq(quizResults.userId, user.id))
        .orderBy(desc(quizResults.id))
        .limit(40);
      const attempts = await db
        .select({ c: count() })
        .from(examAttempts)
        .where(and(eq(examAttempts.userId, user.id), eq(examAttempts.status, "submitted")));
      const earned = await db
        .select({
          id: achievements.id,
          name: achievements.name,
          nameBn: achievements.nameBn,
          icon: achievements.icon,
          xp: achievements.xp,
          earnedAt: studentAchievements.earnedAt,
        })
        .from(studentAchievements)
        .innerJoin(achievements, eq(achievements.id, studentAchievements.achievementId))
        .where(eq(studentAchievements.userId, user.id));
      const allAchievements = await db.select().from(achievements).where(eq(achievements.active, true));
      const rankRow = await db
        .select({ r: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "student"), sql`${users.xp} > ${user.xp}`));
      const subjectTotals: Record<string, { sum: number; n: number }> = {};
      for (const r of results) {
        for (const [k, v] of Object.entries((r.breakdown as Record<string, number>) ?? {})) {
          subjectTotals[k] = subjectTotals[k] ?? { sum: 0, n: 0 };
          subjectTotals[k].sum += Number(v);
          subjectTotals[k].n += 1;
        }
      }
      const subjectRows = await db.select().from(subjects);
      const subjectPerformance = Object.entries(subjectTotals).map(([k, v]) => ({
        label: subjectRows.find((s) => String(s.id) === k)?.name ?? k,
        value: Math.round(v.sum / Math.max(1, v.n)),
      }));
      return ok({
        results,
        completedExams: attempts[0]?.c ?? 0,
        achievements: earned,
        allAchievements,
        rank: (rankRow[0]?.r ?? 0) + 1,
        xp: user.xp,
        subjectPerformance,
        trend: results.slice(0, 12).reverse().map((r) => Number(r.accuracy)),
      });
    }

    /* teacher scope */
    const myQuizzes = await db
      .select({ id: quizzes.id, title: quizzes.title, mode: quizzes.mode, scheduledAt: quizzes.scheduledAt, status: quizzes.status })
      .from(quizzes)
      .where(eq(quizzes.createdBy, user.id))
      .orderBy(desc(quizzes.id))
      .limit(50);
    const quizIds = myQuizzes.map((q) => q.id);
    const results = quizIds.length
      ? await db
          .select({
            quizId: quizResults.quizId,
            score: quizResults.score,
            accuracy: quizResults.accuracy,
            playerName: quizResults.playerName,
            createdAt: quizResults.createdAt,
            breakdown: quizResults.subjectBreakdown,
          })
          .from(quizResults)
          .where(inArray(quizResults.quizId, quizIds))
          .orderBy(desc(quizResults.id))
          .limit(500)
      : [];
    const activeSessions = await db
      .select({ id: quizSessions.id, pin: quizSessions.pin, state: quizSessions.state, quizId: quizSessions.quizId })
      .from(quizSessions)
      .where(and(eq(quizSessions.hostId, user.id), isNull(quizSessions.endedAt)))
      .orderBy(desc(quizSessions.id))
      .limit(10);
    const hardest = await db
      .select({
        questionId: playerAnswers.questionId,
        text: questions.text,
        total: count(),
        correct: sql<number>`sum(case when ${playerAnswers.correct} then 1 else 0 end)::int`,
        avgMs: sql<number>`avg(${playerAnswers.responseMs})::int`,
      })
      .from(playerAnswers)
      .innerJoin(questions, eq(questions.id, playerAnswers.questionId))
      .groupBy(playerAnswers.questionId, questions.text)
      .orderBy(sql`sum(case when ${playerAnswers.correct} then 1 else 0 end)::float / count(*) asc`)
      .limit(8);
    const [studentCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "student"));
    const participants = new Set(results.map((r) => r.playerName)).size;
    const averageScore = results.length
      ? Math.round(results.reduce((s, r) => s + Number(r.score), 0) / results.length)
      : 0;
    const accuracy = results.length
      ? Math.round(results.reduce((s, r) => s + Number(r.accuracy), 0) / results.length)
      : 0;
    const subjectTotals: Record<string, { sum: number; n: number }> = {};
    for (const r of results) {
      for (const [k, v] of Object.entries((r.breakdown as Record<string, number>) ?? {})) {
        subjectTotals[k] = subjectTotals[k] ?? { sum: 0, n: 0 };
        subjectTotals[k].sum += Number(v);
        subjectTotals[k].n += 1;
      }
    }
    const subjectRows = await db.select().from(subjects);
    const subjectPerformance = Object.entries(subjectTotals).map(([k, v]) => ({
      label: subjectRows.find((s) => String(s.id) === k)?.name ?? k,
      value: Math.round(v.sum / Math.max(1, v.n)),
    }));
    const recentAnswers = await db
      .select({ avgMs: sql<number>`coalesce(avg(${playerAnswers.responseMs}),0)::int` })
      .from(playerAnswers)
      .where(gte(playerAnswers.createdAt, new Date(Date.now() - 30 * 86400000)));
    const participation = studentCount.c ? Math.round((participants / studentCount.c) * 100) : 0;
    const insights = await teachingInsights({
      averageScore,
      participation,
      accuracy,
      hardestQuestion: hardest[0]?.text,
    });

    return ok({
      quizzes: myQuizzes,
      totals: {
        quizzes: myQuizzes.length,
        results: results.length,
        averageScore,
        accuracy,
        participation,
        avgResponseMs: recentAnswers[0]?.avgMs ?? 0,
        activeSessions: activeSessions.length,
      },
      activeSessions,
      recentResults: results.slice(0, 12),
      hardestQuestions: hardest.map((h) => ({
        id: h.questionId,
        text: h.text,
        accuracy: Math.round((Number(h.correct) / Math.max(1, Number(h.total))) * 100),
        attempts: Number(h.total),
        avgMs: Number(h.avgMs),
      })),
      subjectPerformance,
      insights,
    });
  });
}
