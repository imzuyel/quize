import { db } from "@/db";
import { presentations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getTheme, type Slide } from "@/lib/slides";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const W = 13.333; // 16:9 inches
const H = 7.5;

/** Strip the leading "#" so pptxgenjs gets a plain hex string. */
function hex(c: string, fallback = "FFFFFF") {
  const m = /#?([0-9a-fA-F]{6})/.exec(c ?? "");
  return m ? m[1].toUpperCase() : fallback;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!id) return new Response("id required", { status: 400 });

    const row = (
      await db.select().from(presentations).where(eq(presentations.id, id)).limit(1)
    )[0];
    if (!row) return new Response("Not found", { status: 404 });
    if (row.ownerId && row.ownerId !== user.id && row.visibility === "private")
      return new Response("Forbidden", { status: 403 });

    const slides = (row.slides as Slide[]) ?? [];
    const t = getTheme(row.theme);

    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    pptx.author = "PGTSC Quiz Arena";
    pptx.title = row.title;

    const text = hex(t.text);
    const muted = hex(t.dark ? "#cbd5e1" : "#475569");
    const primary = hex(t.primary);
    const accent = hex(t.accent);

    for (const s of slides) {
      const slide = pptx.addSlide();
      slide.background = { color: t.bgSolid };

      // Accent bar keeps every slide visually anchored.
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.16, h: H, fill: { color: primary },
      });

      const iconTxt = s.icon ? `${s.icon}  ` : "";

      if (s.layout === "title" || s.layout === "section" || s.layout === "closing") {
        slide.addText(`${iconTxt}${s.title ?? ""}`, {
          x: 1, y: H / 2 - 1.3, w: W - 2, h: 1.6,
          fontSize: s.layout === "title" ? 44 : 38,
          bold: true, color: text, align: "center", fontFace: "Arial",
        });
        if (s.subtitle)
          slide.addText(s.subtitle, {
            x: 1, y: H / 2 + 0.35, w: W - 2, h: 0.8,
            fontSize: 18, color: muted, align: "center", fontFace: "Arial",
          });
        slide.addShape(pptx.ShapeType.rect, {
          x: W / 2 - 0.8, y: H / 2 + 1.25, w: 1.6, h: 0.06, fill: { color: accent },
        });
      } else if (s.layout === "quote") {
        slide.addText(`"${s.title ?? ""}"`, {
          x: 1.2, y: 2.2, w: W - 2.4, h: 2.2,
          fontSize: 30, italic: true, bold: true, color: text, align: "center", fontFace: "Arial",
        });
        if (s.subtitle)
          slide.addText(s.subtitle, {
            x: 1.2, y: 4.5, w: W - 2.4, h: 0.6,
            fontSize: 16, color: accent, align: "center", fontFace: "Arial",
          });
      } else if (s.layout === "big_number") {
        slide.addText(s.title ?? "", {
          x: 1, y: 2.1, w: W - 2, h: 2,
          fontSize: 88, bold: true, color: accent, align: "center", fontFace: "Arial",
        });
        if (s.subtitle)
          slide.addText(s.subtitle, {
            x: 1, y: 4.2, w: W - 2, h: 0.8,
            fontSize: 20, color: muted, align: "center", fontFace: "Arial",
          });
      } else {
        slide.addText(`${iconTxt}${s.title ?? ""}`, {
          x: 0.7, y: 0.55, w: W - 1.4, h: 1,
          fontSize: 32, bold: true, color: text, fontFace: "Arial",
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.72, y: 1.5, w: 1.5, h: 0.05, fill: { color: accent },
        });

        const bullets = (s.bullets ?? []).filter(Boolean);
        if (bullets.length) {
          const two = s.layout === "two_column" || s.layout === "comparison";
          if (two) {
            const half = Math.ceil(bullets.length / 2);
            const cols = [bullets.slice(0, half), bullets.slice(half)];
            cols.forEach((col, ci) => {
              if (!col.length) return;
              slide.addText(
                col.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
                {
                  x: ci === 0 ? 0.8 : W / 2 + 0.2, y: 1.9,
                  w: W / 2 - 1.1, h: H - 2.6,
                  fontSize: 17, color: text, lineSpacingMultiple: 1.4, fontFace: "Arial",
                },
              );
            });
          } else {
            slide.addText(
              bullets.map((b, i) => ({
                text: s.layout === "timeline" ? `${i + 1}. ${b}` : b,
                options: {
                  bullet: s.layout === "timeline" ? false : { code: "2022" },
                  breakLine: true,
                },
              })),
              {
                x: 0.9, y: 1.95, w: W - 2, h: H - 2.7,
                fontSize: 19, color: text, lineSpacingMultiple: 1.45, fontFace: "Arial",
              },
            );
          }
        } else if (s.body) {
          slide.addText(s.body, {
            x: 0.9, y: 1.95, w: W - 2, h: H - 2.7,
            fontSize: 18, color: text, fontFace: "Arial",
          });
        }
      }

      if (s.note) slide.addNotes(s.note);
    }

    if (!slides.length) {
      const slide = pptx.addSlide();
      slide.background = { color: t.bgSolid };
      slide.addText(row.title, {
        x: 1, y: 3, w: W - 2, h: 1.5, fontSize: 40, bold: true, color: text, align: "center",
      });
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    const safeName = (row.title || "presentation").replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "presentation";

    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.pptx`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pptx]", err);
    return new Response("Export failed", { status: 500 });
  }
}
