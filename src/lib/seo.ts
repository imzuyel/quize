/** Server-side SEO loader. Reads the admin-managed settings row. */
import { db } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_SEO, SEO_KEY, mergeSeo, type SeoSettings } from "./seo-config";

export * from "./seo-config";

const cache = globalThis as typeof globalThis & { __pgtscSeo?: { data: SeoSettings; at: number } };
// Short TTL: SEO changes are rare but should appear almost immediately.
// invalidateSeo() clears it instantly in the process that saved the change.
const TTL = 5_000;

export async function getSeo(force = false): Promise<SeoSettings> {
  const hit = cache.__pgtscSeo;
  if (!force && hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const rows = await db.select().from(settings);
    const seoRow = rows.find((r) => r.key === SEO_KEY)?.value;
    const branding = rows.find((r) => r.key === "branding")?.value as Record<string, unknown>;
    const data = mergeSeo(seoRow, branding);
    cache.__pgtscSeo = { data, at: Date.now() };
    return data;
  } catch {
    return DEFAULT_SEO;
  }
}

export function invalidateSeo() {
  cache.__pgtscSeo = undefined;
}
