import type { MetadataRoute } from "next";
import { getSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const seo = await getSeo();
  return {
    name: seo.siteName,
    short_name: "কুইজ অ্যারেনা",
    description: seo.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7fa",
    theme_color: seo.themeColor,
    lang: "bn",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "কুইজে যোগ দিন", url: "/join", description: "গেম পিন দিয়ে লাইভ কুইজে যোগদান" },
      { name: "এআই প্রশ্ন", url: "/teacher/ai", description: "এআই দিয়ে প্রশ্ন তৈরি" },
    ],
  };
}
