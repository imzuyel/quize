"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Locale = "bn" | "en";

const DICT: Record<string, { bn: string; en: string }> = {
  app_name: { bn: "পিজিটিএসসি কুইজ অ্যারেনা", en: "PGTSC Quiz Arena" },
  school: {
    bn: "পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ",
    en: "Panchagarh Government Technical School and College",
  },
  hero_title: {
    bn: "প্রতিটি ক্লাসকে বানান ইন্টারেক্টিভ শেখার অভিজ্ঞতা",
    en: "Turn every class into an interactive learning experience",
  },
  hero_sub: {
    bn: "এআই-চালিত কুইজ, লাইভ প্রতিযোগিতা, স্মার্ট পরীক্ষা ও ব্যক্তিগত শেখা—সব এক প্ল্যাটফর্মে।",
    en: "AI-powered quizzes, live competitions, smart exams and personalized learning—all in one platform.",
  },
  get_started: { bn: "শুরু করুন", en: "Get Started" },
  join_quiz: { bn: "কুইজে যোগ দিন", en: "Join Quiz" },
  login: { bn: "লগইন", en: "Login" },
  logout: { bn: "লগআউট", en: "Logout" },
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  question_bank: { bn: "প্রশ্ন ব্যাংক", en: "Question Bank" },
  quiz_studio: { bn: "কুইজ স্টুডিও", en: "Quiz Studio" },
  template_studio: { bn: "টেমপ্লেট স্টুডিও", en: "Template Studio" },
  generate_ai: { bn: "এআই দিয়ে তৈরি করুন", en: "Generate with AI" },
  create_quiz: { bn: "কুইজ তৈরি", en: "Create Quiz" },
  start_live: { bn: "লাইভ কুইজ শুরু", en: "Start Live Quiz" },
  create_exam: { bn: "পরীক্ষা তৈরি", en: "Create Exam" },
  analytics: { bn: "অ্যানালিটিক্স", en: "Analytics" },
  reports: { bn: "রিপোর্ট", en: "Reports" },
  results: { bn: "ফলাফল", en: "Results" },
  practice: { bn: "অনুশীলন", en: "Practice" },
  achievements: { bn: "অর্জন", en: "Achievements" },
  notifications: { bn: "নোটিফিকেশন", en: "Notifications" },
  leaderboard: { bn: "লিডারবোর্ড", en: "Leaderboard" },
  settings: { bn: "সেটিংস", en: "Settings" },
  save: { bn: "সংরক্ষণ", en: "Save" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  delete: { bn: "মুছুন", en: "Delete" },
  edit: { bn: "সম্পাদনা", en: "Edit" },
  preview: { bn: "প্রিভিউ", en: "Preview" },
  loading: { bn: "লোড হচ্ছে…", en: "Loading…" },
  empty: { bn: "কোনো তথ্য নেই", en: "Nothing here yet" },
  templates: { bn: "টেমপ্লেট", en: "Templates" },
  students: { bn: "শিক্ষার্থী", en: "Students" },
  teachers: { bn: "শিক্ষক", en: "Teachers" },
  classes: { bn: "শ্রেণি", en: "Classes" },
  subjects: { bn: "বিষয়", en: "Subjects" },
  trades: { bn: "ট্রেড", en: "Trades" },
  exams: { bn: "পরীক্ষা", en: "Exams" },
  quizzes: { bn: "কুইজ", en: "Quizzes" },
  tournaments: { bn: "টুর্নামেন্ট", en: "Tournaments" },
  language: { bn: "ভাষা", en: "Language" },
};

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
  motion: "low" | "medium" | "high";
  setMotion: (m: "low" | "medium" | "high") => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("bn");
  const [motion, setMotionState] = useState<"low" | "medium" | "high">("medium");
  const [highContrast, setHC] = useState(false);

  useEffect(() => {
    const l = (localStorage.getItem("pg_locale") as Locale) || "bn";
    setLocaleState(l);
    const m = (localStorage.getItem("pg_motion") as "low") || "medium";
    setMotionState(m);
    setHC(localStorage.getItem("pg_hc") === "1");
    // auto-reduce motion on low-end devices / slow networks
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string; saveData?: boolean };
    };
    const slow =
      (nav.deviceMemory ?? 8) <= 2 ||
      nav.hardwareConcurrency <= 2 ||
      nav.connection?.saveData === true ||
      ["slow-2g", "2g"].includes(nav.connection?.effectiveType ?? "");
    if (slow && !localStorage.getItem("pg_motion")) setMotionState("low");
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.body.classList.toggle("motion-low", motion === "low");
    document.body.classList.toggle("hc", highContrast);
  }, [locale, motion, highContrast]);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem("pg_locale", l);
    setLocaleState(l);
  }, []);
  const setMotion = useCallback((m: "low" | "medium" | "high") => {
    localStorage.setItem("pg_motion", m);
    setMotionState(m);
  }, []);
  const setHighContrast = useCallback((v: boolean) => {
    localStorage.setItem("pg_hc", v ? "1" : "0");
    setHC(v);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => DICT[key]?.[locale] ?? fallback ?? key,
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, motion, setMotion, highContrast, setHighContrast }),
    [locale, setLocale, t, motion, setMotion, highContrast, setHighContrast],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "bn" as Locale,
      setLocale: () => {},
      t: (k: string, f?: string) => DICT[k]?.bn ?? f ?? k,
      motion: "medium" as const,
      setMotion: () => {},
      highContrast: false,
      setHighContrast: () => {},
    };
  }
  return ctx;
}
