import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Generates a readable but unguessable temporary password. */
export function generatePassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const MIN_PASSWORD_LENGTH = 8;
import { db } from "@/db";
import { sessionsTable, users } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

export type Role = "super_admin" | "admin" | "teacher" | "student" | "parent";

export const SESSION_COOKIE = "pgtsc_session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const derived = scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(key, "hex");
    if (keyBuf.length !== derived.length) return false;
    return timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  classId: number | null;
  sectionId: number | null;
  tradeId: number | null;
  studentId: string | null;
  xp: number;
  level: string;
  locale: string;
};

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await db.insert(sessionsTable).values({ token, userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    store.delete(SESSION_COOKIE);
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        classId: users.classId,
        sectionId: users.sectionId,
        tradeId: users.tradeId,
        studentId: users.studentId,
        xp: users.xp,
        level: users.level,
        locale: users.locale,
      })
      .from(sessionsTable)
      .innerJoin(users, eq(users.id, sessionsTable.userId))
      .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { ...row, role: row.role as Role } as SessionUser;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated", 401);
  return user;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("Forbidden", 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function isStaff(role: Role) {
  return role === "teacher" || role === "admin" || role === "super_admin";
}

export function isAdmin(role: Role) {
  return role === "admin" || role === "super_admin";
}
