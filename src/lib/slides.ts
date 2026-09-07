/** Presentation model + theme library. Pure data, safe on client and server. */

export type SlideLayout =
  | "title"
  | "bullets"
  | "two_column"
  | "quote"
  | "big_number"
  | "image_text"
  | "section"
  | "comparison"
  | "timeline"
  | "media"
  | "closing";

export type SlideAnim = "fade" | "slide" | "zoom" | "flip" | "reveal" | "cube" | "swipe" | "none";

export type MediaKind = "none" | "image" | "video" | "youtube" | "embed";

export type SlideMedia = {
  kind: MediaKind;
  url: string;
  /** Where the media sits relative to the text. */
  position: "right" | "left" | "top" | "background" | "full";
  fit: "cover" | "contain";
  caption?: string;
  /** 0-100, only used for background media so text stays readable. */
  dim?: number;
};

export type ElementAnim =
  | "none"
  | "fade_up"
  | "fade_in"
  | "slide_left"
  | "slide_right"
  | "zoom_in"
  | "pop"
  | "flip_in"
  | "blur_in";

export type Slide = {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets: string[];
  body?: string;
  icon?: string;
  /** Legacy single image — kept so older decks keep rendering. */
  image?: string;
  media?: SlideMedia;
  note?: string;
  /** Slide-level transition. */
  anim: SlideAnim;
  /** How title/bullets appear once the slide is shown. */
  elementAnim?: ElementAnim;
  /** Delay between each bullet, in ms. */
  stagger?: number;
  /** AI hint for what photo would suit this slide. */
  searchTerm?: string;
  accent?: string;
};

export type SlideTheme = {
  id: string;
  name: string;
  category: string;
  bg: string;
  /** Solid colour used for PPTX export (gradients are not portable). */
  bgSolid: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  font: "sans" | "rounded" | "serif" | "mono" | "display";
  motion: "aurora" | "mesh" | "waves" | "grid" | "stars" | "bubbles" | "rings" | "circuit" | "none";
  dark: boolean;
};

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "aurora", name: "অরোরা", category: "modern",
    bg: "linear-gradient(140deg,#061a2e,#0b3b5c 55%,#0d6b5f)", bgSolid: "0B3B5C",
    surface: "rgba(255,255,255,.10)", text: "#ffffff", muted: "rgba(255,255,255,.72)",
    primary: "#34d399", accent: "#fbbf24", font: "sans", motion: "aurora", dark: true,
  },
  {
    id: "midnight", name: "মিডনাইট", category: "professional",
    bg: "linear-gradient(150deg,#0b1120,#1e293b 60%,#334155)", bgSolid: "0F172A",
    surface: "rgba(255,255,255,.08)", text: "#f1f5f9", muted: "rgba(241,245,249,.68)",
    primary: "#60a5fa", accent: "#f0b429", font: "sans", motion: "grid", dark: true,
  },
  {
    id: "neon", name: "নিয়ন আর্কেড", category: "vibrant",
    bg: "linear-gradient(140deg,#0a0118,#2d0b52 55%,#0b1e5b)", bgSolid: "1B0B3A",
    surface: "rgba(255,255,255,.09)", text: "#ffffff", muted: "rgba(255,255,255,.7)",
    primary: "#f0abfc", accent: "#22d3ee", font: "display", motion: "rings", dark: true,
  },
  {
    id: "galaxy", name: "গ্যালাক্সি", category: "vibrant",
    bg: "linear-gradient(150deg,#020617,#1e1b4b 55%,#4c1d95)", bgSolid: "1E1B4B",
    surface: "rgba(255,255,255,.10)", text: "#ffffff", muted: "rgba(255,255,255,.7)",
    primary: "#818cf8", accent: "#f0abfc", font: "display", motion: "stars", dark: true,
  },
  {
    id: "circuit", name: "সার্কিট", category: "technology",
    bg: "linear-gradient(135deg,#020617,#052e2b 60%,#064e3b)", bgSolid: "052E2B",
    surface: "rgba(255,255,255,.08)", text: "#ecfdf5", muted: "rgba(236,253,245,.7)",
    primary: "#10b981", accent: "#facc15", font: "mono", motion: "circuit", dark: true,
  },
  {
    id: "ocean", name: "ওশান", category: "modern",
    bg: "linear-gradient(160deg,#012a4a,#01497c 55%,#2a6f97)", bgSolid: "01497C",
    surface: "rgba(255,255,255,.11)", text: "#ffffff", muted: "rgba(255,255,255,.72)",
    primary: "#38bdf8", accent: "#fbbf24", font: "sans", motion: "waves", dark: true,
  },
  {
    id: "sunset", name: "সানসেট", category: "festival",
    bg: "linear-gradient(130deg,#7f1d1d,#dc2626 50%,#f59e0b)", bgSolid: "B91C1C",
    surface: "rgba(255,255,255,.14)", text: "#ffffff", muted: "rgba(255,255,255,.8)",
    primary: "#fde68a", accent: "#ffffff", font: "rounded", motion: "bubbles", dark: true,
  },
  {
    id: "forest", name: "ফরেস্ট", category: "nature",
    bg: "linear-gradient(150deg,#052e16,#14532d 55%,#166534)", bgSolid: "14532D",
    surface: "rgba(255,255,255,.10)", text: "#f0fdf4", muted: "rgba(240,253,244,.72)",
    primary: "#4ade80", accent: "#fbbf24", font: "serif", motion: "mesh", dark: true,
  },
  {
    id: "paper", name: "পেপার", category: "minimal",
    bg: "linear-gradient(160deg,#fefce8,#fef9c3)", bgSolid: "FEFCE8",
    surface: "#ffffff", text: "#1c1917", muted: "#57534e",
    primary: "#b45309", accent: "#0f766e", font: "serif", motion: "none", dark: false,
  },
  {
    id: "clean", name: "ক্লিন হোয়াইট", category: "minimal",
    bg: "linear-gradient(160deg,#ffffff,#f1f5f9)", bgSolid: "FFFFFF",
    surface: "#ffffff", text: "#0f172a", muted: "#64748b",
    primary: "#0f7b6c", accent: "#f0b429", font: "sans", motion: "none", dark: false,
  },
  {
    id: "mint", name: "মিন্ট", category: "education",
    bg: "linear-gradient(150deg,#ecfdf5,#a7f3d0 55%,#6ee7b7)", bgSolid: "D1FAE5",
    surface: "#ffffff", text: "#064e3b", muted: "#047857",
    primary: "#059669", accent: "#0d9488", font: "rounded", motion: "mesh", dark: false,
  },
  {
    id: "candy", name: "ক্যান্ডি", category: "kids",
    bg: "linear-gradient(120deg,#fbcfe8,#e9d5ff 45%,#bfdbfe)", bgSolid: "F5D0FE",
    surface: "#ffffff", text: "#4a044e", muted: "#86198f",
    primary: "#ec4899", accent: "#8b5cf6", font: "rounded", motion: "bubbles", dark: false,
  },
  {
    id: "board", name: "ব্ল্যাকবোর্ড", category: "education",
    bg: "linear-gradient(150deg,#1a2e28,#1f3b33)", bgSolid: "1A2E28",
    surface: "rgba(255,255,255,.07)", text: "#f8fafc", muted: "rgba(248,250,252,.68)",
    primary: "#fde68a", accent: "#93c5fd", font: "serif", motion: "none", dark: true,
  },
  {
    id: "pgtsc", name: "PGTSC অফিসিয়াল", category: "education",
    bg: "linear-gradient(135deg,#0f2f4a,#123a5c 60%,#0b6b53)", bgSolid: "0F2F4A",
    surface: "rgba(255,255,255,.12)", text: "#ffffff", muted: "rgba(255,255,255,.74)",
    primary: "#0f7b6c", accent: "#f0b429", font: "sans", motion: "aurora", dark: true,
  },
];

export function getTheme(id: string): SlideTheme {
  return SLIDE_THEMES.find((t) => t.id === id) ?? SLIDE_THEMES[0];
}

/** Curated icon set — grouped so teachers can find one fast. */
export const ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: "শিক্ষা", icons: ["📚", "✏️", "🎓", "🏫", "📝", "📖", "🧑‍🏫", "🎒", "📐", "🔖"] },
  { label: "বিজ্ঞান", icons: ["🔬", "🧪", "🧬", "⚗️", "🌡️", "🔭", "🪐", "⚛️", "🧲", "🦠"] },
  { label: "প্রযুক্তি", icons: ["💻", "🖥️", "📱", "⌨️", "🖱️", "🤖", "🛰️", "🔌", "💾", "🌐"] },
  { label: "ইলেকট্রনিক্স", icons: ["⚡", "🔋", "💡", "🔧", "🔩", "🛠️", "📡", "🎛️", "🧰", "⚙️"] },
  { label: "ডেটা", icons: ["📊", "📈", "📉", "🗂️", "📋", "🗃️", "🧮", "💹", "🔢", "📌"] },
  { label: "যোগাযোগ", icons: ["💬", "📢", "🔔", "✉️", "📮", "🗣️", "👥", "🤝", "🎤", "📞"] },
  { label: "সাফল্য", icons: ["🏆", "🥇", "⭐", "🎯", "🚀", "💎", "🔥", "✅", "🎉", "👏"] },
  { label: "প্রকৃতি", icons: ["🌿", "🌱", "🌻", "🌊", "☀️", "🌙", "🍃", "🌍", "🏔️", "🌈"] },
];

export const ALL_ICONS = ICON_GROUPS.flatMap((g) => g.icons);

export const LAYOUTS: { id: SlideLayout; label: string; icon: string; hint: string }[] = [
  { id: "title", label: "টাইটেল", icon: "🎬", hint: "শুরুর স্লাইড" },
  { id: "section", label: "সেকশন", icon: "🔖", hint: "নতুন অধ্যায়" },
  { id: "bullets", label: "বুলেট", icon: "📋", hint: "পয়েন্ট তালিকা" },
  { id: "two_column", label: "দুই কলাম", icon: "⬛", hint: "পাশাপাশি" },
  { id: "comparison", label: "তুলনা", icon: "⚖️", hint: "এটা vs ওটা" },
  { id: "big_number", label: "বড় সংখ্যা", icon: "🔢", hint: "পরিসংখ্যান" },
  { id: "quote", label: "উক্তি", icon: "❝", hint: "উদ্ধৃতি" },
  { id: "image_text", label: "ছবি + লেখা", icon: "🖼️", hint: "ছবিসহ" },
  { id: "media", label: "ভিডিও / মিডিয়া", icon: "🎬", hint: "ফুল স্ক্রিন মিডিয়া" },
  { id: "timeline", label: "টাইমলাইন", icon: "🕒", hint: "ধাপে ধাপে" },
  { id: "closing", label: "সমাপ্তি", icon: "🙏", hint: "ধন্যবাদ" },
];

export const ELEMENT_ANIMS: { id: ElementAnim; label: string }[] = [
  { id: "fade_up", label: "নিচ থেকে ফেড" },
  { id: "fade_in", label: "ফেড ইন" },
  { id: "slide_left", label: "বাম থেকে" },
  { id: "slide_right", label: "ডান থেকে" },
  { id: "zoom_in", label: "জুম ইন" },
  { id: "pop", label: "পপ" },
  { id: "flip_in", label: "ফ্লিপ" },
  { id: "blur_in", label: "ব্লার" },
  { id: "none", label: "নেই" },
];

export const MEDIA_POSITIONS: { id: SlideMedia["position"]; label: string }[] = [
  { id: "right", label: "ডান পাশে" },
  { id: "left", label: "বাম পাশে" },
  { id: "top", label: "উপরে" },
  { id: "background", label: "ব্যাকগ্রাউন্ড" },
  { id: "full", label: "পূর্ণ স্ক্রিন" },
];

/** Turns any YouTube/Vimeo/direct link into something we can embed. */
export function resolveMedia(url: string): { kind: MediaKind; src: string } {
  const u = (url ?? "").trim();
  if (!u) return { kind: "none", src: "" };

  const yt =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u);
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}?rel=0` };

  const vimeo = /vimeo\.com\/(\d+)/.exec(u);
  if (vimeo) return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo[1]}` };

  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) return { kind: "video", src: u };
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(u)) return { kind: "image", src: u };
  if (u.startsWith("data:image/")) return { kind: "image", src: u };
  if (/^https?:\/\//.test(u)) return { kind: "image", src: u };
  return { kind: "none", src: "" };
}

export const ANIMS: { id: SlideAnim; label: string }[] = [
  { id: "fade", label: "ফেড" },
  { id: "slide", label: "স্লাইড" },
  { id: "zoom", label: "জুম" },
  { id: "flip", label: "ফ্লিপ" },
  { id: "reveal", label: "রিভিল" },
  { id: "cube", label: "কিউব" },
  { id: "swipe", label: "সোয়াইপ" },
  { id: "none", label: "নেই" },
];

export function newSlide(layout: SlideLayout = "bullets"): Slide {
  const base: Slide = {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    layout,
    title: "",
    bullets: [],
    anim: "fade",
    elementAnim: "fade_up",
    stagger: 90,
    icon: "",
    media: { kind: "none", url: "", position: "right", fit: "cover", dim: 55 },
  };
  switch (layout) {
    case "title":
      return { ...base, title: "উপস্থাপনার শিরোনাম", subtitle: "উপশিরোনাম", icon: "🎓" };
    case "section":
      return { ...base, title: "নতুন অধ্যায়", subtitle: "সংক্ষিপ্ত পরিচিতি", icon: "🔖" };
    case "quote":
      return { ...base, title: "শেখা কখনো শেষ হয় না।", subtitle: "— অজানা", icon: "❝" };
    case "big_number":
      return { ...base, title: "৮৫%", subtitle: "শিক্ষার্থী উন্নতি করেছে", icon: "📈" };
    case "comparison":
      return {
        ...base, title: "তুলনা",
        bullets: ["প্রথম দিক — সুবিধা", "প্রথম দিক — সীমা", "দ্বিতীয় দিক — সুবিধা", "দ্বিতীয় দিক — সীমা"],
        icon: "⚖️",
      };
    case "timeline":
      return { ...base, title: "ধাপসমূহ", bullets: ["প্রথম ধাপ", "দ্বিতীয় ধাপ", "তৃতীয় ধাপ"], icon: "🕒" };
    case "closing":
      return { ...base, title: "ধন্যবাদ", subtitle: "প্রশ্ন থাকলে জিজ্ঞাসা করুন", icon: "🙏" };
    case "two_column":
      return { ...base, title: "দুই দিক", bullets: ["বাম দিকের পয়েন্ট", "ডান দিকের পয়েন্ট"], icon: "⬛" };
    case "image_text":
      return {
        ...base,
        title: "ছবিসহ ব্যাখ্যা",
        bullets: ["মূল পয়েন্ট"],
        icon: "🖼️",
        media: { kind: "image", url: "", position: "right", fit: "cover", dim: 55 },
      };
    case "media":
      return {
        ...base,
        title: "ভিডিও / ছবি",
        subtitle: "নিচে লিংক দিন",
        icon: "🎬",
        media: { kind: "video", url: "", position: "full", fit: "contain", dim: 40 },
      };
    default:
      return { ...base, title: "নতুন স্লাইড", bullets: ["প্রথম পয়েন্ট", "দ্বিতীয় পয়েন্ট"], icon: "📋" };
  }
}

export const FONT_STACK: Record<SlideTheme["font"], string> = {
  sans: 'var(--font-sans)',
  rounded: '"Hind Siliguri","Baloo Da 2","Nunito",var(--font-sans)',
  serif: '"Hind Siliguri",Georgia,serif',
  mono: '"Hind Siliguri","JetBrains Mono",ui-monospace,monospace',
  display: '"Hind Siliguri","Poppins",var(--font-sans)',
};
