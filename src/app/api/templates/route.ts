import { db } from "@/db";
import { quizTemplates, templateFavorites } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { getCurrentUser, isStaff, requireUser } from "@/lib/auth";
import { and, desc, eq, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return guard(async () => {
    const user = await getCurrentUser();
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const filters = [];
    if (category && category !== "all") filters.push(eq(quizTemplates.category, category));
    if (user) {
      filters.push(
        or(
          eq(quizTemplates.visibility, "school"),
          eq(quizTemplates.visibility, "shared"),
          eq(quizTemplates.ownerId, user.id),
        )!,
      );
    } else {
      filters.push(eq(quizTemplates.visibility, "school"));
    }
    const rows = await db
      .select()
      .from(quizTemplates)
      .where(and(...filters))
      .orderBy(desc(quizTemplates.uses))
      .limit(200);
    const favs = user
      ? await db.select().from(templateFavorites).where(eq(templateFavorites.userId, user.id))
      : [];
    return ok({ rows, favorites: favs.map((f) => f.templateId) });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    const op = String(body.op ?? "");
    const id = Number(body.id ?? 0);

    if (op === "favorite") {
      const existing = await db
        .select()
        .from(templateFavorites)
        .where(and(eq(templateFavorites.userId, user.id), eq(templateFavorites.templateId, id)));
      if (existing.length) {
        await db
          .delete(templateFavorites)
          .where(and(eq(templateFavorites.userId, user.id), eq(templateFavorites.templateId, id)));
        return ok({ favorite: false });
      }
      await db.insert(templateFavorites).values({ userId: user.id, templateId: id });
      return ok({ favorite: true });
    }

    if (op === "use") {
      await db
        .update(quizTemplates)
        .set({ uses: sql`${quizTemplates.uses} + 1` })
        .where(eq(quizTemplates.id, id));
      return ok({ ok: true });
    }

    if (op === "rate") {
      const value = Math.max(1, Math.min(5, Number(body.rating ?? 5)));
      const row = (await db.select().from(quizTemplates).where(eq(quizTemplates.id, id)).limit(1))[0];
      if (!row) return fail("Not found", 404);
      const next = Number(((row.rating * 0.8 + value * 0.2)).toFixed(2));
      await db.update(quizTemplates).set({ rating: next }).where(eq(quizTemplates.id, id));
      return ok({ rating: next });
    }

    if (!isStaff(user.role)) return fail("Forbidden", 403);

    if (op === "create") {
      const row = await db
        .insert(quizTemplates)
        .values({
          name: String(body.name ?? "আমার টেমপ্লেট"),
          category: String(body.category ?? "academic"),
          config: (body.config as object) ?? {},
          visibility: String(body.visibility ?? "private"),
          ownerId: user.id,
        })
        .returning();
      return ok(row[0]);
    }
    if (op === "update") {
      const row = (await db.select().from(quizTemplates).where(eq(quizTemplates.id, id)).limit(1))[0];
      if (!row) return fail("Not found", 404);
      if (row.official && user.role === "teacher") return fail("অফিসিয়াল টেমপ্লেট লক করা আছে", 403);
      const updated = await db
        .update(quizTemplates)
        .set({
          name: body.name ? String(body.name) : row.name,
          category: body.category ? String(body.category) : row.category,
          config: (body.config as object) ?? (row.config as object),
          visibility: body.visibility ? String(body.visibility) : row.visibility,
        })
        .where(eq(quizTemplates.id, id))
        .returning();
      return ok(updated[0]);
    }
    if (op === "duplicate") {
      const row = (await db.select().from(quizTemplates).where(eq(quizTemplates.id, id)).limit(1))[0];
      if (!row) return fail("Not found", 404);
      const copy = await db
        .insert(quizTemplates)
        .values({
          name: `${row.name} (কপি)`,
          category: row.category,
          config: row.config as object,
          visibility: "private",
          ownerId: user.id,
        })
        .returning();
      return ok(copy[0]);
    }
    if (op === "delete") {
      const row = (await db.select().from(quizTemplates).where(eq(quizTemplates.id, id)).limit(1))[0];
      if (!row) return fail("Not found", 404);
      if (row.official) return fail("অফিসিয়াল টেমপ্লেট মুছা যাবে না", 403);
      if (row.ownerId !== user.id && user.role === "teacher") return fail("Forbidden", 403);
      await db.delete(quizTemplates).where(eq(quizTemplates.id, id));
      return ok({ ok: true });
    }
    return fail("Unknown op");
  });
}
