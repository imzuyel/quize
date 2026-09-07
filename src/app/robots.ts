import type { MetadataRoute } from "next";
import { getSeo, resolveSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeo();
  const base = resolveSiteUrl(seo);

  // "Coming soon" mode: keep the whole site out of search results.
  if (seo.noIndex) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Dashboards, live sessions and APIs hold personal data — never index.
        disallow: [
          "/api/",
          "/teacher/",
          "/student/",
          "/parent/",
          "/admin/",
          "/host/",
          "/play/",
          "/present/",
          "/settings",
          "/certificate/",
          "/demo",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
