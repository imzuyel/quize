"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "./ui";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  group: string;
  href?: string;
  run?: () => void;
  roles?: string[];
  keywords?: string;
};

const BASE_COMMANDS: Command[] = [
  // Teacher
  { id: "t-home", label: "ড্যাশবোর্ড", icon: "🏠", group: "শিক্ষক", href: "/teacher", roles: ["teacher", "admin", "super_admin"], keywords: "dashboard home" },
  { id: "t-ai", label: "এআই প্রশ্ন জেনারেটর", icon: "✨", group: "শিক্ষক", href: "/teacher/ai", roles: ["teacher", "admin", "super_admin"], keywords: "ai generate question" },
  { id: "t-paste", label: "প্রশ্ন পেস্ট করুন", icon: "📋", group: "শিক্ষক", href: "/teacher/ai?tab=paste", roles: ["teacher", "admin", "super_admin"], keywords: "paste import excel" },
  { id: "t-pdf", label: "PDF / বই থেকে প্রশ্ন", icon: "📘", group: "শিক্ষক", href: "/teacher/ai?tab=document", roles: ["teacher", "admin", "super_admin"], keywords: "pdf book upload" },
  { id: "t-bank", label: "প্রশ্ন ব্যাংক", icon: "🗃️", group: "শিক্ষক", href: "/teacher/bank", roles: ["teacher", "admin", "super_admin"], keywords: "bank question" },
  { id: "t-quiz", label: "কুইজ স্টুডিও", icon: "🎛️", group: "শিক্ষক", href: "/teacher/quizzes", roles: ["teacher", "admin", "super_admin"], keywords: "quiz studio create" },
  { id: "t-live", label: "লাইভ কুইজ শুরু", icon: "📡", group: "শিক্ষক", href: "/teacher/live", roles: ["teacher", "admin", "super_admin"], keywords: "live start pin" },
  { id: "t-slides", label: "প্রেজেন্টেশন স্টুডিও", icon: "🎞️", group: "শিক্ষক", href: "/teacher/slides", roles: ["teacher", "admin", "super_admin"], keywords: "slides presentation pptx" },
  { id: "t-theme", label: "টেমপ্লেট স্টুডিও", icon: "🎨", group: "শিক্ষক", href: "/teacher/templates", roles: ["teacher", "admin", "super_admin"], keywords: "theme template" },
  { id: "t-stats", label: "অ্যানালিটিক্স ও রিপোর্ট", icon: "📈", group: "শিক্ষক", href: "/teacher/analytics", roles: ["teacher", "admin", "super_admin"], keywords: "analytics report stats" },
  { id: "t-items", label: "প্রশ্নের মান বিশ্লেষণ", icon: "🔬", group: "শিক্ষক", href: "/teacher/analytics?tab=items", roles: ["teacher", "admin", "super_admin"], keywords: "item analysis discrimination" },
  { id: "t-tour", label: "টুর্নামেন্ট ও পাথ", icon: "🏆", group: "শিক্ষক", href: "/teacher/tournaments", roles: ["teacher", "admin", "super_admin"], keywords: "tournament playlist" },

  // Student
  { id: "s-home", label: "আমার ড্যাশবোর্ড", icon: "🏠", group: "শিক্ষার্থী", href: "/student", roles: ["student"], keywords: "dashboard" },
  { id: "s-quiz", label: "কুইজ ও পরীক্ষা", icon: "📝", group: "শিক্ষার্থী", href: "/student/quizzes", roles: ["student"], keywords: "quiz exam" },
  { id: "s-practice", label: "অনুশীলন", icon: "🎯", group: "শিক্ষার্থী", href: "/student/practice", roles: ["student"], keywords: "practice" },
  { id: "s-results", label: "আমার ফলাফল", icon: "📊", group: "শিক্ষার্থী", href: "/student/results", roles: ["student"], keywords: "result score" },
  { id: "s-badge", label: "অর্জন", icon: "🏅", group: "শিক্ষার্থী", href: "/student/achievements", roles: ["student"], keywords: "achievement badge xp" },

  // Admin
  { id: "a-home", label: "অ্যাডমিন ড্যাশবোর্ড", icon: "🏫", group: "অ্যাডমিন", href: "/admin", roles: ["admin", "super_admin"] },
  { id: "a-users", label: "ইউজার ম্যানেজমেন্ট", icon: "👥", group: "অ্যাডমিন", href: "/admin/users", roles: ["admin", "super_admin"], keywords: "user teacher student" },
  { id: "a-pending", label: "অনুমোদনের অপেক্ষায়", icon: "⏳", group: "অ্যাডমিন", href: "/admin/users?tab=pending", roles: ["admin", "super_admin"], keywords: "approve pending" },
  { id: "a-struct", label: "একাডেমিক কাঠামো", icon: "🏫", group: "অ্যাডমিন", href: "/admin/structure", roles: ["admin", "super_admin"], keywords: "class subject trade" },
  { id: "a-brand", label: "ব্র্যান্ডিং ও ফিচার", icon: "🎨", group: "অ্যাডমিন", href: "/admin/settings", roles: ["admin", "super_admin"], keywords: "branding feature flag" },
  { id: "a-ai", label: "এআই কী ম্যানেজমেন্ট", icon: "🔑", group: "অ্যাডমিন", href: "/admin/ai", roles: ["admin", "super_admin"], keywords: "api key gemini groq" },

  { id: "g-board", label: "লিডারবোর্ড — কে কত পেল", icon: "🥇", group: "সাধারণ", href: "/leaderboard", keywords: "leaderboard rank score top" },

  // Everyone
  { id: "g-settings", label: "সেটিংস", icon: "⚙️", group: "সাধারণ", href: "/settings", keywords: "settings profile password" },
  { id: "g-notif", label: "নোটিফিকেশন পছন্দ", icon: "🔔", group: "সাধারণ", href: "/settings?tab=notify", keywords: "notification mute" },
  { id: "g-about", label: "প্ল্যাটফর্ম সম্পর্কে", icon: "ℹ️", group: "সাধারণ", href: "/about", keywords: "about developer" },
  { id: "g-join", label: "গেম পিন দিয়ে যোগ দিন", icon: "🎫", group: "সাধারণ", href: "/join", keywords: "join pin play" },
];

/** Lightweight fuzzy match — every query character must appear in order. */
function fuzzy(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (t.includes(q)) return 100 - t.indexOf(q);
  let ti = 0;
  let score = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    score += found === ti ? 2 : 1;
    ti = found + 1;
  }
  return score;
}

export function CommandPalette({ role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(
    () => BASE_COMMANDS.filter((c) => !c.roles || c.roles.includes(role)),
    [role],
  );

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((c) => ({
        c,
        score: Math.max(fuzzy(c.label, query), fuzzy(c.keywords ?? "", query) * 0.8),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.c);
  }, [commands, query]);

  // ⌘K / Ctrl+K anywhere, and "/" when not already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const choose = (c: Command) => {
    setOpen(false);
    if (c.run) c.run();
    else if (c.href) router.push(c.href);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  // Keep the highlighted row in view while arrowing.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-[var(--pg-line)] bg-white px-3 py-1.5 text-xs text-slate-400 transition hover:border-[var(--pg-teal)] hover:text-slate-600 md:flex"
        aria-label="কমান্ড প্যালেট খুলুন"
      >
        <span>🔍</span>
        <span>খুঁজুন…</span>
        <kbd className="rounded border border-[var(--pg-line)] bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
    );

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="anim-zoom w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="কমান্ড প্যালেট"
      >
        <div className="flex items-center gap-2 border-b border-[var(--pg-line)] px-4 py-3">
          <span className="text-lg">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            placeholder="পেজ বা কাজ খুঁজুন…"
            className="flex-1 bg-transparent text-sm outline-none"
            aria-label="অনুসন্ধান"
          />
          <kbd className="rounded border border-[var(--pg-line)] bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
             esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2 pg-scroll">
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">কিছু পাওয়া যায়নি</p>
          ) : (
            results.map((c, i) => {
              const showGroup = c.group !== lastGroup;
              lastGroup = c.group;
              return (
                <div key={c.id}>
                  {showGroup && !query ? (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {c.group}
                    </p>
                  ) : null}
                  <button
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(c)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                      active === i ? "bg-[var(--pg-teal)] text-white" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.label}</span>
                      {c.hint ? (
                        <span className={cx("block text-xs", active === i ? "text-white/70" : "text-slate-400")}>
                          {c.hint}
                        </span>
                      ) : null}
                    </span>
                    {query ? (
                      <span className={cx("text-[10px]", active === i ? "text-white/60" : "text-slate-400")}>
                        {c.group}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--pg-line)] bg-slate-50 px-4 py-2 text-[10px] text-slate-400">
          <span><kbd className="font-mono">↑↓</kbd> নেভিগেট</span>
          <span><kbd className="font-mono">↵</kbd> খুলুন</span>
          <span><kbd className="font-mono">/</kbd> দ্রুত খুলুন</span>
        </div>
      </div>
    </div>
  );
}
