import { db } from "@/db";
import { notifications, settings, users } from "@/db/schema";
import {
  MIN_PASSWORD_LENGTH,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { fail, guard, ok } from "@/lib/api";
import { rateLimit } from "@/lib/realtime";
import { and, asc, eq, inArray, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => ok({ user: await getCurrentUser() }));
}

export async function POST(req: Request) {
  return guard(async () => {
    const body = (await req.json()) as {
      action: "login" | "logout" | "register" | "update" | "demo";
      identifier?: string;
      password?: string;
      name?: string;
      email?: string;
      role?: string;
      locale?: string;
    };

    if (body.action === "logout") {
      await destroySession();
      return ok({ ok: true });
    }

    if (body.action === "demo") {
      if (process.env.DEMO_MODE === "false")
        return fail("ডেমো মোড বন্ধ আছে — অ্যাডমিনের সাথে যোগাযোগ করুন", 403);
      const role = String(body.role ?? "student");
      if (!["super_admin", "admin", "teacher", "student", "parent"].includes(role))
        return fail("অজানা ভূমিকা");
      if (!rateLimit(`demo:${role}`, 30, 60_000))
        return fail("অনেকবার চেষ্টা হয়েছে, একটু পরে চেষ্টা করুন", 429);
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.role, role), eq(users.active, true), eq(users.status, "approved")))
        .orderBy(asc(users.id))
        .limit(1);
      const user = rows[0];
      if (!user) return fail("এই ভূমিকার কোনো ডেমো অ্যাকাউন্ট নেই", 404);
      await createSession(user.id);
      return ok({ ok: true, role: user.role, name: user.name });
    }

    if (body.action === "login") {
      const id = (body.identifier ?? "").trim();
      if (!rateLimit(`login:${id}`, 12, 60_000)) return fail("অনেকবার চেষ্টা হয়েছে, একটু পরে চেষ্টা করুন", 429);
      const rows = await db
        .select()
        .from(users)
        .where(or(eq(users.email, id.toLowerCase()), eq(users.studentId, id)))
        .limit(1);
      const user = rows[0];
      if (!user || !verifyPassword(body.password ?? "", user.passwordHash))
        return fail("ভুল তথ্য দেওয়া হয়েছে", 401);
      // Status is checked before the active flag so a rejected applicant sees
      // the reason instead of a generic "deactivated" message.
      if (user.status === "pending")
        return fail("আপনার অ্যাকাউন্ট এখনো অনুমোদনের অপেক্ষায় আছে। অ্যাডমিন অনুমোদন করলে লগইন করতে পারবেন।", 403);
      if (user.status === "rejected")
        return fail(
          user.rejectionNote
            ? `আবেদন প্রত্যাখ্যাত: ${user.rejectionNote}`
            : "আপনার আবেদন প্রত্যাখ্যাত হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।",
          403,
        );
      if (!user.active) return fail("অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে", 403);
      await createSession(user.id);
      return ok({ ok: true, role: user.role });
    }

    if (body.action === "register") {
      const email = (body.email ?? "").trim().toLowerCase();
      if (!email || !body.password || !body.name) return fail("সব ঘর পূরণ করুন");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("সঠিক ইমেইল দিন");
      if (body.password.length < MIN_PASSWORD_LENGTH)
        return fail(`পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে`);
      if (!rateLimit(`register:${email}`, 5, 60_000))
        return fail("অনেকবার চেষ্টা হয়েছে, একটু পরে চেষ্টা করুন", 429);
      const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (exists.length) return fail("এই ইমেইল আগে থেকেই আছে");
      const role = ["teacher", "student", "parent"].includes(body.role ?? "") ? body.role! : "student";

      // Staff-level sign-ups always need a human check; students/parents follow
      // the school-wide setting (default: approval required).
      const settingRow = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, "registration"))
        .limit(1);
      const cfg = (settingRow[0]?.value ?? {}) as { autoApproveStudents?: boolean };
      const needsApproval = role === "teacher" || cfg.autoApproveStudents !== true;
      const status = needsApproval ? "pending" : "approved";

      const inserted = await db
        .insert(users)
        .values({
          email,
          name: body.name,
          role,
          status,
          passwordHash: hashPassword(body.password),
        })
        .returning();

      if (needsApproval) {
        const admins = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.role, ["admin", "super_admin"]));
        if (admins.length) {
          await db.insert(notifications).values(
            admins.map((a) => ({
              userId: a.id,
              title: "নতুন অনুমোদনের আবেদন",
              body: `${body.name} (${role}) — ${email}`,
              kind: "approval",
              link: "/admin/users?tab=pending",
            })),
          );
        }
        return ok({
          ok: true,
          pending: true,
          message:
            "আবেদন জমা হয়েছে ✅ অ্যাডমিন অনুমোদন করার পর আপনি লগইন করতে পারবেন।",
        });
      }

      await createSession(inserted[0].id);
      return ok({ ok: true, role });
    }

    if (body.action === "update") {
      const current = await getCurrentUser();
      if (!current) return fail("Not authenticated", 401);
      await db.update(users).set({ locale: body.locale ?? current.locale }).where(eq(users.id, current.id));
      return ok({ ok: true });
    }

    return fail("Unknown action");
  });
}
