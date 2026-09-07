import { ImageResponse } from "next/og";
import { getSeo } from "@/lib/seo";

export const alt = "PGTSC Quiz Arena";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

/** Social share card, generated from the school's own branding. */
export default async function Image() {
  const seo = await getSeo();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "linear-gradient(135deg, #071726 0%, #0f2f4a 55%, #0b3b46 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 22,
              background: "#0f7b6c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            PG
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{seo.siteName}</div>
            <div style={{ fontSize: 20, color: "rgba(255,255,255,.62)" }}>{seo.siteNameEn}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 980,
          }}
        >
          {seo.tagline}
        </div>

        <div style={{ marginTop: 26, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {["✨ এআই প্রশ্ন", "📡 লাইভ কুইজ", "📝 অনলাইন পরীক্ষা", "🎞️ প্রেজেন্টেশন"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 22,
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.2)",
              }}
            >
              {t}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 20,
            color: "rgba(255,255,255,.55)",
          }}
        >
          <div style={{ width: 46, height: 5, background: "#f0b429", borderRadius: 999 }} />
          {seo.org.address ?? ""}
        </div>
      </div>
    ),
    size,
  );
}
