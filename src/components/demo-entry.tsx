"use client";

import Link from "next/link";
import { useState } from "react";
import { Spinner, cx } from "./ui";

export const ROLES = [
  {
    role: "teacher",
    label: "শিক্ষক",
    icon: "👩‍🏫",
    desc: "কুইজ তৈরি, লাইভ পরিচালনা, এআই প্রশ্ন, অ্যানালিটিক্স",
    home: "/teacher",
  },
  {
    role: "student",
    label: "শিক্ষার্থী",
    icon: "🎒",
    desc: "লাইভ কুইজ, পরীক্ষা, অনুশীলন, অর্জন ও র‍্যাংক",
    home: "/student",
  },
  {
    role: "parent",
    label: "অভিভাবক",
    icon: "👨‍👩‍👧",
    desc: "সন্তানের ফলাফল ও অগ্রগতি পর্যবেক্ষণ",
    home: "/parent",
  },
  {
    role: "admin",
    label: "অ্যাডমিন",
    icon: "🏫",
    desc: "শ্রেণি, ট্রেড, বিষয়, ইউজার ও ব্র্যান্ডিং",
    home: "/admin",
  },
] as const;

function useEnter() {
  const [busy, setBusy] = useState<string | null>(null);

  // Full page navigation through /demo: the route sets the session cookie and
  // redirects. This avoids client-router edge cases with middleware redirects.
  const enter = (role: string, home: string) => {
    setBusy(role);
    window.location.href = `/demo?role=${role}&next=${encodeURIComponent(home)}`;
  };

  return { enter, busy };
}

/** Hero CTA — one click straight into a role dashboard, no login screen. */
export function DemoEntry({ signedIn, home }: { signedIn: boolean; home: string }) {
  const { enter, busy } = useEnter();
  const [open, setOpen] = useState(false);

  if (signedIn)
    return (
      <div className="anim-fade flex flex-wrap gap-3">
        <Link
          href={home}
          className="rounded-xl bg-[var(--pg-teal)] px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[var(--pg-teal-soft)]"
        >
          ড্যাশবোর্ডে যান
        </Link>
        <Link
          href="/join"
          className="rounded-xl bg-white px-6 py-3.5 text-base font-bold text-[var(--pg-deep)] shadow-lg"
        >
          কুইজে যোগ দিন
        </Link>
      </div>
    );

  return (
    <div className="anim-fade">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-xl bg-[var(--pg-teal)] px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[var(--pg-teal-soft)]"
        >
          শুরু করুন {open ? "▲" : "▼"}
        </button>
        <Link
          href="/join"
          className="rounded-xl bg-white px-6 py-3.5 text-base font-bold text-[var(--pg-deep)] shadow-lg"
        >
          কুইজে যোগ দিন
        </Link>
      </div>

      {open ? (
        <div className="anim-fade mt-4 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
          <p className="mb-2 px-1 text-xs font-bold text-white/70">
            আপনার ভূমিকা বেছে নিন — সরাসরি প্রবেশ করুন
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.role}
                onClick={() => enter(r.role, r.home)}
                disabled={busy !== null}
                className={cx(
                  "flex min-h-[52px] items-center gap-2 rounded-xl bg-white/95 px-3 py-2.5 text-left text-sm font-bold text-[var(--pg-deep)] transition active:scale-[0.98] disabled:opacity-60",
                  busy === r.role && "ring-2 ring-[var(--pg-gold)]",
                )}
              >
                {busy === r.role ? <Spinner size={16} /> : <span className="text-xl">{r.icon}</span>}
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Role cards in the "everyone gets their own experience" section. */
export function RoleGrid() {
  const { enter, busy } = useEnter();
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ROLES.map((r) => (
        <button
          key={r.role}
          onClick={() => enter(r.role, r.home)}
          disabled={busy !== null}
          className="rounded-2xl border border-[var(--pg-line)] p-5 text-center transition hover:-translate-y-0.5 hover:border-[var(--pg-teal)] disabled:opacity-60"
        >
          <div className="text-3xl">{busy === r.role ? <Spinner size={26} /> : r.icon}</div>
          <p className="mt-2 font-bold">{r.label}</p>
          <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
          <span className="mt-3 inline-block text-xs font-bold text-[var(--pg-teal)]">
            এই ভূমিকায় প্রবেশ করুন →
          </span>
        </button>
      ))}
    </div>
  );
}
