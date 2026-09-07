/**
 * SEO types and pure helpers. No database imports, so client components
 * (like the admin settings form) can use these safely.
 */
export type SeoSettings = {
  siteName: string;
  siteNameEn: string;
  tagline: string;
  description: string;
  descriptionEn: string;
  keywords: string;
  siteUrl: string;
  logo: string;
  favicon: string;
  ogImage: string;
  themeColor: string;
  twitter: string;
  /** Blocks all crawlers — useful before launch. */
  noIndex: boolean;
  verification: { google?: string; bing?: string };
  /** Extra JSON-LD: address, phone, geo. */
  org: { address?: string; phone?: string; email?: string; foundingYear?: string };
};

export const DEFAULT_SEO: SeoSettings = {
  siteName: "পিজিটিএসসি কুইজ অ্যারেনা",
  siteNameEn: "PGTSC Quiz Arena",
  tagline: "প্রতিটি ক্লাসকে বানান ইন্টারেক্টিভ শেখার অভিজ্ঞতা",
  description:
    "এআই-চালিত কুইজ, লাইভ প্রতিযোগিতা, স্মার্ট পরীক্ষা, প্রেজেন্টেশন ও ব্যক্তিগত শেখা — সব এক প্ল্যাটফর্মে। পঞ্চগড় সরকারি টেকনিক্যাল স্কুল এন্ড কলেজ।",
  descriptionEn:
    "AI-powered quizzes, live competitions, smart exams, presentations and personalized learning — all in one platform for Panchagarh Government Technical School and College.",
  keywords:
    "কুইজ, অনলাইন পরীক্ষা, লাইভ কুইজ, এআই প্রশ্ন, পঞ্চগড় টেকনিক্যাল স্কুল, PGTSC, quiz platform, online exam Bangladesh, AI question generator",
  siteUrl: "",
  logo: "",
  favicon: "",
  ogImage: "",
  themeColor: "#0f2f4a",
  twitter: "",
  noIndex: false,
  verification: {},
  org: {
    address: "পঞ্চগড় সদর, পঞ্চগড় — ৫০০০, বাংলাদেশ",
    email: "info@pgtsc.edu.bd",
  },
};


export const SEO_KEY = "seo";

export function mergeSeo(raw: unknown, branding?: Record<string, unknown>): SeoSettings {
  const s = { ...DEFAULT_SEO, ...((raw as Partial<SeoSettings>) ?? {}) };
  // Fall back to the branding block so the two stay in sync by default.
  if (branding) {
    if (!s.siteName && branding.schoolName) s.siteName = String(branding.schoolName);
    if (!s.logo && branding.logo) s.logo = String(branding.logo);
    if (branding.primary && s.themeColor === DEFAULT_SEO.themeColor)
      s.themeColor = String(branding.primary);
  }
  return s;
}

/**
 * Resolves the public base URL. Explicit setting wins, then the platform's
 * own env var, then a safe localhost fallback for development.
 */
export function resolveSiteUrl(seo: SeoSettings): string {
  const raw =
    seo.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/** Pages that should appear in search results. Private dashboards stay out. */
export const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/join", priority: 0.7, changeFrequency: "monthly" },
  { path: "/login", priority: 0.5, changeFrequency: "monthly" },
];

/** JSON-LD describing the school + the software, for rich results. */
export function buildJsonLd(seo: SeoSettings, siteUrl: string) {
  const logo = seo.logo || `${siteUrl}/icon.svg`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: seo.siteNameEn || seo.siteName,
      alternateName: seo.siteName,
      url: siteUrl,
      logo,
      description: seo.descriptionEn || seo.description,
      ...(seo.org.email ? { email: seo.org.email } : {}),
      ...(seo.org.phone ? { telephone: seo.org.phone } : {}),
      ...(seo.org.address
        ? { address: { "@type": "PostalAddress", streetAddress: seo.org.address, addressCountry: "BD" } }
        : {}),
      ...(seo.org.foundingYear ? { foundingDate: seo.org.foundingYear } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: seo.siteName,
      url: siteUrl,
      inLanguage: ["bn", "en"],
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/join?pin={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: seo.siteNameEn || seo.siteName,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description: seo.descriptionEn || seo.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "BDT" },
      featureList: [
        "AI question generation",
        "Live multiplayer quizzes",
        "Formal online exams",
        "Presentation builder with PPTX export",
        "Item analysis and psychometrics",
      ],
    },
  ];
}
