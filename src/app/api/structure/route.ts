import { db } from "@/db";
import { chapters, classes, sections, subjects, topics, trades } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { isAdmin, requireUser } from "@/lib/auth";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const TABLES = { classes, sections, trades, subjects, chapters, topics } as const;
type EntityKey = keyof typeof TABLES;

export async function GET() {
  return guard(async () =>
    ok({
      classes: await db.select().from(classes).orderBy(asc(classes.level)),
      sections: await db.select().from(sections).orderBy(asc(sections.name)),
      trades: await db.select().from(trades).orderBy(asc(trades.id)),
      subjects: await db.select().from(subjects).orderBy(asc(subjects.name)),
      chapters: await db.select().from(chapters).orderBy(asc(chapters.orderIndex)),
      topics: await db.select().from(topics).orderBy(asc(topics.id)),
    }),
  );
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (!isAdmin(user.role)) return fail("শুধুমাত্র অ্যাডমিন", 403);
    const body = (await req.json()) as {
      entity: EntityKey;
      op: "create" | "update" | "delete";
      id?: number;
      data?: Record<string, unknown>;
    };
    const table = TABLES[body.entity];
    if (!table) return fail("Unknown entity");

    if (body.op === "create") {
      const row = await db
        .insert(table)
        .values(body.data as never)
        .returning();
      return ok(row[0]);
    }
    if (body.op === "update") {
      if (!body.id) return fail("id required");
      const row = await db
        .update(table)
        .set(body.data as never)
        .where(eq(table.id, body.id))
        .returning();
      return ok(row[0]);
    }
    if (body.op === "delete") {
      if (!body.id) return fail("id required");
      await db.delete(table).where(eq(table.id, body.id));
      return ok({ ok: true });
    }
    return fail("Unknown op");
  });
}
