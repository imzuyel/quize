import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { MIN_PASSWORD_LENGTH, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/realtime";
import { notificationPrefs, teacherDefaults, type UserPrefs } from "@/lib/prefs";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const me = await requireUser();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        nameBn: users.nameBn,
        email: users.email,
        studentId: users.studentId,
        roll: users.roll,
        role: users.role,
        avatar: users.avatar,
        locale: users.locale,
        motionLevel: users.motionLevel,
        prefs: users.prefs,
        xp: users.xp,
        level: users.level,
        classId: users.classId,
        sectionId: users.sectionId,
        tradeId: users.tradeId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1);
    if (!rows[0]) return fail("পাওয়া যায়নি", 404);
    const raw = rows[0].prefs as UserPrefs;
    return ok({
      ...rows[0],
      notifications: notificationPrefs(raw),
      teacherDefaults: teacherDefaults(raw),
    });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const me = await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    const op = String(body.op ?? "profile");

    if (op === "profile") {
      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string") {
        const name = body.name.trim();
        if (name.length < 2) return fail("নাম কমপক্ষে ২ অক্ষরের হতে হবে");
        patch.name = name.slice(0, 80);
      }
      if (typeof body.nameBn === "string") patch.nameBn = body.nameBn.trim().slice(0, 80);
      if (typeof body.avatar === "string") patch.avatar = body.avatar.trim().slice(0, 8);
      if (typeof body.locale === "string" && ["bn", "en"].includes(body.locale))
        patch.locale = body.locale;
      if (typeof body.motionLevel === "string" && ["low", "medium", "high"].includes(body.motionLevel))
        patch.motionLevel = body.motionLevel;
      if (!Object.keys(patch).length) return fail("পরিবর্তনের কিছু নেই");
      await db.update(users).set(patch).where(eq(users.id, me.id));
      return ok({ ok: true });
    }

    if (op === "prefs") {
      const rows = await db
        .select({ prefs: users.prefs })
        .from(users)
        .where(eq(users.id, me.id))
        .limit(1);
      const current = (rows[0]?.prefs ?? {}) as UserPrefs;
      const next: UserPrefs = { ...current };
      if (body.notifications && typeof body.notifications === "object")
        next.notifications = { ...current.notifications, ...(body.notifications as object) };
      if (body.teacher && typeof body.teacher === "object")
        next.teacher = { ...current.teacher, ...(body.teacher as object) };
      await db.update(users).set({ prefs: next }).where(eq(users.id, me.id));
      return ok({ ok: true, prefs: next });
    }

    if (op === "password") {
      if (!rateLimit(`pw:${me.id}`, 6, 60_000))
        return fail("অনেকবার চেষ্টা হয়েছে, একটু পরে চেষ্টা করুন", 429);
      const current = String(body.current ?? "");
      const next = String(body.next ?? "");
      if (next.length < MIN_PASSWORD_LENGTH)
        return fail(`নতুন পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে`);

      const rows = await db
        .select({ hash: users.passwordHash })
        .from(users)
        .where(eq(users.id, me.id))
        .limit(1);
      if (!rows[0]) return fail("পাওয়া যায়নি", 404);
      // Always require the old password — a stolen session must not be enough
      // to lock the real owner out.
      if (!verifyPassword(current, rows[0].hash)) return fail("বর্তমান পাসওয়ার্ড ভুল");
      if (verifyPassword(next, rows[0].hash)) return fail("নতুন পাসওয়ার্ড আগেরটির মতোই");

      await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, me.id));
      return ok({ ok: true });
    }

    return fail("Unknown op");
  });
}
