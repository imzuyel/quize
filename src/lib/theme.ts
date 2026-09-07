/**
 * PGTSC animated theme engine — pure config, safe to import anywhere.
 * Every visual layer (background motion, particles, cards, buttons, timer,
 * transitions, celebration) is data-driven so teachers can build themes
 * without writing code.
 */

export type BackgroundMotion =
  | "static"
  | "aurora"
  | "mesh"
  | "gradient_shift"
  | "waves"
  | "grid_pulse"
  | "starfield"
  | "bubbles"
  | "neon_rings"
  | "confetti_rain"
  | "spotlight"
  | "circuit";

export type ParticleKind =
  | "none"
  | "sparkles"
  | "bokeh"
  | "snow"
  | "embers"
  | "petals"
  | "stars"
  | "bubbles"
  | "code";

export type CardStyle = "elevated" | "glass" | "outline" | "solid" | "neon" | "paper";
export type AnswerStyle = "grid" | "pill" | "3d" | "glass" | "neon" | "flat" | "outline";
export type TimerStyle = "circular" | "linear" | "digital" | "flip" | "pulse" | "minimal" | "ring_glow";
export type Transition = "fade" | "slide" | "zoom" | "scale" | "flip" | "reveal" | "cube" | "swipe";
export type ResultAnimation = "trophy" | "confetti" | "fireworks" | "minimal" | "rays" | "coins";
export type FontPair = "sans" | "rounded" | "serif" | "mono" | "display";

export type TemplateConfig = {
  name: string;
  category: string;
  background: string;
  backgroundMotion: BackgroundMotion;
  motionSpeed: number; // 0.5 slow … 2 fast
  particles: ParticleKind;
  particleDensity: number; // 0-100
  primary: string;
  accent: string;
  secondary: string;
  surface: string;
  textColor: string;
  answerPalette: string[];
  font: FontPair;
  radius: number;
  glow: boolean;
  questionCard: CardStyle;
  answerStyle: AnswerStyle;
  timerStyle: TimerStyle;
  progressStyle: string;
  transition: Transition;
  motion: "low" | "medium" | "high";
  sound: boolean;
  music: string;
  resultAnimation: ResultAnimation;
  logo: string;
};

export const CLASSIC_PALETTE = ["#e2574c", "#2f80ed", "#f0b429", "#0f9d58", "#8b5cf6", "#0891b2"];

export const DEFAULT_TEMPLATE: TemplateConfig = {
  name: "PGTSC Official",
  category: "academic",
  background: "linear-gradient(135deg,#0f2f4a 0%,#123a5c 60%,#0b6b53 100%)",
  backgroundMotion: "aurora",
  motionSpeed: 1,
  particles: "none",
  particleDensity: 30,
  primary: "#0f7b6c",
  accent: "#f0b429",
  secondary: "#12a08c",
  surface: "#ffffff",
  textColor: "#0f172a",
  answerPalette: CLASSIC_PALETTE,
  font: "sans",
  radius: 18,
  glow: false,
  questionCard: "elevated",
  answerStyle: "grid",
  timerStyle: "circular",
  progressStyle: "bar",
  transition: "slide",
  motion: "medium",
  sound: true,
  music: "none",
  resultAnimation: "confetti",
  logo: "",
};

export function mergeTemplate(raw: unknown): TemplateConfig {
  const cfg = { ...DEFAULT_TEMPLATE, ...((raw as Partial<TemplateConfig>) ?? {}) };
  if (!Array.isArray(cfg.answerPalette) || cfg.answerPalette.length < 2)
    cfg.answerPalette = CLASSIC_PALETTE;
  return cfg;
}

/* ------------------------------------------------------------------ */
/* Built-in animated theme library                                     */
/* ------------------------------------------------------------------ */

type Preset = Partial<TemplateConfig> & { name: string; category: string };

export const THEME_PRESETS: Preset[] = [
  {
    name: "PGTSC Official",
    category: "academic",
    background: "linear-gradient(135deg,#0f2f4a,#123a5c 60%,#0b6b53)",
    backgroundMotion: "aurora",
    primary: "#0f7b6c",
    accent: "#f0b429",
    secondary: "#12a08c",
  },
  {
    name: "Neon Arcade",
    category: "competition",
    background: "linear-gradient(140deg,#0a0118,#2d0b52 50%,#0b1e5b)",
    backgroundMotion: "neon_rings",
    particles: "sparkles",
    particleDensity: 55,
    primary: "#f0abfc",
    accent: "#22d3ee",
    secondary: "#a78bfa",
    answerPalette: ["#f472b6", "#22d3ee", "#facc15", "#4ade80", "#c084fc", "#fb923c"],
    answerStyle: "neon",
    questionCard: "glass",
    timerStyle: "ring_glow",
    transition: "zoom",
    glow: true,
    motion: "high",
    resultAnimation: "fireworks",
    font: "display",
  },
  {
    name: "Aurora Dream",
    category: "science",
    background: "linear-gradient(160deg,#031326,#052e4a 45%,#0b6b53)",
    backgroundMotion: "aurora",
    motionSpeed: 0.8,
    particles: "stars",
    particleDensity: 45,
    primary: "#34d399",
    accent: "#60a5fa",
    secondary: "#a78bfa",
    answerPalette: ["#34d399", "#60a5fa", "#f472b6", "#fbbf24", "#22d3ee", "#c084fc"],
    questionCard: "glass",
    timerStyle: "ring_glow",
    transition: "reveal",
    glow: true,
    motion: "high",
    resultAnimation: "rays",
  },
  {
    name: "Rainbow Playground",
    category: "kids",
    background: "linear-gradient(120deg,#ff9a9e,#fad0c4 35%,#fbc2eb 65%,#a6c1ee)",
    backgroundMotion: "gradient_shift",
    motionSpeed: 1.3,
    particles: "bubbles",
    particleDensity: 60,
    primary: "#f97316",
    accent: "#22c55e",
    secondary: "#ec4899",
    answerPalette: ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#06b6d4"],
    answerStyle: "3d",
    questionCard: "solid",
    textColor: "#3b1d0e",
    font: "rounded",
    radius: 28,
    timerStyle: "pulse",
    transition: "scale",
    motion: "high",
    resultAnimation: "confetti",
  },
  {
    name: "Cyber Circuit",
    category: "electronics",
    background: "linear-gradient(135deg,#020617,#052e2b 60%,#064e3b)",
    backgroundMotion: "circuit",
    particles: "code",
    particleDensity: 40,
    primary: "#10b981",
    accent: "#facc15",
    secondary: "#22d3ee",
    answerPalette: ["#10b981", "#22d3ee", "#facc15", "#f472b6", "#818cf8", "#fb7185"],
    answerStyle: "neon",
    questionCard: "neon",
    timerStyle: "digital",
    transition: "swipe",
    glow: true,
    font: "mono",
    motion: "high",
    resultAnimation: "rays",
  },
  {
    name: "Voltage Storm",
    category: "electrical",
    background: "linear-gradient(135deg,#1c1917,#7c2d12 55%,#b45309)",
    backgroundMotion: "grid_pulse",
    particles: "embers",
    particleDensity: 50,
    primary: "#f59e0b",
    accent: "#fde68a",
    secondary: "#fb923c",
    answerPalette: ["#f59e0b", "#ef4444", "#fbbf24", "#84cc16", "#f97316", "#eab308"],
    answerStyle: "3d",
    timerStyle: "flip",
    transition: "flip",
    glow: true,
    motion: "high",
    resultAnimation: "fireworks",
  },
  {
    name: "Ocean Wave",
    category: "language",
    background: "linear-gradient(160deg,#012a4a,#01497c 50%,#2a6f97)",
    backgroundMotion: "waves",
    particles: "bokeh",
    particleDensity: 35,
    primary: "#38bdf8",
    accent: "#fbbf24",
    secondary: "#22d3ee",
    answerPalette: ["#0ea5e9", "#14b8a6", "#f59e0b", "#f43f5e", "#8b5cf6", "#84cc16"],
    questionCard: "glass",
    answerStyle: "pill",
    timerStyle: "linear",
    transition: "slide",
    motion: "medium",
    resultAnimation: "confetti",
  },
  {
    name: "Galaxy Quest",
    category: "technology",
    background: "linear-gradient(150deg,#020617,#1e1b4b 50%,#4c1d95)",
    backgroundMotion: "starfield",
    particles: "stars",
    particleDensity: 70,
    primary: "#818cf8",
    accent: "#f0abfc",
    secondary: "#38bdf8",
    answerPalette: ["#818cf8", "#f472b6", "#22d3ee", "#fbbf24", "#4ade80", "#fb7185"],
    questionCard: "glass",
    answerStyle: "glass",
    timerStyle: "ring_glow",
    transition: "cube",
    glow: true,
    motion: "high",
    font: "display",
    resultAnimation: "fireworks",
  },
  {
    name: "Sunset Festival",
    category: "festival",
    background: "linear-gradient(130deg,#7f1d1d,#dc2626 45%,#f59e0b)",
    backgroundMotion: "gradient_shift",
    particles: "petals",
    particleDensity: 55,
    primary: "#dc2626",
    accent: "#fde68a",
    secondary: "#fb923c",
    answerPalette: ["#dc2626", "#f59e0b", "#16a34a", "#0891b2", "#9333ea", "#e11d48"],
    answerStyle: "3d",
    radius: 24,
    timerStyle: "pulse",
    transition: "zoom",
    motion: "high",
    font: "rounded",
    resultAnimation: "confetti",
  },
  {
    name: "Winter Frost",
    category: "science",
    background: "linear-gradient(160deg,#0c4a6e,#0369a1 50%,#7dd3fc)",
    backgroundMotion: "mesh",
    particles: "snow",
    particleDensity: 65,
    primary: "#0ea5e9",
    accent: "#e0f2fe",
    secondary: "#38bdf8",
    answerPalette: ["#0284c7", "#06b6d4", "#6366f1", "#14b8a6", "#f472b6", "#facc15"],
    questionCard: "glass",
    timerStyle: "circular",
    transition: "fade",
    motion: "medium",
    resultAnimation: "rays",
  },
  {
    name: "Golden Championship",
    category: "competition",
    background: "linear-gradient(135deg,#1c1917,#422006 55%,#854d0e)",
    backgroundMotion: "spotlight",
    particles: "sparkles",
    particleDensity: 60,
    primary: "#f0b429",
    accent: "#fef3c7",
    secondary: "#fbbf24",
    answerPalette: ["#f0b429", "#dc2626", "#0891b2", "#16a34a", "#9333ea", "#f97316"],
    answerStyle: "3d",
    questionCard: "elevated",
    timerStyle: "flip",
    transition: "cube",
    glow: true,
    motion: "high",
    font: "display",
    resultAnimation: "coins",
  },
  {
    name: "Mint Fresh",
    category: "mathematics",
    background: "linear-gradient(150deg,#ecfdf5,#a7f3d0 50%,#6ee7b7)",
    backgroundMotion: "mesh",
    motionSpeed: 0.7,
    primary: "#059669",
    accent: "#0d9488",
    secondary: "#34d399",
    textColor: "#064e3b",
    answerPalette: ["#059669", "#0ea5e9", "#f59e0b", "#e11d48", "#7c3aed", "#0891b2"],
    answerStyle: "pill",
    questionCard: "paper",
    timerStyle: "linear",
    transition: "fade",
    motion: "low",
    resultAnimation: "minimal",
  },
  {
    name: "Candy Pop",
    category: "kids",
    background: "linear-gradient(120deg,#fbcfe8,#e9d5ff 40%,#bfdbfe)",
    backgroundMotion: "bubbles",
    particles: "bubbles",
    particleDensity: 70,
    primary: "#ec4899",
    accent: "#8b5cf6",
    secondary: "#38bdf8",
    textColor: "#4a044e",
    answerPalette: ["#ec4899", "#8b5cf6", "#f59e0b", "#10b981", "#3b82f6", "#f43f5e"],
    answerStyle: "3d",
    radius: 30,
    font: "rounded",
    timerStyle: "pulse",
    transition: "scale",
    motion: "high",
    resultAnimation: "confetti",
  },
  {
    name: "Exam Hall",
    category: "examination",
    background: "linear-gradient(150deg,#f8fafc,#e2e8f0)",
    backgroundMotion: "static",
    particles: "none",
    primary: "#1f2937",
    accent: "#64748b",
    secondary: "#475569",
    textColor: "#0f172a",
    answerPalette: ["#475569", "#64748b", "#334155", "#94a3b8", "#1e293b", "#52525b"],
    answerStyle: "outline",
    questionCard: "paper",
    timerStyle: "minimal",
    transition: "fade",
    motion: "low",
    sound: false,
    resultAnimation: "minimal",
  },
  {
    name: "Board Professional",
    category: "professional",
    background: "linear-gradient(150deg,#0f172a,#1e293b 60%,#334155)",
    backgroundMotion: "grid_pulse",
    motionSpeed: 0.6,
    primary: "#0f2f4a",
    accent: "#94a3b8",
    secondary: "#475569",
    answerPalette: ["#2563eb", "#0d9488", "#b45309", "#be123c", "#6d28d9", "#0369a1"],
    answerStyle: "flat",
    timerStyle: "digital",
    transition: "fade",
    motion: "low",
    resultAnimation: "minimal",
  },
  {
    name: "Computer Lab",
    category: "computer",
    background: "linear-gradient(140deg,#0c1a3a,#1d4ed8 70%,#0ea5e9)",
    backgroundMotion: "circuit",
    particles: "code",
    particleDensity: 45,
    primary: "#2563eb",
    accent: "#60a5fa",
    secondary: "#38bdf8",
    answerPalette: ["#2563eb", "#06b6d4", "#f59e0b", "#22c55e", "#a855f7", "#ef4444"],
    answerStyle: "glass",
    questionCard: "glass",
    timerStyle: "digital",
    transition: "swipe",
    font: "mono",
    motion: "medium",
    resultAnimation: "rays",
  },
];

/* ------------------------------------------------------------------ */
/* Derived style helpers (used by the renderer components)             */
/* ------------------------------------------------------------------ */

export const FONT_STACKS: Record<FontPair, string> = {
  sans: 'var(--font-sans)',
  rounded: '"Hind Siliguri", "Baloo Da 2", "Nunito", var(--font-sans)',
  serif: '"Hind Siliguri", Georgia, "Times New Roman", serif',
  mono: '"Hind Siliguri", "JetBrains Mono", ui-monospace, monospace',
  display: '"Hind Siliguri", "Poppins", "Inter", var(--font-sans)',
};

export function cardStyle(cfg: TemplateConfig): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: cfg.radius,
    color: cfg.textColor,
    fontFamily: FONT_STACKS[cfg.font] ?? FONT_STACKS.sans,
  };
  switch (cfg.questionCard) {
    case "glass":
      return {
        ...base,
        background: "rgba(255,255,255,.14)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,.28)",
        color: "#fff",
      };
    case "outline":
      return { ...base, background: "transparent", border: `2px solid ${cfg.primary}`, color: "#fff" };
    case "neon":
      return {
        ...base,
        background: "rgba(2,6,23,.72)",
        border: `1.5px solid ${cfg.accent}`,
        boxShadow: `0 0 22px ${cfg.accent}55, inset 0 0 22px ${cfg.primary}22`,
        color: "#fff",
      };
    case "solid":
      return { ...base, background: cfg.surface };
    case "paper":
      return { ...base, background: cfg.surface, border: "1px solid rgba(15,23,42,.12)" };
    default:
      return {
        ...base,
        background: cfg.surface,
        boxShadow: "0 18px 40px -22px rgba(2,6,23,.55)",
      };
  }
}

export function answerStyleFor(
  cfg: TemplateConfig,
  index: number,
  state: "idle" | "selected" | "correct" | "wrong",
): React.CSSProperties {
  const color = cfg.answerPalette[index % cfg.answerPalette.length];
  const base: React.CSSProperties = {
    borderRadius: cfg.radius,
    fontFamily: FONT_STACKS[cfg.font] ?? FONT_STACKS.sans,
    transition: "transform .15s ease, box-shadow .2s ease, filter .2s ease",
  };
  const glow = cfg.glow ? `0 0 20px ${color}77` : "none";

  let style: React.CSSProperties;
  switch (cfg.answerStyle) {
    case "pill":
      style = { ...base, background: color, color: "#fff", borderRadius: 999, boxShadow: glow };
      break;
    case "3d":
      style = {
        ...base,
        background: color,
        color: "#fff",
        boxShadow: `0 6px 0 0 ${shade(color, -28)}, 0 10px 22px -8px rgba(2,6,23,.5)`,
      };
      break;
    case "glass":
      style = {
        ...base,
        background: `${color}44`,
        border: `1.5px solid ${color}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "#fff",
        boxShadow: glow,
      };
      break;
    case "neon":
      style = {
        ...base,
        background: "rgba(2,6,23,.6)",
        border: `2px solid ${color}`,
        color: "#fff",
        boxShadow: `0 0 16px ${color}88, inset 0 0 16px ${color}33`,
        textShadow: `0 0 10px ${color}`,
      };
      break;
    case "flat":
      style = { ...base, background: color, color: "#fff", boxShadow: "none" };
      break;
    case "outline":
      style = { ...base, background: "#fff", border: `2px solid ${color}`, color: shade(color, -45) };
      break;
    default:
      style = { ...base, background: color, color: "#fff", boxShadow: glow };
  }

  if (state === "selected")
    style = { ...style, transform: "scale(1.02)", boxShadow: `0 0 0 4px rgba(255,255,255,.85), ${glow}` };
  if (state === "correct")
    style = { ...style, boxShadow: "0 0 0 4px #34d399, 0 0 26px #34d39988" };
  if (state === "wrong") style = { ...style, filter: "grayscale(.5)", opacity: 0.7 };
  return style;
}

/** Lighten (positive) or darken (negative) a hex colour by percent. */
export function shade(hex: string, percent: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const adj = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (percent / 100) * (percent > 0 ? 255 - v : v))));
  const [r, g, b] = [adj(parseInt(m[1], 16)), adj(parseInt(m[2], 16)), adj(parseInt(m[3], 16))];
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const TRANSITION_CLASS: Record<Transition, string> = {
  fade: "anim-fade",
  slide: "anim-slide",
  zoom: "anim-zoom",
  scale: "anim-scale",
  flip: "anim-flip",
  reveal: "anim-reveal",
  cube: "anim-cube",
  swipe: "anim-swipe",
};

export const BG_MOTION_LABEL: Record<BackgroundMotion, string> = {
  static: "স্থির",
  aurora: "অরোরা",
  mesh: "মেশ গ্রেডিয়েন্ট",
  gradient_shift: "রঙ পরিবর্তন",
  waves: "ঢেউ",
  grid_pulse: "গ্রিড পালস",
  starfield: "তারার আকাশ",
  bubbles: "বুদবুদ",
  neon_rings: "নিয়ন রিং",
  confetti_rain: "কনফেত্তি বৃষ্টি",
  spotlight: "স্পটলাইট",
  circuit: "সার্কিট",
};

export const PARTICLE_LABEL: Record<ParticleKind, string> = {
  none: "নেই",
  sparkles: "ঝিলিক",
  bokeh: "বোকেহ",
  snow: "তুষার",
  embers: "স্ফুলিঙ্গ",
  petals: "পাপড়ি",
  stars: "তারা",
  bubbles: "বুদবুদ",
  code: "কোড",
};

export const PARTICLE_GLYPH: Record<ParticleKind, string[]> = {
  none: [],
  sparkles: ["✦", "✧", "⋆", "✩"],
  bokeh: ["●", "○"],
  snow: ["❄", "❅", "✻"],
  embers: ["✦", "●"],
  petals: ["🌸", "🍁", "❀"],
  stars: ["★", "✦", "·"],
  bubbles: ["◯", "○", "●"],
  code: ["</>", "{ }", "01", "01"],
};
