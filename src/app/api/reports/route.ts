import { db } from "@/db";
import { classes, quizResults, quizzes, subjects, users } from "@/db/schema";
import { guard, ok, toCsv } from "@/lib/api";
import { isStaff, requireUser } from "@/lib/auth";
import { avg, count, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "student";
    const format = url.searchParams.get("format") ?? "json";
    const id = url.searchParams.get("id");

    let rows: Record<string, unknown>[] = [];
    let title = "রিপোর্ট";

    if (type === "student") {
      const studentId = id ? Number(id) : user.id;
      if (studentId !== user.id && !isStaff(user.role)) return ok({ title, rows: [] });
      const data = await db
        .select({
          quiz: quizzes.title,
          mode: quizzes.mode,
          score: quizResults.score,
          accuracy: quizResults.accuracy,
          rank: quizResults.rank,
          correct: quizResults.correctCount,
          total: quizResults.totalQuestions,
          date: quizResults.createdAt,
        })
        .from(quizResults)
        .innerJoin(quizzes, eq(quizzes.id, quizResults.quizId))
        .where(eq(quizResults.userId, studentId))
        .orderBy(desc(quizResults.id));
      rows = data as unknown as Record<string, unknown>[];
      title = "শিক্ষার্থী রিপোর্ট";
    } else if (type === "quiz" || type === "exam") {
      const data = await db
        .select({
          student: quizResults.playerName,
          score: quizResults.score,
          accuracy: quizResults.accuracy,
          rank: quizResults.rank,
          correct: quizResults.correctCount,
          total: quizResults.totalQuestions,
          date: quizResults.createdAt,
        })
        .from(quizResults)
        .where(id ? eq(quizResults.quizId, Number(id)) : undefined)
        .orderBy(desc(quizResults.score))
        .limit(1000);
      rows = data as unknown as Record<string, unknown>[];
      title = type === "quiz" ? "কুইজ রিপোর্ট" : "পরীক্ষার রিপোর্ট";
    } else if (type === "class") {
      const data = await db
        .select({
          class: classes.name,
          students: count(),
          averageScore: avg(quizResults.score),
          averageAccuracy: avg(quizResults.accuracy),
        })
        .from(quizResults)
        .innerJoin(users, eq(users.id, quizResults.userId))
        .innerJoin(classes, eq(classes.id, users.classId))
        .groupBy(classes.name);
      rows = data.map((d) => ({
        class: d.class,
        students: d.students,
        averageScore: Math.round(Number(d.averageScore ?? 0)),
        averageAccuracy: Math.round(Number(d.averageAccuracy ?? 0)),
      }));
      title = "শ্রেণি রিপোর্ট";
    } else if (type === "subject") {
      const data = await db.select().from(subjects);
      const results = await db.select({ breakdown: quizResults.subjectBreakdown }).from(quizResults);
      const totals: Record<string, { sum: number; n: number }> = {};
      for (const r of results)
        for (const [k, v] of Object.entries((r.breakdown as Record<string, number>) ?? {})) {
          totals[k] = totals[k] ?? { sum: 0, n: 0 };
          totals[k].sum += Number(v);
          totals[k].n += 1;
        }
      rows = Object.entries(totals).map(([k, v]) => ({
        subject: data.find((s) => String(s.id) === k)?.name ?? k,
        averageScore: Math.round(v.sum / Math.max(1, v.n)),
        samples: v.n,
      }));
      title = "বিষয়ভিত্তিক রিপোর্ট";
    } else if (type === "teacher") {
      const data = await db
        .select({
          teacher: users.name,
          quizzes: count(),
        })
        .from(quizzes)
        .innerJoin(users, eq(users.id, quizzes.createdBy))
        .groupBy(users.name);
      rows = data as unknown as Record<string, unknown>[];
      title = "শিক্ষক রিপোর্ট";
    } else if (type === "school") {
      const [studentCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "student"));
      const [teacherCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "teacher"));
      const [quizCount] = await db.select({ c: count() }).from(quizzes);
      const [avgScore] = await db.select({ a: avg(quizResults.score) }).from(quizResults);
      rows = [
        { metric: "মোট শিক্ষার্থী", value: studentCount.c },
        { metric: "মোট শিক্ষক", value: teacherCount.c },
        { metric: "মোট কুইজ", value: quizCount.c },
        { metric: "গড় স্কোর", value: Math.round(Number(avgScore.a ?? 0)) },
      ];
      title = "স্কুল রিপোর্ট";
    } else if (type === "certificate") {
      const quizId = Number(id);
      const data = await db
        .select({
          student: quizResults.playerName,
          score: quizResults.score,
          rank: quizResults.rank,
          accuracy: quizResults.accuracy,
          date: quizResults.createdAt,
          quiz: quizzes.title,
        })
        .from(quizResults)
        .innerJoin(quizzes, eq(quizzes.id, quizResults.quizId))
        .where(eq(quizResults.quizId, quizId))
        .orderBy(sql`${quizResults.score} desc`)
        .limit(50);
      rows = data as unknown as Record<string, unknown>[];
      title = "সার্টিফিকেট তালিকা";
    }

    if (format === "csv") {
      return new Response("\uFEFF" + toCsv(rows), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename=${type}-report.csv`,
        },
      });
    }
    return ok({ title, rows });
  });
}
