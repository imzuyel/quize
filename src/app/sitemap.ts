import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, getSeo, resolveSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSeo();
  const base = resolveSiteUrl(seo);
  const now = new Date();

  // Only public pages belong in a sitemap — dashboards need a session.
  if (seo.noIndex) return [];

  return PUBLIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
