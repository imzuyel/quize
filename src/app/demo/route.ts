import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, getCurrentUser } from "@/lib/auth";
import { demoSeedAllowed, seedDatabase } from "@/lib/seed";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HOME: Record<string, string> = {
  super_admin: "/admin",
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};

/**
 * Relative redirects avoid leaking the internal bind address (0.0.0.0) that an
 * absolute URL built from req.url would produce behind a proxy.
 */
function goto(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

/** Infer which role a destination path belongs to. */
function roleForPath(path: string): string {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/teacher") || path.startsWith("/host")) return "teacher";
  if (path.startsWith("/parent")) return "parent";
  return "student";
}

async function findUser(role: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, role), eq(users.active, true), eq(users.status, "approved")))
    .orderBy(asc(users.id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * One-click demo deep link:
 *   /demo?next=/teacher/ai   → signs in as the right role, lands on that page
 *   /demo?role=student       → signs in and goes to that dashboard
 * Self-healing: seeds the database on first use so a fresh deployment works
 * immediately instead of bouncing the visitor back to the home page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawNext = url.searchParams.get("next") ?? "";
  // Only allow internal paths — never redirect off-site.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";
  const role = url.searchParams.get("role") ?? roleForPath(next);

  if (process.env.DEMO_MODE === "false") return goto("/login");

  const wanted = ["super_admin", "admin", "teacher", "student", "parent"].includes(role)
    ? role
    : "student";
  const target = next || HOME[wanted] || "/student";

  const existing = await getCurrentUser();
  if (existing) {
    const ok =
      existing.role === wanted ||
      (wanted === "admin" && existing.role === "super_admin") ||
      !next;
    if (ok) return goto(target);
  }

  let user = await findUser(wanted);

  // Fresh database (or a reset one) — seed it now, then retry.
  if (!user && demoSeedAllowed()) {
    try {
      await seedDatabase();
    } catch (err) {
      console.error("[demo seed]", err);
    }
    user = await findUser(wanted);
  }

  if (!user) return goto("/?demo=unavailable");

  await createSession(user.id);
  return goto(target);
}
