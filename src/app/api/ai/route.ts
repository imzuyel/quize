import { db } from "@/db";
import { aiJobs, aiResults, documents, questions, quizQuestions, quizResults, quizzes } from "@/db/schema";
import { loadAiKeys } from "@/lib/ai-keys";
import { getFeatures } from "@/lib/features";
import { DEFAULT_SETTINGS, EXAM_SETTINGS } from "@/lib/quiz-settings";
import { fail, guard, ok } from "@/lib/api";
import { isStaff, requireUser } from "@/lib/auth";
import {
  generateQuestions,
  generateTemplate,
  getProviderInfo,
  qualityCheck,
  smartQuizPlan,
  summarizeFeedback,
  teachingInsights,
  transformQuestion,
  type GenerateParams,
  type GeneratedQuestion,
} from "@/lib/ai";
import { detectOutline, extractDocument, pagesToText } from "@/lib/pdf";
import { parseQuestions } from "@/lib/parse-questions";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runJob(jobId: number, params: GenerateParams) {
  const info = getProviderInfo();
  // Free tiers cap requests per minute, so keep batches large (fewer calls)
  // and pace them instead of firing back-to-back.
  const freeTier = info.provider === "gemini" || info.provider === "groq";
  const batchSize = freeTier ? 25 : params.count > 200 ? 50 : 25;
  const pacingMs = freeTier ? 4500 : 0;
  const all: GeneratedQuestion[] = [];
  try {
    await db.update(aiJobs).set({ status: "running" }).where(eq(aiJobs.id, jobId));
    let done = 0;
    let batchIndex = 0;
    while (done < params.count) {
      if (pacingMs && batchIndex > 0) await new Promise((r) => setTimeout(r, pacingMs));
      batchIndex += 1;
      const size = Math.min(batchSize, params.count - done);
      const batch = await generateQuestions({ ...params, count: size });
      const offset = done;
      await db.insert(aiResults).values(
        batch.map((payload, i) => ({
          jobId,
          payload,
          flags: qualityCheck(payload, [...all, ...batch]),
          orderIndex: offset + i,
        })),
      );
      all.push(...batch);
      done += size;
      await db
        .update(aiJobs)
        .set({ completed: done, progress: Math.round((done / params.count) * 100) })
        .where(eq(aiJobs.id, jobId));
    }
    const flagged = all.map((q) => qualityCheck(q, all));
    const errors = flagged.filter((f) => f.some((x) => x.severity === "error")).length;
    const warns = flagged.filter((f) => f.some((x) => x.severity === "warn")).length;
    await db
      .update(aiJobs)
      .set({
        status: "completed",
        progress: 100,
        finishedAt: new Date(),
        validation: { total: all.length, errors, warnings: warns, clean: all.length - errors - warns },
      })
      .where(eq(aiJobs.id, jobId));
  } catch (err) {
    await db
      .update(aiJobs)
      .set({ status: "failed", error: err instanceof Error ? err.message : "unknown", finishedAt: new Date() })
      .where(eq(aiJobs.id, jobId));
  }
}

export async function GET(req: Request) {
  return guard(async () => {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job");
    if (jobId) {
      const job = (await db.select().from(aiJobs).where(eq(aiJobs.id, Number(jobId))).limit(1))[0];
      if (!job) return fail("Not found", 404);
      const results =
        url.searchParams.get("results") === "1"
          ? await db
              .select()
              .from(aiResults)
              .where(eq(aiResults.jobId, job.id))
              .orderBy(asc(aiResults.orderIndex))
          : [];
      return ok({ job, results });
    }
    const user = await requireUser();
    await loadAiKeys();
    if (url.searchParams.get("documents") === "1") {
      const docs = await db
        .select({
          id: documents.id,
          name: documents.name,
          pageCount: documents.pageCount,
          chars: documents.chars,
          method: documents.method,
          outline: documents.outline,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(eq(documents.userId, user.id))
        .orderBy(desc(documents.id))
        .limit(30);
      return ok({ documents: docs });
    }
    const jobs = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.userId, user.id))
      .orderBy(sql`${aiJobs.id} desc`)
      .limit(20);
    return ok({ provider: getProviderInfo(), jobs });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    await loadAiKeys();
    const user = await requireUser();
    const contentType = req.headers.get("content-type") ?? "";

    /* -------- document upload: extract pages, detect chapters -------- */
    if (contentType.includes("multipart/form-data")) {
      if (!isStaff(user.role)) return fail("Forbidden", 403);
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return fail("ফাইল দিন");
      if (file.size > 40 * 1024 * 1024) return fail("ফাইলটি অনেক বড় (সর্বোচ্চ ৪০MB)");
      const buffer = Buffer.from(await file.arrayBuffer());
      const doc = await extractDocument(file.name, buffer);
      if (doc.chars < 60)
        return fail(
          "ফাইল থেকে টেক্সট পড়া যায়নি। সম্ভবত এটি স্ক্যান করা ছবি-ভিত্তিক PDF — টেক্সট-সহ PDF বা TXT ব্যবহার করুন।",
        );
      const outline = detectOutline(doc.pages);
      const row = (
        await db
          .insert(documents)
          .values({
            userId: user.id,
            name: file.name,
            kind: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "text",
            pageCount: doc.pageCount,
            chars: doc.chars,
            method: doc.method,
            pages: doc.pages,
            outline,
          })
          .returning({ id: documents.id })
      )[0];
      return ok({
        documentId: row.id,
        name: file.name,
        pageCount: doc.pageCount,
        chars: doc.chars,
        method: doc.method,
        outline,
        preview: doc.pages.slice(0, 3).map((p) => p.slice(0, 320)),
      });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    switch (action) {
      case "generate": {
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        if (!(await getFeatures()).aiGeneration)
          return fail("এআই প্রশ্ন তৈরি বন্ধ আছে — অ্যাডমিনের সাথে যোগাযোগ করুন", 403);
        const params = body.params as GenerateParams;
        params.count = Math.max(1, Math.min(2000, Number(params.count) || 10));
        // Pasted study material is capped so a huge paste cannot stall the job.
        if (params.documentText) params.documentText = String(params.documentText).slice(0, 60000);
        const job = (
          await db
            .insert(aiJobs)
            .values({
              userId: user.id,
              kind: "questions",
              total: params.count,
              provider: getProviderInfo().provider,
              params: { ...params, documentText: params.documentText ? "(pasted text)" : undefined } as object,
            })
            .returning()
        )[0];
        void runJob(job.id, params);
        return ok({ jobId: job.id });
      }
      case "quickGenerate": {
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        const quizId = Number(body.quizId);
        if (!quizId) return fail("quizId required");
        const p = (body.params ?? {}) as Partial<GenerateParams>;
        const count = Math.max(1, Math.min(50, Number(p.count) || 5));
        const params: GenerateParams = {
          count,
          language: (p.language as "bn") ?? "bn",
          types: (p.types?.length ? p.types : ["mcq"]) as GenerateParams["types"],
          difficulty: (p.difficulty as GenerateParams["difficulty"]) ?? "medium",
          marks: Number(p.marks) || 1,
          timer: Number(p.timer) || 30,
          withExplanation: p.withExplanation !== false,
          withHint: p.withHint !== false,
          topic: p.topic,
          documentText: p.documentText,
        };
        const generated = await generateQuestions(params);
        if (!generated.length) return fail("প্রশ্ন তৈরি করা যায়নি");

        const inserted = await db
          .insert(questions)
          .values(
            generated.map((q) => ({
              text: q.text,
              type: q.type,
              options: q.options,
              correct: q.correct,
              explanation: q.explanation,
              hint: q.hint,
              objective: q.objective,
              difficulty: q.difficulty,
              marks: q.marks,
              timer: q.timer,
              language: q.language,
              createdBy: user.id,
              source: "ai",
              status: "published",
            })),
          )
          .returning({ id: questions.id });

        const maxRow = await db
          .select({ m: sql<number>`coalesce(max(${quizQuestions.orderIndex}), -1)::int` })
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, quizId));
        let order = (maxRow[0]?.m ?? -1) + 1;
        await db
          .insert(quizQuestions)
          .values(inserted.map((q) => ({ quizId, questionId: q.id, orderIndex: order++ })));

        return ok({ added: inserted.length, provider: getProviderInfo().provider });
      }
      case "importPasted": {
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        const raw = String(body.text ?? "");
        if (raw.trim().length < 5) return fail("প্রশ্ন পেস্ট করুন");
        const d = (body.defaults ?? {}) as Record<string, unknown>;
        const report = parseQuestions(raw, {
          difficulty: (d.difficulty as "medium") ?? "medium",
          marks: Number(d.marks) || 1,
          timer: Number(d.timer) || 30,
          language: (d.language as string) ?? "bn",
        });
        if (!report.questions.length)
          return fail("কোনো প্রশ্ন শনাক্ত করা যায়নি — ফরম্যাট দেখে আবার চেষ্টা করুন");
        const job = (
          await db
            .insert(aiJobs)
            .values({
              userId: user.id,
              kind: "import",
              status: "completed",
              progress: 100,
              total: report.questions.length,
              completed: report.questions.length,
              provider: "paste",
              params: { source: "paste", format: report.format },
              finishedAt: new Date(),
            })
            .returning()
        )[0];
        const flagged = report.questions.map((q) => qualityCheck(q as GeneratedQuestion, report.questions as GeneratedQuestion[]));
        await db.insert(aiResults).values(
          report.questions.map((payload, i) => ({
            jobId: job.id,
            payload,
            flags: flagged[i],
            orderIndex: i,
          })),
        );
        await db
          .update(aiJobs)
          .set({
            validation: {
              total: report.questions.length,
              errors: flagged.filter((f) => f.some((x) => x.severity === "error")).length,
              warnings: flagged.filter((f) => f.some((x) => x.severity === "warn")).length,
              clean: flagged.filter((f) => !f.some((x) => x.severity !== "info")).length,
            },
          })
          .where(eq(aiJobs.id, job.id));
        return ok({
          jobId: job.id,
          imported: report.questions.length,
          skipped: report.skipped,
          format: report.format,
          warnings: report.warnings,
        });
      }
      case "generateFromDoc": {
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        const docId = Number(body.documentId);
        const row = (await db.select().from(documents).where(eq(documents.id, docId)).limit(1))[0];
        if (!row) return fail("ডকুমেন্ট পাওয়া যায়নি", 404);
        const pages = (row.pages as string[]) ?? [];
        const from = Math.max(1, Number(body.pageFrom ?? 1));
        const to = Math.min(pages.length, Number(body.pageTo ?? pages.length));
        if (to < from) return fail("পেজ রেঞ্জ সঠিক নয়");
        const text = pagesToText(pages, from, to);
        if (text.trim().length < 60)
          return fail("এই পেজ রেঞ্জে যথেষ্ট টেক্সট নেই — অন্য রেঞ্জ বেছে নিন");
        const p = (body.params ?? {}) as Partial<GenerateParams>;
        const params: GenerateParams = {
          count: Math.max(1, Math.min(2000, Number(p.count) || 10)),
          language: (p.language as "bn") ?? "bn",
          types: (p.types?.length ? p.types : ["mcq"]) as GenerateParams["types"],
          difficulty: (p.difficulty as GenerateParams["difficulty"]) ?? "medium",
          distribution: p.distribution,
          marks: Number(p.marks) || 1,
          timer: Number(p.timer) || 30,
          withExplanation: p.withExplanation !== false,
          withHint: p.withHint !== false,
          objective: p.objective,
          subject: p.subject,
          chapter: String(body.chapterLabel ?? p.chapter ?? ""),
          topic: p.topic || String(body.chapterLabel ?? row.name),
          className: p.className,
          documentText: text,
        };
        const job = (
          await db
            .insert(aiJobs)
            .values({
              userId: user.id,
              kind: "document",
              total: params.count,
              provider: getProviderInfo().provider,
              params: {
                ...params,
                documentText: undefined,
                fileName: row.name,
                pageFrom: from,
                pageTo: to,
              },
            })
            .returning()
        )[0];
        void runJob(job.id, params);
        return ok({ jobId: job.id, pagesUsed: to - from + 1, chars: text.length });
      }
      case "transform": {
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        const resultId = Number(body.resultId);
        const row = (await db.select().from(aiResults).where(eq(aiResults.id, resultId)).limit(1))[0];
        if (!row) return fail("Not found", 404);
        const next = await transformQuestion(
          row.payload as GeneratedQuestion,
          body.mode as "improve",
        );
        const updated = await db
          .update(aiResults)
          .set({ payload: next, flags: qualityCheck(next, [next]) })
          .where(eq(aiResults.id, resultId))
          .returning();
        return ok(updated[0]);
      }
      case "updateResult": {
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        const resultId = Number(body.resultId);
        const payload = body.payload as GeneratedQuestion;
        const updated = await db
          .update(aiResults)
          .set({ payload, flags: qualityCheck(payload, [payload]) })
          .where(eq(aiResults.id, resultId))
          .returning();
        return ok(updated[0]);
      }
      case "deleteResult": {
        await db.delete(aiResults).where(eq(aiResults.id, Number(body.resultId)));
        return ok({ ok: true });
      }
      case "duplicateResult": {
        const row = (await db.select().from(aiResults).where(eq(aiResults.id, Number(body.resultId))).limit(1))[0];
        if (!row) return fail("Not found", 404);
        const copy = await db
          .insert(aiResults)
          .values({ jobId: row.jobId, payload: row.payload as object, flags: row.flags as object, orderIndex: row.orderIndex + 1 })
          .returning();
        return ok(copy[0]);
      }
      case "publishToQuiz": {
        // Publish reviewed questions AND attach them to a quiz in one step,
        // so a teacher never has to leave the review screen.
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        const jobId = Number(body.jobId);
        const ids = (body.resultIds as number[]) ?? [];
        const rows = await db
          .select()
          .from(aiResults)
          .where(and(eq(aiResults.jobId, jobId), eq(aiResults.approved, false)));
        const chosen = ids.length ? rows.filter((r) => ids.includes(r.id)) : rows;
        if (!chosen.length) return fail("প্রকাশের মতো কোনো প্রশ্ন নেই");

        const meta = (body.meta ?? {}) as Record<string, number | null>;
        const inserted = await db
          .insert(questions)
          .values(
            chosen.map((r) => {
              const p = r.payload as GeneratedQuestion;
              return {
                text: p.text,
                type: p.type,
                options: p.options,
                correct: p.correct,
                explanation: p.explanation,
                hint: p.hint,
                objective: p.objective,
                difficulty: p.difficulty,
                marks: p.marks,
                timer: p.timer,
                language: p.language,
                classId: meta?.classId ?? null,
                subjectId: meta?.subjectId ?? null,
                createdBy: user.id,
                source: "ai",
                status: "published",
              };
            }),
          )
          .returning({ id: questions.id });

        for (let i = 0; i < chosen.length; i++) {
          await db
            .update(aiResults)
            .set({ approved: true, questionId: inserted[i]?.id })
            .where(eq(aiResults.id, chosen[i].id));
        }

        let quizId = Number(body.quizId) || 0;
        let created = false;

        if (!quizId) {
          const mode = String(body.mode ?? "live");
          const row = await db
            .insert(quizzes)
            .values({
              title: String(body.title ?? "নতুন কুইজ").slice(0, 160),
              description: String(body.description ?? ""),
              mode,
              settings: mode === "exam" ? EXAM_SETTINGS : DEFAULT_SETTINGS,
              createdBy: user.id,
              status: "draft",
            })
            .returning();
          quizId = row[0].id;
          created = true;
        } else {
          // Guard against attaching to someone else's quiz.
          const owner = (
            await db.select({ createdBy: quizzes.createdBy }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
          )[0];
          if (!owner) return fail("কুইজ পাওয়া যায়নি", 404);
          if (owner.createdBy !== user.id && user.role === "teacher")
            return fail("এই কুইজে যোগ করার অনুমতি নেই", 403);
        }

        const maxRow = await db
          .select({ m: sql<number>`coalesce(max(${quizQuestions.orderIndex}), -1)::int` })
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, quizId));
        let order = (maxRow[0]?.m ?? -1) + 1;
        await db
          .insert(quizQuestions)
          .values(inserted.map((q) => ({ quizId, questionId: q.id, orderIndex: order++ })));

        return ok({ quizId, created, added: inserted.length });
      }

      case "publish": {
        if (!isStaff(user.role)) return fail("Forbidden", 403);
        const jobId = Number(body.jobId);
        const ids = (body.resultIds as number[]) ?? [];
        const rows = await db
          .select()
          .from(aiResults)
          .where(and(eq(aiResults.jobId, jobId), eq(aiResults.approved, false)));
        const chosen = ids.length ? rows.filter((r) => ids.includes(r.id)) : rows;
        if (!chosen.length) return fail("প্রকাশের মতো কোনো প্রশ্ন নেই");
        const meta = body.meta as Record<string, number | null>;
        const inserted = await db
          .insert(questions)
          .values(
            chosen.map((r) => {
              const p = r.payload as GeneratedQuestion;
              return {
                text: p.text,
                type: p.type,
                options: p.options,
                correct: p.correct,
                explanation: p.explanation,
                hint: p.hint,
                objective: p.objective,
                difficulty: p.difficulty,
                marks: p.marks,
                timer: p.timer,
                language: p.language,
                classId: meta?.classId ?? null,
                tradeId: meta?.tradeId ?? null,
                subjectId: meta?.subjectId ?? null,
                chapterId: meta?.chapterId ?? null,
                topicId: meta?.topicId ?? null,
                createdBy: user.id,
                source: "ai",
                status: "published",
              };
            }),
          )
          .returning({ id: questions.id });
        for (let i = 0; i < chosen.length; i++) {
          await db
            .update(aiResults)
            .set({ approved: true, questionId: inserted[i]?.id })
            .where(eq(aiResults.id, chosen[i].id));
        }
        return ok({ published: inserted.length, questionIds: inserted.map((q) => q.id) });
      }
      case "template": {
        const config = await generateTemplate(String(body.prompt ?? ""));
        return ok(config);
      }
      case "plan": {
        const plan = await smartQuizPlan(String(body.prompt ?? ""));
        return ok(plan);
      }
      case "insights": {
        const insights = await teachingInsights((body.stats as Record<string, unknown>) ?? {});
        return ok({ insights });
      }
      case "feedbackAnalysis": {
        const items = (body.items as { overall: number; difficulty: number; timerRating: number; quality: number; engagement: number; comment?: string }[]) ?? [];
        return ok(await summarizeFeedback(items));
      }
      case "practicePlan": {
        const rows = await db
          .select({ subjectBreakdown: quizResults.subjectBreakdown, accuracy: quizResults.accuracy })
          .from(quizResults)
          .where(eq(quizResults.userId, user.id))
          .limit(50);
        const totals: Record<string, { sum: number; n: number }> = {};
        for (const r of rows) {
          const b = (r.subjectBreakdown as Record<string, number>) ?? {};
          for (const [k, v] of Object.entries(b)) {
            totals[k] = totals[k] ?? { sum: 0, n: 0 };
            totals[k].sum += Number(v);
            totals[k].n += 1;
          }
        }
        const weak = Object.entries(totals)
          .map(([k, v]) => ({ subject: k, score: Math.round(v.sum / Math.max(1, v.n)) }))
          .sort((a, b) => a.score - b.score);
        return ok({
          weak: weak.slice(0, 3),
          strong: weak.slice(-2).reverse(),
          message: weak.length
            ? `আপনার "${weak[0].subject}" বিষয়ে আরও অনুশীলন প্রয়োজন (${weak[0].score}%)।`
            : "আরও কুইজ দিন যাতে আমরা আপনার দুর্বল টপিক শনাক্ত করতে পারি।",
        });
      }
      default:
        return fail("Unknown action");
    }
  });
}
