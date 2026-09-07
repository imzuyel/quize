/**
 * Provider-agnostic, server-only AI service layer.
 * Keys are read from process.env and NEVER exposed to the client.
 * When no provider is configured the built-in deterministic generator is used
 * so every feature stays fully functional (UI shows a clear setup state).
 */

export type ProviderId = "gemini" | "openai" | "anthropic" | "groq" | "openai-compatible";

export type AIProviderInfo = {
  configured: boolean;
  provider: ProviderId | "builtin";
  model: string;
  note: string;
  /** Every provider that has a key, in the order they will be attempted. */
  chain: { id: ProviderId; model: string; label: string }[];
};

/** Verified-working defaults (checked against the live APIs). */
const DEFAULT_MODELS: Record<ProviderId, string[]> = {
  // gemini-2.x was retired for new keys; 3.x flash is the current free workhorse.
  gemini: ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-flash-latest"],
  openai: ["gpt-4o-mini", "gpt-4.1-mini"],
  anthropic: ["claude-3-5-sonnet-latest"],
  // Groq retired the llama-3.x names; gpt-oss is the current default.
  // qwen returns plain JSON; gpt-oss needs a reasoning detour, so it is second.
  groq: ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  "openai-compatible": ["default"],
};

const LABELS: Record<ProviderId, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
  groq: "Groq",
  "openai-compatible": "Custom endpoint",
};

/**
 * Keys saved from the admin UI. These take priority over environment
 * variables so a school can rotate a key without redeploying. They live in
 * memory here and are refreshed from the `settings` table on demand.
 */
type KeyOverrides = Partial<Record<ProviderId, string>> & { provider?: string; model?: string };
const globalForKeys = globalThis as typeof globalThis & {
  __pgtscAiKeys?: { data: KeyOverrides; at: number };
};

function overrides(): KeyOverrides {
  return globalForKeys.__pgtscAiKeys?.data ?? {};
}

/** Replaces the in-memory overrides (called after an admin saves). */
export function setKeyOverrides(data: KeyOverrides) {
  globalForKeys.__pgtscAiKeys = { data: data ?? {}, at: Date.now() };
}

/** Server-side only: the key that would actually be used for this provider. */
export function effectiveKey(id: ProviderId): string | undefined {
  return keyFor(id);
}

export function keySource(id: ProviderId): "admin" | "env" | "none" {
  if (overrides()[id]) return "admin";
  const env =
    id === "gemini"
      ? process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      : id === "openai"
        ? process.env.OPENAI_API_KEY
        : id === "anthropic"
          ? process.env.ANTHROPIC_API_KEY
          : id === "groq"
            ? process.env.GROQ_API_KEY
            : process.env.AI_API_KEY;
  return env ? "env" : "none";
}

function keyFor(id: ProviderId): string | undefined {
  const saved = overrides()[id];
  if (saved) return saved;
  switch (id) {
    case "gemini":
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
    case "openai":
      return process.env.OPENAI_API_KEY || undefined;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY || undefined;
    case "groq":
      return process.env.GROQ_API_KEY || undefined;
    case "openai-compatible":
      return process.env.AI_BASE_URL && process.env.AI_API_KEY ? process.env.AI_API_KEY : undefined;
  }
}

/**
 * Providers are tried in this order. Gemini leads because it has a permanent
 * free tier; Groq is a strong free backup; paid providers come last so a
 * drained balance never blocks a lesson.
 */
const PRIORITY: ProviderId[] = ["gemini", "groq", "openai", "anthropic", "openai-compatible"];

function buildChain(): { id: ProviderId; model: string; label: string }[] {
  const preferred = (overrides().provider || process.env.AI_PROVIDER || "")
    .trim()
    .toLowerCase() as ProviderId;
  const order = PRIORITY.slice().sort((a, b) =>
    a === preferred ? -1 : b === preferred ? 1 : 0,
  );
  return order
    .filter((id) => Boolean(keyFor(id)))
    .map((id) => ({
      id,
      model: overrides().model || process.env.AI_MODEL || DEFAULT_MODELS[id][0],
      label: LABELS[id],
    }));
}

/** Quick live check that a key actually works, used by the admin UI. */
export async function verifyKey(
  id: ProviderId,
  key: string,
  model?: string,
): Promise<{ ok: boolean; message: string; models?: string[] }> {
  try {
    if (id === "gemini") {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
        headers: { "x-goog-api-key": key },
      });
      if (!r.ok) {
        const t = await r.text();
        return { ok: false, message: `HTTP ${r.status} — ${t.slice(0, 120)}` };
      }
      const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const usable = (j.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => m.name.replace("models/", ""));
      return { ok: true, message: `${usable.length}টি মডেল পাওয়া গেছে`, models: usable.slice(0, 40) };
    }

    const base =
      id === "groq"
        ? "https://api.groq.com/openai/v1"
        : id === "openai"
          ? "https://api.openai.com/v1"
          : (process.env.AI_BASE_URL as string);
    if (!base) return { ok: false, message: "endpoint সেট করা নেই" };
    const r = await fetch(`${base.replace(/\/$/, "")}/models`, {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, message: `HTTP ${r.status} — ${t.slice(0, 120)}` };
    }
    const j = (await r.json()) as { data?: { id: string }[] };
    const ids = (j.data ?? []).map((m) => m.id);
    return { ok: true, message: `${ids.length}টি মডেল পাওয়া গেছে`, models: ids.slice(0, 40) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "সংযোগ ব্যর্থ" };
  }
  void model;
}

export function getProviderInfo(): AIProviderInfo {
  const chain = buildChain();
  if (!chain.length)
    return {
      configured: false,
      provider: "builtin",
      model: "pgtsc-builtin-v1",
      chain: [],
      note:
        "কোনো AI কী নেই — বিল্ট-ইন জেনারেটর চলছে। ফ্রি Gemini কী (aistudio.google.com) নিয়ে GEMINI_API_KEY সেট করলেই মান অনেক ভালো হবে।",
    };
  const primary = chain[0];
  const backups = chain.slice(1).map((c) => c.label);
  return {
    configured: true,
    provider: primary.id,
    model: primary.model,
    chain,
    note: backups.length
      ? `${primary.label} সক্রিয় · ব্যর্থ হলে স্বয়ংক্রিয়ভাবে ${backups.join(", ")} ব্যবহার হবে`
      : `${primary.label} সক্রিয়`,
  };
}

type ChatMessage = { role: "system" | "user"; content: string };

/** Free tiers are rate limited, so back off and retry on 429/503. */
async function fetchWithRetry(url: string, init: RequestInit, attempts = 2): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status === 503) && i < attempts - 1) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(20_000, retryAfter * 1000)
            : 1500 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      return res;
    } catch {
      if (i === attempts - 1) return null;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

async function callGemini(
  key: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string | null> {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const userText = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
  // A model can be retired or briefly overloaded; walk the known-good list.
  const models = [model, ...DEFAULT_MODELS.gemini.filter((m) => m !== model)];
  for (const candidate of models) {
    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.85,
            responseMimeType: "application/json",
          },
          safetySettings: [
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
          ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
        }),
      },
    );
    if (!res) continue;
    if (!res.ok) {
      console.error("[ai:gemini]", candidate, res.status, (await res.text()).slice(0, 160));
      continue;
    }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (text.trim()) return text;
  }
  return null;
}

async function callAnthropic(
  key: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string | null> {
  const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: messages.find((m) => m.role === "system")?.content ?? "",
      messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: "user", content: m.content })),
    }),
  });
  if (!res) return null;
  if (!res.ok) {
    console.error("[ai:anthropic]", res.status, (await res.text()).slice(0, 160));
    return null;
  }
  const json = (await res.json()) as { content?: { text?: string }[] };
  return json.content?.[0]?.text ?? null;
}

async function callOpenAICompatible(
  id: ProviderId,
  key: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string | null> {
  const base =
    id === "groq"
      ? "https://api.groq.com/openai/v1"
      : id === "openai"
        ? "https://api.openai.com/v1"
        : (process.env.AI_BASE_URL as string);
  const models = [model, ...(DEFAULT_MODELS[id] ?? []).filter((m) => m !== model)];
  for (const candidate of models) {
    // Reasoning models (gpt-oss, qwen3) spend the token budget on hidden
    // reasoning and can return empty content. Keeping effort low leaves room
    // for the actual answer and is much faster.
    const isReasoning = /gpt-oss|qwen3|o[134]-|deepseek-r/i.test(candidate);
    const res = await fetchWithRetry(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: candidate,
        messages,
        max_completion_tokens: maxTokens,
        ...(isReasoning && id === "groq" ? { reasoning_effort: "low" } : {}),
      }),
    });
    if (!res) continue;
    if (!res.ok) {
      console.error("[ai:" + id + "]", candidate, res.status, (await res.text()).slice(0, 160));
      // No credits / bad key → stop trying this provider entirely.
      if (res.status === 401 || res.status === 402 || res.status === 429) return null;
      continue;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning?: string } }[];
    };
    const msg = json.choices?.[0]?.message;
    // Some reasoning models leave `content` empty; the JSON is then inside
    // `reasoning`, which extractJson() can still recover.
    const text = (msg?.content?.trim() ? msg.content : msg?.reasoning) ?? "";
    if (text.trim()) return text;
    console.error("[ai:" + id + "]", candidate, "empty response — trying next model");
  }
  return null;
}

/**
 * Tries every configured provider in order and returns the first usable reply.
 * Callers fall back to the built-in generator only when all of them fail.
 */
async function callProvider(messages: ChatMessage[], maxTokens = 3000): Promise<string | null> {
  for (const step of buildChain()) {
    const key = keyFor(step.id);
    if (!key) continue;
    try {
      const text =
        step.id === "gemini"
          ? await callGemini(key, step.model, messages, maxTokens)
          : step.id === "anthropic"
            ? await callAnthropic(key, step.model, messages, maxTokens)
            : await callOpenAICompatible(step.id, key, step.model, messages, maxTokens);
      if (text && text.trim()) return text;
    } catch (err) {
      console.error("[ai:" + step.id + "]", err instanceof Error ? err.message : err);
    }
  }
  return null;
}

function extractJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json/gi, "```").split("```").filter(Boolean);
  const candidates = [raw, ...cleaned];
  for (const c of candidates) {
    const start = Math.min(
      ...[c.indexOf("["), c.indexOf("{")].filter((n) => n >= 0).concat([Number.MAX_SAFE_INTEGER]),
    );
    if (start === Number.MAX_SAFE_INTEGER) continue;
    const end = Math.max(c.lastIndexOf("]"), c.lastIndexOf("}"));
    if (end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1)) as T;
    } catch {
      /* try next */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type QuestionType =
  | "mcq"
  | "multi_select"
  | "true_false"
  | "short_answer"
  | "fill_blank"
  | "matching"
  | "ordering"
  | "ranking"
  | "image_choice"
  | "scenario"
  | "case_based"
  | "poll"
  | "hotspot"
  | "slider"
  | "word_cloud"
  | "audio"
  | "video"
  | "word_jumble"
  | "odd_one_out"
  | "categorize"
  | "crossword"
  | "analogy"
  | "riddle";

export const QUESTION_TYPES: { value: QuestionType; label: string; labelBn: string }[] = [
  { value: "mcq", label: "MCQ", labelBn: "বহুনির্বাচনি" },
  { value: "multi_select", label: "Multiple Select", labelBn: "একাধিক নির্বাচন" },
  { value: "true_false", label: "True / False", labelBn: "সত্য/মিথ্যা" },
  { value: "short_answer", label: "Short Answer", labelBn: "সংক্ষিপ্ত উত্তর" },
  { value: "fill_blank", label: "Fill in the Blank", labelBn: "শূন্যস্থান পূরণ" },
  { value: "matching", label: "Matching", labelBn: "মিলকরণ" },
  { value: "ordering", label: "Ordering", labelBn: "ক্রম সাজানো" },
  { value: "ranking", label: "Ranking", labelBn: "র‍্যাংকিং" },
  { value: "image_choice", label: "Image Choice", labelBn: "ছবি নির্বাচন" },
  { value: "scenario", label: "Scenario", labelBn: "পরিস্থিতি" },
  { value: "case_based", label: "Case Based", labelBn: "কেস স্টাডি" },
  { value: "poll", label: "Poll", labelBn: "মতামত" },
  { value: "hotspot", label: "Hotspot", labelBn: "হটস্পট" },
  { value: "slider", label: "Slider", labelBn: "স্লাইডার" },
  { value: "word_cloud", label: "Word Cloud", labelBn: "ওয়ার্ড ক্লাউড" },
  { value: "audio", label: "Audio", labelBn: "অডিও" },
  { value: "video", label: "Video", labelBn: "ভিডিও" },
  { value: "word_jumble", label: "Word Jumble", labelBn: "🧩 শব্দ সাজানো" },
  { value: "odd_one_out", label: "Odd One Out", labelBn: "🧩 বেমানান খুঁজুন" },
  { value: "categorize", label: "Categorize", labelBn: "🧩 শ্রেণিবিন্যাস" },
  { value: "crossword", label: "Crossword Clue", labelBn: "🧩 শব্দজট" },
  { value: "analogy", label: "Analogy", labelBn: "🧩 সাদৃশ্য" },
  { value: "riddle", label: "Riddle", labelBn: "🧩 ধাঁধা" },
];

/** Puzzle-style types get a dedicated interactive player UI. */
export const PUZZLE_TYPES: QuestionType[] = [
  "word_jumble", "odd_one_out", "categorize", "crossword", "analogy", "riddle",
  "matching", "ordering", "ranking",
];

export type GeneratedQuestion = {
  text: string;
  type: QuestionType;
  options: string[];
  correct: (string | number)[];
  explanation: string;
  hint: string;
  objective: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  timer: number;
  language: string;
};

export type GenerateParams = {
  count: number;
  subject?: string;
  chapter?: string;
  topic?: string;
  className?: string;
  trade?: string;
  language: "bn" | "en" | "mixed";
  types: QuestionType[];
  difficulty: "easy" | "medium" | "hard" | "custom";
  distribution?: { easy: number; medium: number; hard: number };
  marks: number;
  timer: number;
  withExplanation: boolean;
  withHint: boolean;
  objective?: string;
  documentText?: string;
};

/* ------------------------------------------------------------------ */
/* Built-in generator (works with zero configuration)                  */
/* ------------------------------------------------------------------ */

function pickDifficulty(params: GenerateParams, index: number): "easy" | "medium" | "hard" {
  if (params.difficulty !== "custom") return params.difficulty;
  const d = params.distribution ?? { easy: 34, medium: 33, hard: 33 };
  const total = Math.max(1, d.easy + d.medium + d.hard);
  const pos = ((index % total) / total) * 100;
  if (pos < (d.easy / total) * 100) return "easy";
  if (pos < ((d.easy + d.medium) / total) * 100) return "medium";
  return "hard";
}

function sentencesFrom(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35 && s.length < 320);
}

function keywords(text: string): string[] {
  const stop = new Set(
    ("the a an and or of to in is are was were for with on at by from that this it as be can will " +
      "chapter unit lesson page pages figure table section example exercise question answer note " +
      "অধ্যায় পাঠ পৃষ্ঠা চিত্র সারণি উদাহরণ প্রশ্ন উত্তর একক").split(" "),
  );
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

const BN_STEMS = [
  "কোনটি সঠিক সংজ্ঞা",
  "নিচের কোনটি সবচেয়ে গুরুত্বপূর্ণ বৈশিষ্ট্য",
  "কোন ক্ষেত্রে ব্যবহার করা হয়",
  "নিচের কোনটি সঠিক নয়",
  "প্রধান উদ্দেশ্য কী",
  "কোন ধাপটি প্রথমে আসে",
  "কোনটি উদাহরণ",
  "কোন উপাদানটি প্রয়োজন",
];
const EN_STEMS = [
  "Which statement best defines",
  "Which is the most important characteristic of",
  "In which situation do we use",
  "Which of the following is NOT true about",
  "What is the main purpose of",
  "Which step comes first in",
  "Which of these is an example of",
  "Which component is required for",
];

function builtinQuestions(params: GenerateParams): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  const topic = params.topic || params.chapter || params.subject || "সাধারণ জ্ঞান";
  const docSentences = params.documentText ? sentencesFrom(params.documentText) : [];
  const docKeywords = params.documentText ? keywords(params.documentText) : [];
  const types = params.types.length ? params.types : (["mcq"] as QuestionType[]);

  for (let i = 0; i < params.count; i++) {
    const type = types[i % types.length];
    const difficulty = pickDifficulty(params, i);
    const useBn =
      params.language === "bn" || (params.language === "mixed" && i % 2 === 0) ? true : false;
    const stem = useBn ? BN_STEMS[i % BN_STEMS.length] : EN_STEMS[i % EN_STEMS.length];
    const focus = docKeywords.length
      ? docKeywords[i % Math.min(docKeywords.length, 40)]
      : `${topic}`;
    const source = docSentences.length ? docSentences[i % docSentences.length] : "";

    let text: string;
    let options: string[] = [];
    let correct: (string | number)[] = [];

    const base = useBn
      ? `${topic} — "${focus}" সম্পর্কে ${stem}?`
      : `${stem} "${focus}" in ${topic}?`;

    switch (type) {
      case "true_false":
        text = useBn
          ? `সত্য নাকি মিথ্যা: ${source || `${topic} বিষয়ে "${focus}" একটি গুরুত্বপূর্ণ ধারণা।`}`
          : `True or False: ${source || `"${focus}" is an important concept in ${topic}.`}`;
        options = useBn ? ["সত্য", "মিথ্যা"] : ["True", "False"];
        correct = [i % 3 === 2 ? 1 : 0];
        break;
      case "fill_blank":
        text = useBn
          ? `শূন্যস্থান পূরণ করুন: ${topic}-এ ______ ধারণাটি "${focus}" ব্যাখ্যা করে।`
          : `Fill in the blank: In ${topic}, the ______ concept explains "${focus}".`;
        options = [];
        correct = [focus];
        break;
      case "short_answer":
        text = useBn
          ? `সংক্ষেপে ব্যাখ্যা করুন: ${topic}-এ "${focus}" কী?`
          : `Briefly explain: what is "${focus}" in ${topic}?`;
        options = [];
        correct = [focus];
        break;
      case "matching":
        text = useBn ? `${topic}: সঠিক জোড়া মিলান।` : `${topic}: match the correct pairs.`;
        options = [
          `${focus} → ${useBn ? "সংজ্ঞা" : "definition"}`,
          `${topic} → ${useBn ? "প্রয়োগ" : "application"}`,
          `${useBn ? "উদাহরণ" : "example"} → ${focus}`,
        ];
        correct = [0, 1, 2];
        break;
      case "ordering":
      case "ranking":
        text = useBn
          ? `${topic} — "${focus}" প্রক্রিয়ার ধাপগুলো সঠিক ক্রমে সাজান।`
          : `${topic} — arrange the steps of "${focus}" in the correct order.`;
        options = useBn
          ? ["পরিকল্পনা", "প্রস্তুতি", "বাস্তবায়ন", "যাচাই"]
          : ["Plan", "Prepare", "Implement", "Verify"];
        correct = [0, 1, 2, 3];
        break;
      case "slider":
        text = useBn
          ? `${topic}: "${focus}" এর আনুমানিক মান কত (0-100)?`
          : `${topic}: estimate the value of "${focus}" (0-100).`;
        options = ["0", "100"];
        correct = [50 + (i % 5) * 5];
        break;
      case "word_cloud":
      case "poll":
        text = useBn
          ? `${topic} সম্পর্কে "${focus}" নিয়ে আপনার মতামত লিখুন।`
          : `Share your view about "${focus}" in ${topic}.`;
        options = useBn
          ? ["খুব দরকারি", "মোটামুটি", "কঠিন", "আরও অনুশীলন দরকার"]
          : ["Very useful", "Okay", "Difficult", "Need practice"];
        correct = [];
        break;
      case "scenario":
      case "case_based":
        text = useBn
          ? `পরিস্থিতি: পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজের ল্যাবে ${topic} নিয়ে কাজ করার সময় "${focus}" সমস্যা দেখা দিল। সবচেয়ে সঠিক পদক্ষেপ কোনটি?`
          : `Scenario: While working on ${topic} in the PGTSC lab, an issue with "${focus}" appears. What is the best action?`;
        options = useBn
          ? [
              `${focus} যাচাই করে ধাপে ধাপে সমস্যা নির্ণয় করা`,
              "সব সংযোগ খুলে নতুন করে শুরু করা",
              "সমস্যাটি উপেক্ষা করা",
              "যন্ত্রটি বদলে ফেলা",
            ]
          : [
              `Diagnose step by step by checking ${focus}`,
              "Disconnect everything and restart",
              "Ignore the problem",
              "Replace the device immediately",
            ];
        correct = [0];
        break;
      case "image_choice":
      case "hotspot":
      case "audio":
      case "video":
        text = useBn
          ? `${topic}: নিচের মিডিয়া দেখে "${focus}" সম্পর্কিত সঠিক উত্তরটি বাছাই করুন।`
          : `${topic}: review the media and choose the correct answer about "${focus}".`;
        options = useBn
          ? [`সঠিক ${focus}`, `ভুল উপস্থাপন`, `অসম্পূর্ণ উদাহরণ`, `সম্পর্কহীন`]
          : [`Correct ${focus}`, "Wrong representation", "Incomplete example", "Unrelated"];
        correct = [0];
        break;
      case "word_jumble": {
        const word = String(focus).replace(/[^\p{L}\p{N}]/gu, "").toUpperCase().slice(0, 12) || "PGTSC";
        const scrambled = word.split("").sort(() => Math.random() - 0.5).join(" ");
        text = useBn
          ? `${topic}: অক্ষরগুলো সাজিয়ে সঠিক শব্দটি লিখুন — ${scrambled}`
          : `${topic}: unscramble the letters to form the correct word — ${scrambled}`;
        options = word.split("");
        correct = [word];
        break;
      }
      case "odd_one_out": {
        const kin = docKeywords.length
          ? docKeywords.slice(0, 12).filter((k) => k !== focus).slice(0, 3)
          : [];
        const siblings = kin.length >= 3 ? kin : useBn
          ? ["ধারণা", "প্রয়োগ", "উদাহরণ"]
          : ["concept", "application", "example"];
        text = useBn
          ? `${topic}: নিচের কোনটি বাকিগুলোর সাথে বেমানান?`
          : `${topic}: which one does NOT belong with the others?`;
        options = [...siblings, focus];
        correct = [3];
        break;
      }
      case "categorize": {
        const bucketA = useBn ? "মৌলিক ধারণা" : "Core concept";
        const bucketB = useBn ? "ব্যবহারিক প্রয়োগ" : "Practical use";
        const extra = docKeywords.slice(0, 8).filter((k) => k !== focus);
        const items = [focus, extra[0] ?? topic, extra[1] ?? `${topic} tool`, extra[2] ?? `${focus} demo`];
        text = useBn
          ? `${topic}: প্রতিটি বিষয় সঠিক শ্রেণিতে ফেলুন।`
          : `${topic}: place each item into the correct category.`;
        options = items;
        correct = [bucketA, bucketA, bucketB, bucketB];
        break;
      }
      case "crossword": {
        const answer = String(focus).replace(/[^\p{L}\p{N}]/gu, "").toUpperCase().slice(0, 14) || "PGTSC";
        text = useBn
          ? `শব্দজট সূত্র: ${topic}-এ যে ধারণাটি মূল ভূমিকা রাখে (${answer.length} অক্ষর)`
          : `Crossword clue: the concept central to ${topic} (${answer.length} letters)`;
        options = [];
        correct = [answer];
        break;
      }
      case "analogy": {
        const other = docKeywords[(i + 3) % Math.max(1, docKeywords.length)] ?? topic;
        text = useBn
          ? `সাদৃশ্য: ${topic} : ${focus} :: ${other} : ?`
          : `Analogy: ${topic} : ${focus} :: ${other} : ?`;
        options = useBn
          ? [`${other}-এর মূল বৈশিষ্ট্য`, "সম্পর্কহীন ধারণা", "বিপরীত ধারণা", "এলোমেলো উদাহরণ"]
          : [`core property of ${other}`, "unrelated idea", "opposite idea", "random example"];
        correct = [0];
        break;
      }
      case "riddle": {
        text = useBn
          ? `ধাঁধা: আমি ${topic}-এর একটি অংশ, ${source ? "আমাকে ছাড়া কাজ অসম্পূর্ণ" : "আমি মূল ভিত্তি"}। আমি কে?`
          : `Riddle: I am part of ${topic} and nothing works without me. What am I?`;
        options = [];
        correct = [focus];
        break;
      }
      case "multi_select":
        text = useBn
          ? `${topic} — "${focus}" সম্পর্কে সঠিক বক্তব্যগুলো নির্বাচন করুন (একাধিক)।`
          : `${topic} — select all correct statements about "${focus}".`;
        options = useBn
          ? [
              `${focus} একটি মৌলিক ধারণা`,
              `${focus} ব্যবহারিক কাজে প্রয়োগ হয়`,
              `${focus} সম্পূর্ণ অপ্রয়োজনীয়`,
              `${focus} শুধুমাত্র তত্ত্বীয়`,
            ]
          : [
              `${focus} is a core concept`,
              `${focus} has practical applications`,
              `${focus} is completely unnecessary`,
              `${focus} is purely theoretical`,
            ];
        correct = [0, 1];
        break;
      default:
        text = base;
        options = useBn
          ? [
              `${focus} — সঠিক ও পূর্ণাঙ্গ ব্যাখ্যা`,
              `${focus} — আংশিক সঠিক ব্যাখ্যা`,
              `${focus} — সম্পর্কহীন ব্যাখ্যা`,
              `${focus} — ভুল ব্যাখ্যা`,
            ]
          : [
              `${focus} — accurate and complete description`,
              `${focus} — partially correct description`,
              `${focus} — unrelated description`,
              `${focus} — incorrect description`,
            ];
        correct = [0];
    }

    const timerByDifficulty = suggestTimer(difficulty, type, params.timer);

    out.push({
      text,
      type,
      options,
      correct,
      explanation: params.withExplanation
        ? useBn
          ? `${source ? source + " " : ""}সঠিক উত্তরটি "${focus}" ধারণার মূল বৈশিষ্ট্য সঠিকভাবে প্রকাশ করে। অন্য বিকল্পগুলো আংশিক বা ভুল।`
          : `${source ? source + " " : ""}The correct option captures the core property of "${focus}". Other options are partial or incorrect.`
        : "",
      hint: params.withHint
        ? useBn
          ? `"${focus}" এর সংজ্ঞা ও ব্যবহারিক প্রয়োগ মনে করুন।`
          : `Recall the definition and practical use of "${focus}".`
        : "",
      objective:
        params.objective ||
        (useBn
          ? `শিক্ষার্থী ${topic} বিষয়ে "${focus}" ব্যাখ্যা করতে পারবে।`
          : `Student can explain "${focus}" within ${topic}.`),
      difficulty,
      marks: params.marks * (difficulty === "hard" ? 2 : difficulty === "medium" ? 1 : 1),
      timer: Math.min(300, Math.max(5, timerByDifficulty)),
      language: useBn ? "bn" : "en",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Public AI functions                                                 */
/* ------------------------------------------------------------------ */

export async function generateQuestions(params: GenerateParams): Promise<GeneratedQuestion[]> {
  const info = getProviderInfo();
  if (info.configured) {
    const prompt = `Generate exactly ${params.count} exam questions as a JSON array.
Context: school = Panchagarh Government Technical School and College (Bangladesh).
Class: ${params.className ?? "-"} | Trade: ${params.trade ?? "-"} | Subject: ${params.subject ?? "-"} | Chapter: ${params.chapter ?? "-"} | Topic: ${params.topic ?? "-"}
Language: ${params.language} (bn = Bangla, mixed = alternate Bangla/English)
Allowed question types: ${params.types.join(", ")}
Difficulty: ${params.difficulty}${params.distribution ? ` distribution ${JSON.stringify(params.distribution)}` : ""}
Each item: {"text","type","options":[],"correct":[index or string],"explanation","hint","objective","difficulty","marks","timer","language"}
${params.withExplanation ? "Include a clear explanation." : "explanation can be empty."}
${params.withHint ? "Include a helpful hint." : "hint can be empty."}
${params.documentText ? `Base questions strictly on this source content:\n${params.documentText.slice(0, 12000)}` : ""}
Return ONLY the JSON array.`;
    const raw = await callProvider(
      [
        {
          role: "system",
          content:
            "You are an expert Bangladeshi technical school exam item writer. Output strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
      8000,
    );
    const parsed = extractJson<GeneratedQuestion[]>(raw);
    if (parsed && Array.isArray(parsed) && parsed.length) {
      return parsed.slice(0, params.count).map((q) => shuffleOptions({
        ...q,
        type: (q.type ?? "mcq") as QuestionType,
        options: Array.isArray(q.options) ? q.options : [],
        correct: Array.isArray(q.correct) ? q.correct : [0],
        marks: Number(q.marks) || params.marks,
        // Harder questions need longer; teachers can still edit each one later.
        timer: Number(q.timer) || suggestTimer(q.difficulty ?? "medium", q.type ?? "mcq", params.timer),
        difficulty: (q.difficulty as "easy") ?? "medium",
        language: q.language ?? params.language,
        explanation: q.explanation ?? "",
        hint: q.hint ?? "",
        objective: q.objective ?? "",
      }) );
    }
  }
  return builtinQuestions(params);
}

/**
 * LLMs favour the first couple of option slots. Shuffling server-side keeps
 * the correct answer position unpredictable so students cannot guess by habit.
 * Order-sensitive types are left untouched.
 */
const SHUFFLE_SAFE = new Set([
  "mcq",
  "multi_select",
  "true_false",
  "image_choice",
  "scenario",
  "case_based",
  "odd_one_out",
  "analogy",
  "poll",
]);

/** Suggested reading+answering time, scaled by difficulty and question type. */
export function suggestTimer(difficulty: string, type: string, base = 30): number {
  const byDifficulty = difficulty === "hard" ? 1.7 : difficulty === "easy" ? 0.75 : 1;
  const byType =
    type === "true_false"
      ? 0.6
      : ["short_answer", "fill_blank", "riddle", "crossword", "word_jumble"].includes(type)
        ? 1.5
        : ["matching", "ordering", "ranking", "categorize", "case_based", "scenario"].includes(type)
          ? 1.8
          : 1;
  return Math.max(5, Math.min(300, Math.round((base * byDifficulty * byType) / 5) * 5));
}

export function shuffleOptions(q: GeneratedQuestion): GeneratedQuestion {
  if (!SHUFFLE_SAFE.has(q.type) || q.options.length < 2) return q;
  // True/False must stay in its natural order to read correctly.
  if (q.type === "true_false") return q;
  const correctIdx = new Set(
    q.correct
      .map((c) => (typeof c === "number" ? c : q.options.findIndex((o) => o === c)))
      .filter((n) => n >= 0 && n < q.options.length),
  );
  if (!correctIdx.size) return q;

  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const options = order.map((i) => q.options[i]);
  const correct = order
    .map((orig, next) => (correctIdx.has(orig) ? next : -1))
    .filter((n) => n >= 0)
    .sort((a, b) => a - b);
  return { ...q, options, correct };
}

export type QualityFlag = { code: string; severity: "info" | "warn" | "error"; message: string };

export function qualityCheck(q: GeneratedQuestion, others: GeneratedQuestion[]): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const duplicates = others.filter((o) => o !== q && norm(o.text) === norm(q.text));
  if (duplicates.length) flags.push({ code: "duplicate", severity: "error", message: "ডুপ্লিকেট প্রশ্ন পাওয়া গেছে" });
  const optSet = new Set(q.options.map(norm));
  if (q.options.length && optSet.size !== q.options.length)
    flags.push({ code: "duplicate_option", severity: "error", message: "একই রকম অপশন রয়েছে" });
  if (["mcq", "image_choice", "scenario", "case_based"].includes(q.type)) {
    if (q.options.length < 2)
      flags.push({ code: "too_few_options", severity: "error", message: "কমপক্ষে ২টি অপশন দরকার" });
    if (q.correct.length !== 1)
      flags.push({ code: "multi_correct", severity: "error", message: "MCQ-তে একাধিক সঠিক উত্তর" });
  }
  if (q.type === "multi_select" && q.correct.length < 2)
    flags.push({ code: "single_correct", severity: "warn", message: "Multi-select-এ ১টি মাত্র উত্তর" });
  if (!q.correct.length && !["poll", "word_cloud"].includes(q.type))
    flags.push({ code: "no_answer", severity: "error", message: "সঠিক উত্তর নেই" });
  if (q.text.trim().length < 12)
    flags.push({ code: "ambiguous", severity: "warn", message: "প্রশ্নটি খুব ছোট/অস্পষ্ট" });
  if (!/[?？।:]$/.test(q.text.trim()) && !["fill_blank", "word_cloud", "poll"].includes(q.type))
    flags.push({ code: "grammar", severity: "info", message: "প্রশ্নের শেষে প্রশ্নবোধক চিহ্ন নেই" });
  if (!q.explanation) flags.push({ code: "no_explanation", severity: "info", message: "ব্যাখ্যা নেই" });
  if (q.timer < 5 || q.timer > 300)
    flags.push({ code: "timer", severity: "warn", message: "টাইমার সীমার বাইরে" });
  return flags;
}

export async function transformQuestion(
  q: GeneratedQuestion,
  action: "improve" | "easier" | "harder" | "explanation" | "hint" | "regenerate",
): Promise<GeneratedQuestion> {
  const info = getProviderInfo();
  if (info.configured) {
    const raw = await callProvider(
      [
        { role: "system", content: "You rewrite exam questions. Output strict JSON object only." },
        {
          role: "user",
          content: `Action: ${action}. Rewrite this question keeping the same JSON shape.\n${JSON.stringify(q)}`,
        },
      ],
      1500,
    );
    const parsed = extractJson<GeneratedQuestion>(raw);
    if (parsed && parsed.text) return { ...q, ...parsed };
  }
  const bn = q.language !== "en";
  switch (action) {
    case "easier":
      return {
        ...q,
        difficulty: "easy",
        timer: Math.min(300, q.timer + 10),
        text: bn ? `(সহজ) ${q.text}` : `(Easier) ${q.text}`,
        hint: q.hint || (bn ? "মূল সংজ্ঞাটি মনে করুন।" : "Recall the basic definition."),
      };
    case "harder":
      return {
        ...q,
        difficulty: "hard",
        marks: q.marks * 2,
        timer: Math.max(5, q.timer - 5),
        text: bn ? `(কঠিন, বিশ্লেষণমূলক) ${q.text}` : `(Harder, analytical) ${q.text}`,
      };
    case "explanation":
      return {
        ...q,
        explanation:
          q.explanation ||
          (bn
            ? "সঠিক উত্তরটি মূল ধারণার সাথে সবচেয়ে বেশি সঙ্গতিপূর্ণ; বাকিগুলো আংশিক বা ভুল।"
            : "The correct option matches the core concept; the rest are partial or wrong."),
      };
    case "hint":
      return {
        ...q,
        hint: q.hint || (bn ? "মূল কীওয়ার্ডটি খুঁজুন।" : "Look for the key term."),
      };
    case "regenerate": {
      const [fresh] = builtinQuestions({
        count: 1,
        language: (q.language as "bn") ?? "bn",
        types: [q.type],
        difficulty: q.difficulty,
        marks: q.marks,
        timer: q.timer,
        withExplanation: true,
        withHint: true,
        topic: q.objective,
      });
      return fresh ?? q;
    }
    default:
      return {
        ...q,
        text: q.text.replace(/\s+/g, " ").trim(),
        explanation: q.explanation || (bn ? "সঠিক উত্তরের যৌক্তিক ব্যাখ্যা।" : "Rationale for the correct answer."),
      };
  }
}

export { DEFAULT_TEMPLATE, mergeTemplate, THEME_PRESETS } from "./theme";
export type { TemplateConfig } from "./theme";
import { DEFAULT_TEMPLATE, THEME_PRESETS, mergeTemplate, shade, type TemplateConfig } from "./theme";

export async function generateTemplate(prompt: string): Promise<TemplateConfig> {
  const info = getProviderInfo();
  if (info.configured) {
    const raw = await callProvider(
      [
        {
          role: "system",
          content:
            "You design vivid animated quiz themes. Output strict JSON only, matching the given keys exactly.",
        },
        {
          role: "user",
          content: `Design a quiz theme for: "${prompt}".
Return JSON with these keys: ${Object.keys(DEFAULT_TEMPLATE).join(", ")}.
backgroundMotion must be one of: static, aurora, mesh, gradient_shift, waves, grid_pulse, starfield, bubbles, neon_rings, confetti_rain, spotlight, circuit.
particles: none, sparkles, bokeh, snow, embers, petals, stars, bubbles, code.
questionCard: elevated, glass, outline, solid, neon, paper.
answerStyle: grid, pill, 3d, glass, neon, flat, outline.
timerStyle: circular, linear, digital, flip, pulse, minimal, ring_glow.
transition: fade, slide, zoom, scale, flip, reveal, cube, swipe.
resultAnimation: trophy, confetti, fireworks, minimal, rays, coins.
font: sans, rounded, serif, mono, display.
answerPalette must be 6 vivid hex colours with good contrast against white text.
background must be a CSS gradient string. Keep formal/exam themes calm (motion low, static background).`,
        },
      ],
      1200,
    );
    const parsed = extractJson<Partial<TemplateConfig>>(raw);
    if (parsed && parsed.primary) return mergeTemplate({ ...parsed, name: parsed.name || prompt.slice(0, 48) });
  }

  const p = prompt.toLowerCase();
  const has = (...words: string[]) => words.some((w) => p.includes(w));

  // Score every built-in preset against the prompt, then remix the winner.
  const KEYWORDS: Record<string, string[]> = {
    "Neon Arcade": ["neon", "arcade", "নিয়ন", "gaming", "game", "cyber", "glow"],
    "Aurora Dream": ["aurora", "dream", "অরোরা", "calm", "science", "বিজ্ঞান", "soft"],
    "Rainbow Playground": ["rainbow", "রঙিন", "colorful", "kid", "শিশু", "fun", "মজা", "playful"],
    "Cyber Circuit": ["circuit", "electronic", "ইলেকট্রনিক", "iot", "robot", "সার্কিট", "chip"],
    "Voltage Storm": ["voltage", "electric", "ইলেকট্রিক", "power", "storm", "energy", "বিদ্যুৎ"],
    "Ocean Wave": ["ocean", "wave", "সমুদ্র", "water", "blue", "নীল", "language", "ভাষা"],
    "Galaxy Quest": ["galaxy", "space", "মহাকাশ", "star", "তারা", "futur", "ফিউচার", "cosmic"],
    "Sunset Festival": ["festival", "উৎসব", "boishakh", "বৈশাখ", "sunset", "celebration", "pohela"],
    "Winter Frost": ["winter", "শীত", "snow", "তুষার", "frost", "ice", "cool"],
    "Golden Championship": ["champion", "চ্যাম্পিয়ন", "gold", "সোনা", "tournament", "টুর্নামেন্ট", "competition", "প্রতিযোগিতা", "trophy"],
    "Mint Fresh": ["mint", "fresh", "green", "সবুজ", "math", "গণিত", "clean"],
    "Candy Pop": ["candy", "pop", "pink", "গোলাপি", "cute", "sweet", "pastel"],
    "Exam Hall": ["exam", "পরীক্ষা", "formal", "ফরমাল", "serious", "board"],
    "Board Professional": ["professional", "প্রফেশনাল", "corporate", "office", "minimal", "সাধারণ"],
    "Computer Lab": ["computer", "কম্পিউটার", "coding", "programming", "lab", "html", "software"],
  };

  let best = THEME_PRESETS.find((t) => t.name === "Aurora Dream") ?? THEME_PRESETS[0];
  let bestScore = 0;
  for (const preset of THEME_PRESETS) {
    const words = KEYWORDS[preset.name] ?? [];
    const score = words.reduce((acc, w) => acc + (p.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = preset;
    }
  }

  const cfg = mergeTemplate(best);

  // Explicit colour requests override the preset palette.
  const COLOR_HINTS: Record<string, [string, string, string]> = {
    blue: ["#2563eb", "#38bdf8", "#60a5fa"],
    নীল: ["#2563eb", "#38bdf8", "#60a5fa"],
    red: ["#dc2626", "#f87171", "#fb923c"],
    লাল: ["#dc2626", "#f87171", "#fb923c"],
    green: ["#16a34a", "#4ade80", "#22d3ee"],
    সবুজ: ["#16a34a", "#4ade80", "#22d3ee"],
    purple: ["#7c3aed", "#c084fc", "#f0abfc"],
    বেগুনি: ["#7c3aed", "#c084fc", "#f0abfc"],
    orange: ["#ea580c", "#fb923c", "#fbbf24"],
    কমলা: ["#ea580c", "#fb923c", "#fbbf24"],
    pink: ["#db2777", "#f472b6", "#c084fc"],
    গোলাপি: ["#db2777", "#f472b6", "#c084fc"],
    gold: ["#f0b429", "#fde68a", "#fbbf24"],
    সোনালি: ["#f0b429", "#fde68a", "#fbbf24"],
  };
  for (const [word, [pri, acc, sec]] of Object.entries(COLOR_HINTS)) {
    if (p.includes(word)) {
      cfg.primary = pri;
      cfg.accent = acc;
      cfg.secondary = sec;
      cfg.background = `linear-gradient(140deg, ${shade(pri, -70)}, ${shade(pri, -35)} 55%, ${shade(sec, -25)})`;
      break;
    }
  }

  const calm = has("minimal", "exam", "পরীক্ষা", "professional", "প্রফেশনাল", "ন্যূনতম", "calm", "serious");
  const loud = has("animated", "অ্যানিমেটেড", "colorful", "রঙিন", "vibrant", "energetic", "উজ্জ্বল", "fun");

  if (calm) {
    cfg.backgroundMotion = "static";
    cfg.particles = "none";
    cfg.motion = "low";
    cfg.transition = "fade";
    cfg.resultAnimation = "minimal";
    cfg.timerStyle = "minimal";
    cfg.glow = false;
    cfg.sound = false;
  } else if (loud) {
    cfg.motion = "high";
    cfg.motionSpeed = 1.4;
    cfg.particleDensity = Math.max(cfg.particleDensity, 60);
    cfg.glow = true;
    if (cfg.particles === "none") cfg.particles = "sparkles";
    if (cfg.backgroundMotion === "static") cfg.backgroundMotion = "gradient_shift";
  }

  cfg.name = prompt.trim().slice(0, 48) || `${best.name} Remix`;
  cfg.category = has("math", "গণিত")
    ? "mathematics"
    : has("comput", "কম্পিউটার", "coding")
      ? "computer"
      : has("exam", "পরীক্ষা")
        ? "examination"
        : has("kid", "শিশু")
          ? "kids"
          : has("festival", "উৎসব")
            ? "festival"
            : (best.category ?? "academic");

  return cfg;
}

/* ------------------------------------------------------------------ */
/* Presentation outline                                                */
/* ------------------------------------------------------------------ */

type OutlineSlide = {
  id: string;
  layout: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  icon?: string;
  anim: string;
  elementAnim?: string;
  stagger?: number;
  note?: string;
  /** Photo hint the teacher can act on; never auto-embedded. */
  searchTerm?: string;
  media?: { kind: string; url: string; position: string; fit: string; dim: number };
};

const SLIDE_ICONS = ["🎓", "📚", "💡", "🔍", "⚙️", "📊", "🎯", "🚀", "🧩", "✅", "🌟", "🙏"];

function sid(i: number) {
  return `s_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function generateOutline(opts: {
  topic: string;
  count: number;
  language: string;
  audience?: string;
}): Promise<OutlineSlide[]> {
  const { topic, count, language, audience } = opts;
  const info = getProviderInfo();

  if (info.configured) {
    const raw = await callProvider(
      [
        {
          role: "system",
          content:
            "You are an expert teacher who designs clear, engaging lecture slides. Output strict JSON only.",
        },
        {
          role: "user",
          content: `Design a polished ${count}-slide lecture deck about "${topic}".
${audience ? `Audience: ${audience}.` : ""}
Language: ${language === "en" ? "English" : language === "mixed" ? "mix Bangla and English" : "Bangla"}.

Return a JSON array. Each item:
{"layout","title","subtitle","bullets":["..."],"icon","note","elementAnim","searchTerm"}

layout: title | section | bullets | two_column | comparison | big_number | quote | timeline | closing
elementAnim: fade_up | fade_in | slide_left | slide_right | zoom_in | pop | flip_in | blur_in
searchTerm: 2-4 English words describing an ideal photo for this slide (or "" if none needed)

Design rules for a high-quality deck:
- Slide 1 = "title" with a punchy headline and a one-line subtitle.
- Last slide = "closing".
- VARY the layouts: include at least one "big_number" with a real statistic,
  one "comparison" or "two_column", and one "timeline" or "quote" if it fits.
- Never use the same layout more than twice in a row.
- Bullets: 3-5 items, each under 12 words, no full sentences, no trailing periods.
- Leave bullets [] for title / quote / big_number / closing.
- Titles under 8 words. Make them specific, not generic ("কেন LAN দ্রুত?" not "আলোচনা").
- icon: one emoji that genuinely matches the slide topic.
- note: one practical sentence telling the teacher what to say or ask.
- Vary elementAnim across slides so the deck feels alive.

Return ONLY the JSON array.`,
        },
      ],
      6000,
    );
    const parsed = extractJson<OutlineSlide[]>(raw);
    if (parsed && Array.isArray(parsed) && parsed.length) {
      const ELEMENT = ["fade_up", "slide_left", "zoom_in", "fade_in", "pop", "blur_in"];
      return parsed.slice(0, count).map((sl, i) => ({
        id: sid(i),
        layout: typeof sl.layout === "string" ? sl.layout : "bullets",
        title: String(sl.title ?? `স্লাইড ${i + 1}`),
        subtitle: sl.subtitle ? String(sl.subtitle) : undefined,
        bullets: Array.isArray(sl.bullets) ? sl.bullets.map(String).slice(0, 6) : [],
        icon: sl.icon || SLIDE_ICONS[i % SLIDE_ICONS.length],
        anim: (["fade", "slide", "zoom", "reveal"] as const)[i % 4],
        elementAnim: ELEMENT.includes(String(sl.elementAnim)) ? String(sl.elementAnim) : ELEMENT[i % ELEMENT.length],
        stagger: 90,
        note: sl.note ? String(sl.note) : undefined,
        searchTerm: sl.searchTerm ? String(sl.searchTerm).slice(0, 60) : undefined,
        media: { kind: "none", url: "", position: "right", fit: "cover", dim: 55 },
      }));
    }
  }

  // Offline fallback: a sensible lecture skeleton the teacher can fill in.
  const bn = language !== "en";
  const sections = bn
    ? ["পরিচিতি", "মূল ধারণা", "কেন গুরুত্বপূর্ণ", "উদাহরণ", "ব্যবহারিক প্রয়োগ", "সাধারণ ভুল", "সারসংক্ষেপ"]
    : ["Introduction", "Core idea", "Why it matters", "Examples", "Applications", "Common mistakes", "Summary"];
  const out: OutlineSlide[] = [
    {
      id: sid(0),
      layout: "title",
      title: topic,
      subtitle: audience || (bn ? "শ্রেণি উপস্থাপনা" : "Class presentation"),
      bullets: [],
      icon: "🎓",
      anim: "zoom",
    },
  ];
  for (let i = 0; i < Math.max(1, count - 2); i++) {
    const label = sections[i % sections.length];
    out.push({
      id: sid(i + 1),
      layout: i % 4 === 3 ? "two_column" : "bullets",
      title: `${topic} — ${label}`,
      bullets: bn
        ? [`${label} সম্পর্কে মূল পয়েন্ট`, "উদাহরণ দিয়ে ব্যাখ্যা", "শিক্ষার্থীদের জন্য প্রশ্ন"]
        : [`Key point about ${label}`, "Explain with an example", "Question for students"],
      icon: SLIDE_ICONS[(i + 1) % SLIDE_ICONS.length],
      anim: (["fade", "slide", "zoom", "reveal"] as const)[i % 4],
      note: bn ? `${label} অংশটি ২-৩ মিনিটে ব্যাখ্যা করুন।` : `Explain ${label} in 2-3 minutes.`,
    });
  }
  out.push({
    id: sid(999),
    layout: "closing",
    title: bn ? "ধন্যবাদ" : "Thank you",
    subtitle: bn ? "প্রশ্ন থাকলে জিজ্ঞাসা করুন" : "Questions are welcome",
    bullets: [],
    icon: "🙏",
    anim: "fade",
  });
  return out.slice(0, count);
}

export async function summarizeFeedback(items: {
  overall: number;
  difficulty: number;
  timerRating: number;
  quality: number;
  engagement: number;
  comment?: string | null;
}[]): Promise<{ rating: number; liked: string[]; disliked: string[]; recommendations: string[] }> {
  if (!items.length)
    return { rating: 0, liked: [], disliked: [], recommendations: ["এখনো কোনো ফিডব্যাক নেই।"] };
  const avg = (k: keyof (typeof items)[0]) =>
    items.reduce((s, i) => s + Number(i[k] ?? 0), 0) / items.length;
  const overall = avg("overall");
  const difficulty = avg("difficulty");
  const timer = avg("timerRating");
  const quality = avg("quality");
  const engagement = avg("engagement");
  const info = getProviderInfo();
  if (info.configured) {
    const raw = await callProvider(
      [
        { role: "system", content: "You analyse student quiz feedback. Output strict JSON only." },
        {
          role: "user",
          content: `Summarise into {"rating","liked":[],"disliked":[],"recommendations":[]} (Bangla). Data: ${JSON.stringify(
            items.slice(0, 120),
          )}`,
        },
      ],
      900,
    );
    const parsed = extractJson<{ rating: number; liked: string[]; disliked: string[]; recommendations: string[] }>(raw);
    if (parsed && parsed.recommendations) return parsed;
  }
  const liked: string[] = [];
  const disliked: string[] = [];
  const recommendations: string[] = [];
  if (engagement >= 4) liked.push("কুইজটি আকর্ষণীয় ও উপভোগ্য ছিল");
  if (quality >= 4) liked.push("প্রশ্নের মান ভালো ছিল");
  if (overall >= 4) liked.push("সামগ্রিক অভিজ্ঞতা ইতিবাচক");
  if (timer < 3) {
    disliked.push("সময় কম মনে হয়েছে");
    recommendations.push("প্রতি প্রশ্নে টাইমার ১০-১৫ সেকেন্ড বাড়ান");
  }
  if (difficulty >= 4) {
    disliked.push("প্রশ্ন কঠিন মনে হয়েছে");
    recommendations.push("কঠিন প্রশ্নগুলো পুনরায় পর্যালোচনা করুন এবং ব্যাখ্যা যোগ করুন");
  }
  if (quality < 3) {
    disliked.push("কিছু প্রশ্ন অস্পষ্ট");
    recommendations.push("AI Quality Check চালিয়ে অস্পষ্ট প্রশ্ন ঠিক করুন");
  }
  if (!recommendations.length) recommendations.push("বর্তমান সেটিংস ভালো কাজ করছে — চালিয়ে যান");
  return { rating: Number(overall.toFixed(2)), liked, disliked, recommendations };
}

export async function teachingInsights(stats: Record<string, unknown>): Promise<string[]> {
  const info = getProviderInfo();
  if (info.configured) {
    const raw = await callProvider(
      [
        { role: "system", content: "You are a teaching coach. Output a JSON array of short Bangla insights." },
        { role: "user", content: JSON.stringify(stats).slice(0, 6000) },
      ],
      700,
    );
    const parsed = extractJson<string[]>(raw);
    if (parsed && Array.isArray(parsed)) return parsed;
  }
  const out: string[] = [];
  const avg = Number(stats.averageScore ?? 0);
  const participation = Number(stats.participation ?? 0);
  const accuracy = Number(stats.accuracy ?? 0);
  if (avg < 50) out.push("গড় স্কোর কম — পরবর্তী ক্লাসে মূল ধারণাগুলো পুনরায় ব্যাখ্যা করুন।");
  else if (avg > 85) out.push("শিক্ষার্থীরা ভালো করছে — কঠিন স্তরের প্রশ্ন যোগ করে চ্যালেঞ্জ বাড়ান।");
  else out.push("ফলাফল ভারসাম্যপূর্ণ — দুর্বল টপিকগুলোতে অতিরিক্ত অনুশীলন দিন।");
  if (participation < 70) out.push("অংশগ্রহণ কম — লাইভ কুইজ শুরুর আগে নোটিফিকেশন পাঠান।");
  if (accuracy < 60) out.push("নির্ভুলতা কম — সবচেয়ে বেশি ভুল হওয়া প্রশ্নগুলো ক্লাসে আলোচনা করুন।");
  const hardest = stats.hardestQuestion as string | undefined;
  if (hardest) out.push(`সবচেয়ে কঠিন প্রশ্ন: "${String(hardest).slice(0, 70)}" — এটি নিয়ে আলোচনা করুন।`);
  return out;
}

export async function smartQuizPlan(prompt: string): Promise<{
  title: string;
  className: string;
  subject: string;
  topic: string;
  difficulty: string;
  count: number;
  timer: number;
  marks: number;
  types: QuestionType[];
  template: string;
  notes: string[];
}> {
  const info = getProviderInfo();
  if (info.configured) {
    const raw = await callProvider(
      [
        { role: "system", content: "You plan quizzes. Output strict JSON only." },
        {
          role: "user",
          content: `From this teacher instruction produce {"title","className","subject","topic","difficulty","count","timer","marks","types":[],"template","notes":[]}: ${prompt}`,
        },
      ],
      800,
    );
    const parsed = extractJson<ReturnType<typeof fallbackPlan>>(raw);
    if (parsed && parsed.title) return parsed;
  }
  return fallbackPlan(prompt);
}

function fallbackPlan(prompt: string) {
  const countMatch = prompt.match(/(\d{1,4})\s*(questions|প্রশ্ন|টি)?/i);
  const count = countMatch ? Math.min(1000, Math.max(1, parseInt(countMatch[1], 10))) : 20;
  const lower = prompt.toLowerCase();
  const difficulty = lower.includes("hard") || prompt.includes("কঠিন")
    ? "hard"
    : lower.includes("easy") || prompt.includes("সহজ")
      ? "easy"
      : "medium";
  const classMatch = prompt.match(/class\s*(\d{1,2})|শ্রেণি\s*(\d{1,2})|(\d{1,2})\s*শ্রেণি/i);
  const className = classMatch ? `Class ${classMatch[1] ?? classMatch[2] ?? classMatch[3]}` : "Class 10";
  const subjects = ["computer", "mathematics", "electronics", "electrical", "english", "bangla", "iot", "physics"];
  const subject = subjects.find((s) => lower.includes(s)) ?? "computer";
  const topic = prompt
    .split(",")
    .map((s) => s.trim())
    .find((s) => s.length > 2 && !/\d/.test(s) && !subjects.includes(s.toLowerCase())) ?? subject;
  return {
    title: `${className} ${subject.toUpperCase()} — ${topic}`,
    className,
    subject,
    topic,
    difficulty,
    count,
    timer: difficulty === "hard" ? 45 : difficulty === "easy" ? 20 : 30,
    marks: difficulty === "hard" ? 2 : 1,
    types: ["mcq", "true_false", "multi_select"] as QuestionType[],
    template: difficulty === "hard" ? "Competition Arena" : "PGTSC Official",
    notes: [
      `${count}টি প্রশ্ন, ${difficulty} ডিফিকাল্টি প্রস্তাব করা হলো।`,
      "প্রতিটি প্রশ্নে ব্যাখ্যা যোগ করুন যাতে শিক্ষার্থীরা শিখতে পারে।",
      "প্রকাশের আগে অবশ্যই রিভিউ করুন।",
    ],
  };
}

export function extractTextFromUpload(name: string, buffer: Buffer): string {
  const lower = name.toLowerCase();
  const raw = buffer.toString("utf8");
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) return raw;
  if (lower.endsWith(".pdf")) {
    const chunks = raw.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
    const text = chunks
      .map((c) => c.slice(1, -1).replace(/\\(\d{3}|.)/g, " "))
      .join(" ")
      .replace(/\s+/g, " ");
    return text.length > 80 ? text : stripBinary(raw);
  }
  // docx / pptx are zip based; extract readable xml text fragments where possible
  const xmlText = raw.match(/>([^<>{5,}]{5,})</g);
  if (xmlText && xmlText.length > 5) {
    return xmlText.map((s) => s.slice(1, -1)).join(" ").replace(/\s+/g, " ");
  }
  return stripBinary(raw);
}

function stripBinary(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s.,;:!?()\-—–।]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}
