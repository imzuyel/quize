"use client";

import { useEffect, useState } from "react";
import { cx } from "./ui";

const TABS = [
  { id: "ai", label: "এআই জেনারেটর" },
  { id: "live", label: "লাইভ কুইজ" },
  { id: "board", label: "লিডারবোর্ড" },
  { id: "studio", label: "টেমপ্লেট" },
  { id: "stats", label: "অ্যানালিটিক্স" },
];

export function LandingPreviews() {
  const [tab, setTab] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const id = setInterval(() => setTab((t) => (t + 1) % TABS.length), 4200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (TABS[tab].id !== "ai") return;
    setProgress(8);
    const id = setInterval(() => setProgress((p) => (p >= 100 ? 100 : p + 4)), 90);
    return () => clearInterval(id);
  }, [tab]);

  const active = TABS[tab].id;

  return (
    <div className="anim-zoom">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTab(i)}
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition",
              i === tab ? "bg-white text-[var(--pg-deep)]" : "bg-white/10 text-white/70",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-white/15 bg-white/95 p-4 shadow-2xl">
        {active === "ai" ? (
          <div key="ai" className="anim-fade">
            <p className="text-xs font-bold text-slate-500">এআই প্রশ্ন জেনারেশন চলছে…</p>
            <p className="mt-1 text-sm font-bold">ক্লাস ১০ · কম্পিউটার · HTML ফর্ম · ১০০ প্রশ্ন</p>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--pg-teal)] to-[var(--pg-gold)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs font-bold tabular-nums text-slate-500">{progress}%</p>
            <div className="mt-3 space-y-2">
              {["MCQ · সহজ · ব্যাখ্যাসহ", "সত্য/মিথ্যা · মাঝারি", "কেস-বেসড · কঠিন"].map((x, i) => (
                <div
                  key={x}
                  className="anim-slide rounded-lg border border-[var(--pg-line)] px-3 py-2 text-xs"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  ✅ {x}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {active === "live" ? (
          <div key="live" className="anim-fade">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                PIN 482913
              </span>
              <span className="text-xs font-bold text-slate-500">প্রশ্ন ৩/১০</span>
            </div>
            <p className="mt-3 text-sm font-bold">HTML ফর্মে ইনপুট নিতে কোন ট্যাগ ব্যবহৃত হয়?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["<input>", "<entry>", "<field>", "<form-data>"].map((o, i) => (
                <div
                  key={o}
                  className={cx(
                    "anim-pop rounded-xl px-3 py-3 text-xs font-bold text-white",
                    i === 0 ? "bg-[#e2574c] ring-4 ring-emerald-300" : "bg-[#2f80ed]",
                  )}
                  style={{
                    animationDelay: `${i * 90}ms`,
                    background: ["#e2574c", "#2f80ed", "#f0b429", "#0f9d58"][i],
                  }}
                >
                  {o} {i === 0 ? "✅" : ""}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {active === "board" ? (
          <div key="board" className="anim-fade space-y-2">
            <p className="text-xs font-bold text-slate-500">লাইভ লিডারবোর্ড</p>
            {[
              ["সাদিয়া আক্তার", 8420],
              ["রিফাত হোসেন", 7980],
              ["নুসরাত জাহান", 7610],
              ["মেহেদী হাসান", 7010],
            ].map(([n, s], i) => (
              <div
                key={String(n)}
                className="anim-slide flex items-center gap-2 rounded-xl border border-[var(--pg-line)] px-3 py-2 text-xs"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="font-black">{["🥇", "🥈", "🥉", "4"][i]}</span>
                <span className="flex-1 font-semibold">{n}</span>
                <span className="font-black tabular-nums text-[var(--pg-deep)]">{s}</span>
              </div>
            ))}
          </div>
        ) : null}

        {active === "studio" ? (
          <div key="studio" className="anim-fade">
            <p className="text-xs font-bold text-slate-500">টেমপ্লেট স্টুডিও</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                "linear-gradient(135deg,#0f2f4a,#0b6b53)",
                "linear-gradient(140deg,#050b1f,#0e7490)",
                "linear-gradient(135deg,#b91c1c,#f59e0b)",
                "linear-gradient(135deg,#111827,#065f46)",
                "linear-gradient(135deg,#1e1b4b,#4c1d95)",
                "linear-gradient(135deg,#f8fafc,#e2e8f0)",
              ].map((bg, i) => (
                <div
                  key={i}
                  className="anim-pop h-16 rounded-xl border border-slate-200"
                  style={{ background: bg, animationDelay: `${i * 70}ms` }}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              রঙ, ফন্ট, টাইমার স্টাইল, ট্রানজিশন ও সাউন্ড — সব কাস্টমাইজেবল।
            </p>
          </div>
        ) : null}

        {active === "stats" ? (
          <div key="stats" className="anim-fade">
            <p className="text-xs font-bold text-slate-500">বিষয়ভিত্তিক পারফরম্যান্স</p>
            <div className="mt-3 space-y-2">
              {[
                ["কম্পিউটার", 88],
                ["গণিত", 81],
                ["ইলেকট্রনিক্স", 76],
                ["ইলেকট্রিক্যাল", 84],
                ["ইংরেজি", 90],
              ].map(([n, v], i) => (
                <div key={String(n)}>
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>{n}</span>
                    <span>{v}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-[var(--pg-teal)] transition-all duration-700"
                      style={{ width: `${v}%`, transitionDelay: `${i * 80}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
