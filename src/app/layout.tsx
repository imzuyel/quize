import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { buildJsonLd, getSeo, resolveSiteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo();
  const base = resolveSiteUrl(seo);
  const title = `${seo.siteName} | ${seo.siteNameEn}`;

  return {
    metadataBase: new URL(base),
    title: {
      default: title,
      // Sub-pages get "Page — Site Name" automatically.
      template: `%s — ${seo.siteName}`,
    },
    description: seo.description,
    keywords: seo.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    applicationName: seo.siteName,
    generator: "Next.js",
    referrer: "origin-when-cross-origin",
    authors: [{ name: "Md. Juyel Rana", url: "https://imzuyel.top" }],
    creator: "Md. Juyel Rana",
    publisher: seo.siteNameEn,
    formatDetection: { telephone: false, address: false, email: false },
    alternates: {
      canonical: "/",
      languages: { "bn-BD": "/", "en-US": "/" },
    },
    openGraph: {
      type: "website",
      locale: "bn_BD",
      alternateLocale: ["en_US"],
      url: base,
      siteName: seo.siteName,
      title,
      description: seo.description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: seo.description,
      ...(seo.twitter ? { creator: seo.twitter, site: seo.twitter } : {}),
    },
    robots: seo.noIndex
      ? { index: false, follow: false, nocache: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    ...(seo.verification.google || seo.verification.bing
      ? {
          verification: {
            ...(seo.verification.google ? { google: seo.verification.google } : {}),
            ...(seo.verification.bing ? { other: { "msvalidate.01": seo.verification.bing } } : {}),
          },
        }
      : {}),
    manifest: "/manifest.webmanifest",
    category: "education",
  };
}

export async function generateViewport(): Promise<Viewport> {
  const seo = await getSeo();
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: seo.themeColor,
    colorScheme: "light",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const seo = await getSeo();
  const jsonLd = buildJsonLd(seo, resolveSiteUrl(seo));

  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;800&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Structured data helps Google show a rich result for the school. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
