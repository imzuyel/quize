import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { isAdmin, isStaff, requireUser } from "@/lib/auth";
import { notificationPrefs } from "@/lib/prefs";
import { desc, eq, inArray, isNull, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(notifications)
      .where(or(eq(notifications.userId, user.id), isNull(notifications.userId)))
      .orderBy(desc(notifications.id))
      .limit(60);
    // Respect the reader's mute settings without deleting anything.
    const me = await db
      .select({ prefs: users.prefs })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const prefs = notificationPrefs(me[0]?.prefs);
    const visible = rows.filter((n) => {
      const kind = n.kind as keyof typeof prefs;
      return kind in prefs ? prefs[kind] : true;
    });
    return ok(visible.slice(0, 40));
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const op = String(body.op ?? "markAll");
    if (op === "markAll") {
      await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
      return ok({ ok: true });
    }
    if (op === "broadcast") {
      if (!isStaff(user.role)) return fail("Forbidden", 403);
      const audience = String(body.audience ?? "students");
      const targets = await db.select({ id: users.id, role: users.role }).from(users);
      const filtered = targets.filter((t) =>
        audience === "all"
          ? true
          : audience === "students"
            ? t.role === "student"
            : audience === "teachers"
              ? t.role === "teacher"
              : t.role === "parent",
      );
      if (!filtered.length) return fail("কোনো প্রাপক নেই");
      // Skip anyone who muted this notification kind.
      const kind = String(body.kind ?? "announcement");
      const prefRows = await db
        .select({ id: users.id, prefs: users.prefs })
        .from(users)
        .where(inArray(users.id, filtered.map((t) => t.id)));
      const muted = new Set(
        prefRows
          .filter((r) => {
            const p = notificationPrefs(r.prefs) as Record<string, boolean>;
            return kind in p && !p[kind];
          })
          .map((r) => r.id),
      );
      const recipients = filtered.filter((t) => !muted.has(t.id));
      if (!recipients.length) return fail("সব প্রাপক এই ধরনের নোটিফিকেশন বন্ধ রেখেছেন");
      await db.insert(notifications).values(
        recipients.map((t) => ({
          userId: t.id,
          title: String(body.title ?? "ঘোষণা"),
          body: String(body.body ?? ""),
          kind,
          link: (body.link as string) ?? null,
        })),
      );
      return ok({ sent: recipients.length, muted: muted.size });
    }
    if (op === "delete") {
      if (!isAdmin(user.role)) return fail("Forbidden", 403);
      await db.delete(notifications).where(eq(notifications.id, Number(body.id)));
      return ok({ ok: true });
    }
    return fail("Unknown op");
  });
}
