import { db } from "@/db";
import { presentations } from "@/db/schema";
import { loadAiKeys } from "@/lib/ai-keys";
import { getFeatures } from "@/lib/features";
import { fail, guard, ok } from "@/lib/api";
import { isStaff, requireUser } from "@/lib/auth";
import { generateOutline } from "@/lib/ai";
import { newSlide, type Slide } from "@/lib/slides";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const row = (
        await db.select().from(presentations).where(eq(presentations.id, Number(id))).limit(1)
      )[0];
      if (!row) return fail("পাওয়া যায়নি", 404);
      return ok(row);
    }
    const rows = await db
      .select()
      .from(presentations)
      .where(eq(presentations.ownerId, user.id))
      .orderBy(desc(presentations.id))
      .limit(100);
    return ok({ rows });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    await loadAiKeys();
    const user = await requireUser();
    if (!isStaff(user.role)) return fail("Forbidden", 403);
    if (!(await getFeatures()).presentations)
      return fail("প্রেজেন্টেশন স্টুডিও বন্ধ আছে", 403);
    const body = (await req.json()) as Record<string, unknown>;
    const op = String(body.op ?? "");

    switch (op) {
      case "create": {
        const row = await db
          .insert(presentations)
          .values({
            title: String(body.title ?? "নতুন উপস্থাপনা"),
            description: String(body.description ?? ""),
            theme: String(body.theme ?? "aurora"),
            slides: (body.slides as object) ?? [newSlide("title"), newSlide("bullets")],
            ownerId: user.id,
          })
          .returning();
        return ok(row[0]);
      }
      case "update": {
        const id = Number(body.id);
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of ["title", "description", "theme", "slides", "visibility"])
          if (body[k] !== undefined) patch[k] = body[k];
        const row = await db
          .update(presentations)
          .set(patch)
          .where(eq(presentations.id, id))
          .returning();
        return ok(row[0]);
      }
      case "duplicate": {
        const src = (
          await db.select().from(presentations).where(eq(presentations.id, Number(body.id))).limit(1)
        )[0];
        if (!src) return fail("পাওয়া যায়নি", 404);
        const row = await db
          .insert(presentations)
          .values({
            title: `${src.title} (কপি)`,
            description: src.description,
            theme: src.theme,
            slides: src.slides as object,
            ownerId: user.id,
          })
          .returning();
        return ok(row[0]);
      }
      case "delete": {
        await db.delete(presentations).where(eq(presentations.id, Number(body.id)));
        return ok({ ok: true });
      }
      case "aiOutline": {
        const topic = String(body.topic ?? "").trim();
        if (!topic) return fail("বিষয় লিখুন");
        const count = Math.max(3, Math.min(30, Number(body.count) || 8));
        const slides = await generateOutline({
          topic,
          count,
          language: String(body.language ?? "bn"),
          audience: String(body.audience ?? ""),
        });
        if (!slides.length) return fail("আউটলাইন তৈরি করা যায়নি");

        if (body.id) {
          const target = (
            await db.select().from(presentations).where(eq(presentations.id, Number(body.id))).limit(1)
          )[0];
          if (!target) return fail("পাওয়া যায়নি", 404);
          const existing = (target.slides as Slide[]) ?? [];
          const merged = body.replace ? slides : [...existing, ...slides];
          await db
            .update(presentations)
            .set({ slides: merged, updatedAt: new Date() })
            .where(eq(presentations.id, target.id));
          return ok({ added: slides.length, slides: merged });
        }

        const row = await db
          .insert(presentations)
          .values({
            title: topic,
            theme: String(body.theme ?? "aurora"),
            slides,
            ownerId: user.id,
          })
          .returning();
        return ok(row[0]);
      }
      default:
        return fail("Unknown op");
    }
  });
}
