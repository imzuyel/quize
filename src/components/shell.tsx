"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Drawer, cx } from "./ui";
import { useI18n } from "@/lib/i18n";
import { CreditLine } from "./credit";
import { CommandPalette } from "./command-palette";

export type ShellUser = {
  id: number;
  name: string;
  role: string;
  xp: number;
  level: string;
  locale?: string;
} | null;

const NAV: Record<string, { href: string; label: string; labelEn: string; icon: string }[]> = {
  teacher: [
    { href: "/teacher", label: "ড্যাশবোর্ড", labelEn: "Dashboard", icon: "🏠" },
    { href: "/teacher/ai", label: "এআই জেনারেটর", labelEn: "AI Generator", icon: "✨" },
    { href: "/teacher/bank", label: "প্রশ্ন ব্যাংক", labelEn: "Question Bank", icon: "🗃️" },
    { href: "/teacher/quizzes", label: "কুইজ স্টুডিও", labelEn: "Quiz Studio", icon: "🎛️" },
    { href: "/teacher/templates", label: "টেমপ্লেট স্টুডিও", labelEn: "Templates", icon: "🎨" },
    { href: "/teacher/slides", label: "প্রেজেন্টেশন", labelEn: "Presentations", icon: "🎞️" },
    { href: "/teacher/live", label: "লাইভ সেশন", labelEn: "Live Sessions", icon: "📡" },
    { href: "/teacher/analytics", label: "অ্যানালিটিক্স ও রিপোর্ট", labelEn: "Analytics", icon: "📈" },
    { href: "/teacher/tournaments", label: "টুর্নামেন্ট ও পাথ", labelEn: "Tournaments", icon: "🏆" },
    { href: "/leaderboard", label: "লিডারবোর্ড", labelEn: "Leaderboard", icon: "🥇" },
    { href: "/settings", label: "সেটিংস", labelEn: "Settings", icon: "⚙️" },
    { href: "/about", label: "সম্পর্কে", labelEn: "About", icon: "ℹ️" },
  ],
  student: [
    { href: "/student", label: "ড্যাশবোর্ড", labelEn: "Dashboard", icon: "🏠" },
    { href: "/student/quizzes", label: "কুইজ ও পরীক্ষা", labelEn: "Quizzes", icon: "📝" },
    { href: "/student/practice", label: "অনুশীলন", labelEn: "Practice", icon: "🎯" },
    { href: "/student/results", label: "ফলাফল", labelEn: "Results", icon: "📊" },
    { href: "/student/achievements", label: "অর্জন", labelEn: "Achievements", icon: "🏅" },
    { href: "/leaderboard", label: "লিডারবোর্ড", labelEn: "Leaderboard", icon: "🥇" },
    { href: "/settings", label: "সেটিংস", labelEn: "Settings", icon: "⚙️" },
    { href: "/about", label: "সম্পর্কে", labelEn: "About", icon: "ℹ️" },
  ],
  parent: [
    { href: "/parent", label: "সন্তানের অগ্রগতি", labelEn: "Child Progress", icon: "👨‍👩‍👧" },
    { href: "/leaderboard", label: "লিডারবোর্ড", labelEn: "Leaderboard", icon: "🥇" },
    { href: "/settings", label: "সেটিংস", labelEn: "Settings", icon: "⚙️" },
    { href: "/about", label: "সম্পর্কে", labelEn: "About", icon: "ℹ️" },
  ],
  admin: [
    { href: "/admin", label: "ড্যাশবোর্ড", labelEn: "Dashboard", icon: "🏠" },
    { href: "/admin/structure", label: "একাডেমিক কাঠামো", labelEn: "Structure", icon: "🏫" },
    { href: "/admin/users", label: "ইউজার ম্যানেজমেন্ট", labelEn: "Users", icon: "👥" },
    { href: "/admin/settings", label: "ব্র্যান্ডিং ও অর্জন", labelEn: "Branding", icon: "🎨" },
    { href: "/admin/ai", label: "এআই কী", labelEn: "AI Keys", icon: "🔑" },
    { href: "/leaderboard", label: "লিডারবোর্ড", labelEn: "Leaderboard", icon: "🥇" },
    { href: "/settings", label: "সেটিংস", labelEn: "Settings", icon: "⚙️" },
    { href: "/about", label: "সম্পর্কে", labelEn: "About", icon: "ℹ️" },
  ],
};

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, motion, setMotion, highContrast, setHighContrast, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<{ id: number; title: string; body: string | null; read: boolean; link: string | null }[]>([]);

  const roleKey = user?.role === "super_admin" ? "admin" : (user?.role ?? "student");
  const nav = NAV[roleKey] ?? NAV.student;

  // Adopt the account's saved language the first time this browser is used.
  useEffect(() => {
    if (!user?.locale) return;
    if (localStorage.getItem("pg_locale")) return;
    if (user.locale === "bn" || user.locale === "en") setLocale(user.locale);
  }, [user?.locale, setLocale]);

  const loadNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setNotifs(await res.json());
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    if (user) loadNotifs();
  }, [user, loadNotifs]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[var(--pg-mist)]">
      <header className="sticky top-0 z-30 border-b border-[var(--pg-line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-3 sm:px-5">
          <button
            className="rounded-lg p-2 text-xl lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--pg-deep)] text-sm font-black text-white">
              PG
            </span>
            <span className="hidden text-sm font-extrabold sm:block">{t("app_name")}</span>
          </Link>
          <div className="flex-1" />
          {user ? <CommandPalette role={user.role} /> : null}
          <button
            onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
            className="rounded-lg border border-[var(--pg-line)] px-2.5 py-1.5 text-xs font-bold"
          >
            {locale === "bn" ? "EN" : "বাং"}
          </button>
          {user ? (
            <>
              <button
                onClick={() => {
                  setNotifOpen(true);
                  loadNotifs();
                }}
                className="relative rounded-lg p-2 text-lg"
                aria-label="Notifications"
              >
                🔔
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--pg-coral)] px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                ) : null}
              </button>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold leading-tight">{user.name}</p>
                <p className="text-[10px] uppercase text-slate-400">{user.role}</p>
              </div>
              <Link
                href="/settings"
                className="rounded-lg p-2 text-lg transition hover:bg-slate-100"
                aria-label={t("settings")}
                title={t("settings")}
              >
                ⚙️
              </Link>
              <Button size="sm" variant="outline" onClick={logout}>
                {t("logout")}
              </Button>
            </>
          ) : (
            <Link href="/">
              <Button size="sm">{t("get_started")}</Button>
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-[var(--pg-line)] bg-white p-3 lg:block pg-scroll">
          <NavList nav={nav} pathname={pathname} locale={locale} />
          <AccessibilityPanel
            motion={motion}
            setMotion={setMotion}
            highContrast={highContrast}
            setHighContrast={setHighContrast}
          />
          <div className="mt-4 px-1">
            <CreditLine tone="light" />
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={t("app_name")}>
        <div onClick={() => setMenuOpen(false)}>
          <NavList nav={nav} pathname={pathname} locale={locale} />
        </div>
        <AccessibilityPanel
          motion={motion}
          setMotion={setMotion}
          highContrast={highContrast}
          setHighContrast={setHighContrast}
        />
      </Drawer>

      <Drawer open={notifOpen} onClose={() => setNotifOpen(false)} title="নোটিফিকেশন">
        {notifs.length === 0 ? (
          <p className="text-sm text-slate-500">কোনো নোটিফিকেশন নেই।</p>
        ) : (
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await fetch("/api/notifications", { method: "POST" });
                loadNotifs();
              }}
            >
              সব পঠিত হিসেবে চিহ্নিত করুন
            </Button>
            {notifs.map((n) => (
              <div
                key={n.id}
                className={cx(
                  "rounded-xl border p-3",
                  n.read ? "border-[var(--pg-line)] bg-white" : "border-teal-200 bg-teal-50",
                )}
              >
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body ? <p className="mt-0.5 text-xs text-slate-600">{n.body}</p> : null}
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => setNotifOpen(false)}
                    className="mt-1 inline-block text-xs font-bold text-[var(--pg-teal)]"
                  >
                    দেখুন →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function NavList({
  nav,
  pathname,
  locale,
}: {
  nav: { href: string; label: string; labelEn: string; icon: string }[];
  pathname: string;
  locale: string;
}) {
  return (
    <nav className="space-y-1">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition min-h-[44px]",
              active
                ? "bg-[var(--pg-deep)] text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <span>{item.icon}</span>
            <span>{locale === "bn" ? item.label : item.labelEn}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AccessibilityPanel({
  motion,
  setMotion,
  highContrast,
  setHighContrast,
}: {
  motion: string;
  setMotion: (m: "low" | "medium" | "high") => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-[var(--pg-line)] p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        অ্যাক্সেসিবিলিটি
      </p>
      <div className="flex gap-1">
        {(["low", "medium", "high"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMotion(m)}
            className={cx(
              "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold",
              motion === m ? "bg-[var(--pg-teal)] text-white" : "bg-slate-100 text-slate-600",
            )}
          >
            {m === "low" ? "কম" : m === "medium" ? "মাঝারি" : "বেশি"}
          </button>
        ))}
      </div>
      <button
        onClick={() => setHighContrast(!highContrast)}
        className="mt-2 w-full rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-600"
      >
        {highContrast ? "✓ " : ""}হাই কনট্রাস্ট
      </button>
      <Badge tone="teal" className="mt-2">মোশন: {motion}</Badge>
    </div>
  );
}
