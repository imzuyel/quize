/**
 * Server-only bridge between the `settings` table and the AI layer.
 *
 * Kept separate from `lib/ai.ts` because that module is also imported by
 * client components (for QUESTION_TYPES etc.) and must never pull in `pg`.
 */
import { db } from "@/db";
import { settings } from "@/db/schema";
import { setKeyOverrides } from "./ai";
import { eq } from "drizzle-orm";

export const AI_SETTINGS_KEY = "ai_keys";

export type AiKeySettings = {
  gemini?: string;
  groq?: string;
  openai?: string;
  anthropic?: string;
  provider?: string;
  model?: string;
};

const globalForCache = globalThis as typeof globalThis & { __pgtscAiKeysAt?: number };
const TTL_MS = 15_000;

/** Loads saved keys into the AI layer. Cheap thanks to a short TTL cache. */
export async function loadAiKeys(force = false): Promise<AiKeySettings> {
  const last = globalForCache.__pgtscAiKeysAt ?? 0;
  if (!force && Date.now() - last < TTL_MS) return {};
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, AI_SETTINGS_KEY))
      .limit(1);
    const data = (rows[0]?.value ?? {}) as AiKeySettings;
    setKeyOverrides(data);
    globalForCache.__pgtscAiKeysAt = Date.now();
    return data;
  } catch {
    return {};
  }
}

export async function saveAiKeys(data: AiKeySettings) {
  await db
    .insert(settings)
    .values({ key: AI_SETTINGS_KEY, value: data })
    .onConflictDoUpdate({ target: settings.key, set: { value: data, updatedAt: new Date() } });
  setKeyOverrides(data);
  globalForCache.__pgtscAiKeysAt = Date.now();
}

export async function readAiKeys(): Promise<AiKeySettings> {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, AI_SETTINGS_KEY))
    .limit(1);
  return (rows[0]?.value ?? {}) as AiKeySettings;
}

/** Shows only the last few characters so a key is recognisable but not leaked. */
export function maskKey(key?: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
