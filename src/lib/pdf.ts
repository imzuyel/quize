/**
 * Page-aware document text extraction.
 * Primary path: pdfjs-dist (accurate, per-page).
 * Fallback: a dependency-free PDF stream reader (zlib) so uploads still work
 * if pdfjs cannot initialise in the runtime.
 */
import { inflateSync } from "node:zlib";

export type ExtractedDoc = {
  pages: string[];
  pageCount: number;
  chars: number;
  method: "pdfjs" | "raw" | "text";
};

export type Outline = {
  title: string;
  pageFrom: number;
  pageTo: number;
};

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

async function extractWithPdfjs(buffer: Buffer): Promise<string[] | null> {
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(process.cwd() + "/package.json");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    (pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc = req.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true,
    });
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => {
          const item = it as { str?: string; hasEOL?: boolean };
          return (item.str ?? "") + (item.hasEOL ? "\n" : "");
        })
        .join("");
      pages.push(text.replace(/[ \t]+/g, " ").trim());
      page.cleanup();
    }
    await doc.destroy();
    return pages;
  } catch {
    return null;
  }
}

/** Minimal PDF parser: splits pages, inflates content streams, reads text ops. */
function extractRawPdf(buffer: Buffer): string[] {
  const latin = buffer.toString("latin1");
  const pages: string[] = [];

  // Collect every stream, decoded where possible.
  const chunks: string[] = [];
  const re = /stream\r?\n?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(latin)) !== null) {
    const start = match.index + match[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) continue;
    const header = latin.slice(Math.max(0, match.index - 400), match.index);
    const raw = buffer.subarray(start, end);
    let text = "";
    if (/FlateDecode/.test(header)) {
      try {
        text = inflateSync(raw).toString("latin1");
      } catch {
        text = "";
      }
    } else {
      text = raw.toString("latin1");
    }
    if (text && /(Tj|TJ)/.test(text)) chunks.push(text);
    re.lastIndex = end;
  }

  for (const chunk of chunks) {
    const parts: string[] = [];
    const tj = /\((?:\\.|[^\\()])*\)\s*Tj|\[(?:[^\]\\]|\\.)*\]\s*TJ|\bTd\b|\bTD\b|\bT\*/g;
    let m: RegExpExecArray | null;
    while ((m = tj.exec(chunk)) !== null) {
      const tok = m[0];
      if (/T[d D*]/.test(tok) && !tok.includes("(")) {
        parts.push(" ");
        continue;
      }
      const strings = tok.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
      for (const s of strings) parts.push(decodePdfString(s.slice(1, -1)));
    }
    const page = parts.join("").replace(/\s+/g, " ").trim();
    if (page.length > 20) pages.push(page);
  }
  return pages;
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function extractDocument(name: string, buffer: Buffer): Promise<ExtractedDoc> {
  const lower = name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const viaPdfjs = await extractWithPdfjs(buffer);
    if (viaPdfjs && viaPdfjs.some((p) => p.length > 20)) {
      return {
        pages: viaPdfjs,
        pageCount: viaPdfjs.length,
        chars: viaPdfjs.join("").length,
        method: "pdfjs",
      };
    }
    const raw = extractRawPdf(buffer);
    if (raw.length)
      return { pages: raw, pageCount: raw.length, chars: raw.join("").length, method: "raw" };
    return { pages: [], pageCount: 0, chars: 0, method: "raw" };
  }

  // docx / pptx (zip xml) and plain text
  let text: string;
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) {
    text = buffer.toString("utf8");
  } else {
    const raw = buffer.toString("utf8");
    const frags = raw.match(/>([^<>]{5,})</g);
    text = frags
      ? frags.map((s) => s.slice(1, -1)).join(" ")
      : raw.replace(/[^\p{L}\p{N}\s.,;:!?()\-—–।]/gu, " ");
  }
  text = text.replace(/[ \t]+/g, " ").trim();

  // Slice long text into ~2500 char "pages" so range selection still works.
  const pages: string[] = [];
  const size = 2500;
  for (let i = 0; i < text.length; i += size) pages.push(text.slice(i, i + size));
  return {
    pages: pages.length ? pages : [text],
    pageCount: Math.max(1, pages.length),
    chars: text.length,
    method: "text",
  };
}

/** Heuristically detect chapters so the teacher can pick "Chapter 1" directly. */
export function detectOutline(pages: string[]): Outline[] {
  const patterns = [
    /^\s*(?:chapter|unit|lesson)\s+(\d{1,2})\b[.:\-–—\s]*(.{0,60})/i,
    /^\s*(?:অধ্যায়|পাঠ|একক)\s*[-–—:]?\s*([০-৯\d]{1,2})\b[.:\-–—\s]*(.{0,60})/,
    /^\s*(\d{1,2})\s*[.।]\s+([\p{Lu}\p{L}][^\n]{4,60})$/u,
  ];
  const found: Outline[] = [];

  pages.forEach((page, idx) => {
    const lines = page.split("\n").slice(0, 6);
    for (const line of lines) {
      const clean = line.trim();
      if (!clean || clean.length > 90) continue;
      for (const re of patterns) {
        const m = re.exec(clean);
        if (m) {
          const num = m[1];
          const label = (m[2] ?? "").trim();
          const title = label ? `${num}. ${label}` : `অধ্যায় ${num}`;
          if (!found.some((f) => f.title === title)) {
            found.push({ title, pageFrom: idx + 1, pageTo: pages.length });
          }
          return;
        }
      }
    }
  });

  for (let i = 0; i < found.length - 1; i++) found[i].pageTo = found[i + 1].pageFrom - 1;

  // No headings detected → offer even slices so ranges are still usable.
  if (found.length < 2 && pages.length > 6) {
    const parts = Math.min(8, Math.ceil(pages.length / 10));
    const span = Math.ceil(pages.length / parts);
    return Array.from({ length: parts }).map((_, i) => ({
      title: `অংশ ${i + 1} (পেজ ${i * span + 1}-${Math.min(pages.length, (i + 1) * span)})`,
      pageFrom: i * span + 1,
      pageTo: Math.min(pages.length, (i + 1) * span),
    }));
  }
  return found;
}

export function pagesToText(pages: string[], from: number, to: number, limit = 60000): string {
  const start = Math.max(1, from) - 1;
  const end = Math.min(pages.length, to);
  return pages.slice(start, end).join("\n\n").slice(0, limit);
}
