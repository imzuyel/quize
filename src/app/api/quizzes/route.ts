import { db } from "@/db";
import { questions, quizPresets, quizQuestions, quizSections, quizzes } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { isStaff, requireUser } from "@/lib/auth";
import { DEFAULT_SETTINGS, EXAM_SETTINGS, loadQuizQuestions } from "@/lib/live";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const rows = await db.select().from(quizzes).where(eq(quizzes.id, Number(id))).limit(1);
      const quiz = rows[0];
      if (!quiz) return fail("Not found", 404);
      const list = await loadQuizQuestions(quiz.id);
      const rounds = await db
        .select()
        .from(quizSections)
        .where(eq(quizSections.quizId, quiz.id))
        .orderBy(asc(quizSections.orderIndex));
      const isOwner = isStaff(user.role);
      return ok({
        quiz,
        rounds,
        questions: isOwner ? list : list.map(({ correct: _c, explanation: _e, ...rest }) => { void _c; void _e; return rest; }),
      });
    }
    const mode = url.searchParams.get("mode");
    const mine = url.searchParams.get("mine");
    const filters = [];
    if (mode) filters.push(eq(quizzes.mode, mode));
    if (mine === "1" && isStaff(user.role)) filters.push(eq(quizzes.createdBy, user.id));
    if (!isStaff(user.role)) filters.push(eq(quizzes.status, "published"));
    const rows = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        mode: quizzes.mode,
        status: quizzes.status,
        classId: quizzes.classId,
        durationMinutes: quizzes.durationMinutes,
        scheduledAt: quizzes.scheduledAt,
        createdBy: quizzes.createdBy,
        createdAt: quizzes.createdAt,
        settings: quizzes.settings,
        questionCount: sql<number>`(select count(*)::int from quiz_questions qq where qq.quiz_id = ${quizzes.id})`,
      })
      .from(quizzes)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(quizzes.id))
      .limit(200);
    const presets = await db.select().from(quizPresets).limit(50);
    return ok({ rows, presets });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (!isStaff(user.role)) return fail("Forbidden", 403);
    const body = (await req.json()) as {
      op: string;
      id?: number;
      data?: Record<string, unknown>;
      questionIds?: number[];
      order?: number[];
      sectionId?: number | null;
      name?: string;
      settings?: Record<string, unknown>;
      bundle?: unknown;
    };

    switch (body.op) {
      case "create": {
        const mode = String(body.data?.mode ?? "live");
        const row = await db
          .insert(quizzes)
          .values({
            title: String(body.data?.title ?? "নতুন কুইজ"),
            description: (body.data?.description as string) ?? "",
            mode,
            classId: (body.data?.classId as number) ?? null,
            tradeId: (body.data?.tradeId as number) ?? null,
            durationMinutes: (body.data?.durationMinutes as number) ?? 30,
            settings: (body.data?.settings as object) ?? (mode === "exam" ? EXAM_SETTINGS : DEFAULT_SETTINGS),
            createdBy: user.id,
            status: "draft",
          })
          .returning();
        if (body.questionIds?.length) {
          await db
            .insert(quizQuestions)
            .values(body.questionIds.map((qid, i) => ({ quizId: row[0].id, questionId: qid, orderIndex: i })));
        }
        return ok(row[0]);
      }
      case "update": {
        if (!body.id) return fail("id required");
        const row = await db
          .update(quizzes)
          .set(body.data as never)
          .where(eq(quizzes.id, body.id))
          .returning();
        return ok(row[0]);
      }
      case "delete": {
        if (!body.id) return fail("id required");
        await db.delete(quizQuestions).where(eq(quizQuestions.quizId, body.id));
        await db.delete(quizSections).where(eq(quizSections.quizId, body.id));
        await db.delete(quizzes).where(eq(quizzes.id, body.id));
        return ok({ ok: true });
      }
      case "duplicate": {
        if (!body.id) return fail("id required");
        const src = (await db.select().from(quizzes).where(eq(quizzes.id, body.id)).limit(1))[0];
        if (!src) return fail("Not found", 404);
        const copy = await db
          .insert(quizzes)
          .values({
            title: `${src.title} (কপি)`,
            description: src.description,
            mode: src.mode,
            classId: src.classId,
            tradeId: src.tradeId,
            settings: src.settings as object,
            durationMinutes: src.durationMinutes,
            createdBy: user.id,
            status: "draft",
          })
          .returning();
        const qq = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, src.id));
        if (qq.length)
          await db
            .insert(quizQuestions)
            .values(qq.map((q) => ({ quizId: copy[0].id, questionId: q.questionId, orderIndex: q.orderIndex, marks: q.marks, timer: q.timer })));
        return ok(copy[0]);
      }
      case "addQuestions": {
        if (!body.id || !body.questionIds?.length) return fail("id and questionIds required");
        const maxRow = await db
          .select({ m: sql<number>`coalesce(max(${quizQuestions.orderIndex}), -1)::int` })
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, body.id));
        let order = (maxRow[0]?.m ?? -1) + 1;
        await db.insert(quizQuestions).values(
          body.questionIds.map((qid) => ({
            quizId: body.id!,
            questionId: qid,
            orderIndex: order++,
            sectionId: body.sectionId ?? null,
          })),
        );
        await db
          .update(questions)
          .set({ usedCount: sql`${questions.usedCount} + 1` })
          .where(inArray(questions.id, body.questionIds));
        return ok({ ok: true });
      }
      case "removeQuestion": {
        if (!body.id || !body.questionIds?.length) return fail("params required");
        await db
          .delete(quizQuestions)
          .where(and(eq(quizQuestions.quizId, body.id), inArray(quizQuestions.questionId, body.questionIds)));
        return ok({ ok: true });
      }
      case "reorder": {
        if (!body.id || !body.order) return fail("params required");
        for (let i = 0; i < body.order.length; i++) {
          await db
            .update(quizQuestions)
            .set({ orderIndex: i })
            .where(and(eq(quizQuestions.quizId, body.id), eq(quizQuestions.questionId, body.order[i])));
        }
        return ok({ ok: true });
      }
      case "questionOverride": {
        if (!body.id || !body.questionIds?.length) return fail("params required");
        await db
          .update(quizQuestions)
          .set({ marks: (body.data?.marks as number) ?? null, timer: (body.data?.timer as number) ?? null })
          .where(and(eq(quizQuestions.quizId, body.id), eq(quizQuestions.questionId, body.questionIds[0])));
        return ok({ ok: true });
      }
      case "addRound": {
        if (!body.id) return fail("id required");
        const existing = await db.select().from(quizSections).where(eq(quizSections.quizId, body.id));
        const row = await db
          .insert(quizSections)
          .values({
            quizId: body.id,
            name: body.name ?? `রাউন্ড ${existing.length + 1}`,
            orderIndex: existing.length,
            settings: body.settings ?? {},
          })
          .returning();
        return ok(row[0]);
      }
      case "updateRound": {
        if (!body.id) return fail("id required");
        const row = await db
          .update(quizSections)
          .set({ name: body.name, settings: body.settings ?? {} })
          .where(eq(quizSections.id, body.id))
          .returning();
        return ok(row[0]);
      }
      case "deleteRound": {
        if (!body.id) return fail("id required");
        await db.delete(quizSections).where(eq(quizSections.id, body.id));
        return ok({ ok: true });
      }
      case "publish": {
        if (!body.id) return fail("id required");
        const row = await db
          .update(quizzes)
          .set({ status: "published" })
          .where(eq(quizzes.id, body.id))
          .returning();
        return ok(row[0]);
      }
      case "export": {
        if (!body.id) return fail("id required");
        const src = (await db.select().from(quizzes).where(eq(quizzes.id, body.id)).limit(1))[0];
        if (!src) return fail("Not found", 404);
        const list = await loadQuizQuestions(src.id);
        // Self-contained bundle: re-importable on any PGTSC install.
        return ok({
          format: "pgtsc-quiz",
          version: 1,
          exportedAt: new Date().toISOString(),
          quiz: {
            title: src.title,
            description: src.description,
            mode: src.mode,
            settings: src.settings,
            durationMinutes: src.durationMinutes,
          },
          questions: list.map((q) => ({
            text: q.text,
            type: q.type,
            options: q.options,
            correct: q.correct,
            explanation: q.explanation,
            hint: q.hint,
            marks: q.marks,
            timer: q.timer,
            difficulty: q.difficulty,
          })),
        });
      }

      case "import": {
        const bundle = body.bundle as {
          format?: string;
          quiz?: Record<string, unknown>;
          questions?: Record<string, unknown>[];
        };
        if (!bundle || bundle.format !== "pgtsc-quiz")
          return fail("ফাইলটি বৈধ PGTSC কুইজ ফাইল নয়");
        const rows = Array.isArray(bundle.questions) ? bundle.questions : [];
        if (!rows.length) return fail("ফাইলে কোনো প্রশ্ন নেই");
        if (rows.length > 2000) return fail("একবারে সর্বোচ্চ ২০০০টি প্রশ্ন");

        const created = await db
          .insert(quizzes)
          .values({
            title: String(bundle.quiz?.title ?? "আমদানিকৃত কুইজ"),
            description: String(bundle.quiz?.description ?? ""),
            mode: String(bundle.quiz?.mode ?? "live"),
            settings: (bundle.quiz?.settings as object) ?? DEFAULT_SETTINGS,
            durationMinutes: Number(bundle.quiz?.durationMinutes) || 30,
            createdBy: user.id,
            status: "draft",
          })
          .returning();

        const inserted = await db
          .insert(questions)
          .values(
            rows.map((q) => ({
              text: String(q.text ?? "").slice(0, 2000),
              type: String(q.type ?? "mcq"),
              options: Array.isArray(q.options) ? q.options : [],
              correct: Array.isArray(q.correct) ? q.correct : [0],
              explanation: q.explanation ? String(q.explanation) : null,
              hint: q.hint ? String(q.hint) : null,
              marks: Number(q.marks) || 1,
              timer: Math.max(5, Math.min(300, Number(q.timer) || 30)),
              difficulty: ["easy", "medium", "hard"].includes(String(q.difficulty))
                ? String(q.difficulty)
                : "medium",
              createdBy: user.id,
              source: "manual",
              status: "published",
            })),
          )
          .returning({ id: questions.id });

        await db
          .insert(quizQuestions)
          .values(inserted.map((q, i) => ({ quizId: created[0].id, questionId: q.id, orderIndex: i })));

        return ok({ id: created[0].id, imported: inserted.length });
      }

      case "savePreset": {
        const row = await db
          .insert(quizPresets)
          .values({ name: body.name ?? "নতুন প্রিসেট", settings: body.settings ?? {}, ownerId: user.id })
          .returning();
        return ok(row[0]);
      }
      case "deletePreset": {
        if (!body.id) return fail("id required");
        await db.delete(quizPresets).where(eq(quizPresets.id, body.id));
        return ok({ ok: true });
      }
      default:
        return fail("Unknown op");
    }
  });
}
