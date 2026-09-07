/** Per-user preferences and school-wide feature flags. Pure data. */

export type NotificationPrefs = {
  quiz: boolean;
  exam: boolean;
  result: boolean;
  live: boolean;
  achievement: boolean;
  announcement: boolean;
  approval: boolean;
};

export type TeacherDefaults = {
  timer: number;
  marks: number;
  language: "bn" | "en" | "mixed";
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  withExplanation: boolean;
  withHint: boolean;
  themeId: string;
};

export type UserPrefs = {
  notifications?: Partial<NotificationPrefs>;
  teacher?: Partial<TeacherDefaults>;
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  quiz: true,
  exam: true,
  result: true,
  live: true,
  achievement: true,
  announcement: true,
  approval: true,
};

export const DEFAULT_TEACHER: TeacherDefaults = {
  timer: 30,
  marks: 1,
  language: "bn",
  difficulty: "medium",
  questionCount: 10,
  withExplanation: true,
  withHint: true,
  themeId: "",
};

export function notificationPrefs(raw: unknown): NotificationPrefs {
  const p = (raw as UserPrefs)?.notifications ?? {};
  return { ...DEFAULT_NOTIFICATIONS, ...p };
}

export function teacherDefaults(raw: unknown): TeacherDefaults {
  const p = (raw as UserPrefs)?.teacher ?? {};
  return { ...DEFAULT_TEACHER, ...p };
}

export const NOTIFICATION_LABELS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "quiz", label: "নতুন কুইজ", hint: "শিক্ষক নতুন কুইজ প্রকাশ করলে" },
  { key: "exam", label: "আসন্ন পরীক্ষা", hint: "পরীক্ষার সময়সূচি ও স্মরণিকা" },
  { key: "live", label: "লাইভ কুইজ শুরু", hint: "ক্লাসে লাইভ সেশন চালু হলে" },
  { key: "result", label: "ফলাফল প্রকাশ", hint: "স্কোর ও র‍্যাংক জানানো" },
  { key: "achievement", label: "অর্জন আনলক", hint: "নতুন ব্যাজ বা লেভেল" },
  { key: "announcement", label: "স্কুল ঘোষণা", hint: "অ্যাডমিনের সাধারণ বার্তা" },
  { key: "approval", label: "অনুমোদনের আবেদন", hint: "শুধু অ্যাডমিনের জন্য" },
];

/* ------------------------------------------------------------------ */
/* School-wide feature flags                                           */
/* ------------------------------------------------------------------ */

export type FeatureFlags = {
  guestJoin: boolean;
  xpEnabled: boolean;
  reactions: boolean;
  leaderboard: boolean;
  practiceMode: boolean;
  certificates: boolean;
  presentations: boolean;
  aiGeneration: boolean;
};

export const DEFAULT_FEATURES: FeatureFlags = {
  guestJoin: true,
  xpEnabled: true,
  reactions: true,
  leaderboard: true,
  practiceMode: true,
  certificates: true,
  presentations: true,
  aiGeneration: true,
};

export function mergeFeatures(raw: unknown): FeatureFlags {
  return { ...DEFAULT_FEATURES, ...((raw as Partial<FeatureFlags>) ?? {}) };
}

export const FEATURE_LABELS: { key: keyof FeatureFlags; label: string; hint: string; icon: string }[] = [
  { key: "aiGeneration", label: "এআই প্রশ্ন তৈরি", hint: "বন্ধ করলে শুধু ম্যানুয়াল ও পেস্ট চলবে", icon: "✨" },
  { key: "presentations", label: "প্রেজেন্টেশন স্টুডিও", hint: "স্লাইড তৈরি ও PPTX ডাউনলোড", icon: "🎞️" },
  { key: "guestJoin", label: "গেস্ট জয়েন", hint: "অ্যাকাউন্ট ছাড়াই পিন দিয়ে লাইভ কুইজে যোগদান", icon: "🎫" },
  { key: "reactions", label: "লাইভ রিঅ্যাকশন", hint: "শিক্ষার্থীরা ইমোজি পাঠাতে পারবে", icon: "❤️" },
  { key: "leaderboard", label: "লিডারবোর্ড", hint: "লাইভ কুইজে র‍্যাংকিং দেখানো", icon: "🏆" },
  { key: "xpEnabled", label: "XP ও লেভেল", hint: "গেমিফিকেশন — পরীক্ষার নম্বরে প্রভাব ফেলে না", icon: "⚡" },
  { key: "practiceMode", label: "অনুশীলন মোড", hint: "শিক্ষার্থীরা নিজে অনুশীলন করতে পারবে", icon: "🎯" },
  { key: "certificates", label: "সার্টিফিকেট", hint: "বিজয়ী ও অংশগ্রহণকারীর সনদ", icon: "🏅" },
];
