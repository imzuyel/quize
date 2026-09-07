/** Server-only reader for school-wide feature flags (cached briefly). */
import { db } from "@/db";
import { settings } from "@/db/schema";
import { mergeFeatures, type FeatureFlags } from "./prefs";
import { eq } from "drizzle-orm";

const globalForFeatures = globalThis as typeof globalThis & {
  __pgtscFeatures?: { data: FeatureFlags; at: number };
};

const TTL_MS = 15_000;

export async function getFeatures(force = false): Promise<FeatureFlags> {
  const cached = globalForFeatures.__pgtscFeatures;
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "features"))
      .limit(1);
    const data = mergeFeatures(rows[0]?.value);
    globalForFeatures.__pgtscFeatures = { data, at: Date.now() };
    return data;
  } catch {
    return mergeFeatures(null);
  }
}

export function invalidateFeatures() {
  globalForFeatures.__pgtscFeatures = undefined;
}
