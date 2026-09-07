"use client";

import { useEffect, useMemo, useState } from "react";
import { cx } from "./ui";

/* --------------------------------- Timer --------------------------------- */
export function QuizTimer({
  endsAt,
  total,
  style = "circular",
  size = 96,
  paused,
  color,
}: {
  endsAt: string | null;
  total: number;
  style?: "circular" | "linear" | "digital" | "flip" | "pulse" | "minimal" | "ring_glow";
  size?: number;
  paused?: boolean;
  color?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [paused]);
  const remaining = endsAt ? Math.max(0, (new Date(endsAt).getTime() - now) / 1000) : total;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const warn = remaining <= 5;
  const secs = Math.ceil(remaining);

  if (style === "linear")
    return (
      <div className="w-full" role="timer" aria-live="off">
        <div className="mb-1 flex justify-between text-xs font-bold">
          <span>{paused ? "⏸ বিরতি" : "সময়"}</span>
          <span className="tabular-nums">{secs}s</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/25">
          <div
            className={cx("h-full rounded-full transition-[width] duration-200", warn ? "bg-rose-400" : "bg-emerald-300")}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    );

  if (style === "digital" || style === "minimal")
    return (
      <div
        className={cx(
          "rounded-xl px-4 py-2 font-mono text-2xl font-bold tabular-nums",
          style === "minimal" ? "text-white/90" : "bg-black/40 text-white",
          warn && "text-rose-300",
        )}
      >
        {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
      </div>
    );

  if (style === "flip")
    return (
      <div className="flex gap-1">
        {String(secs).padStart(2, "0").split("").map((d, i) => (
          <span
            key={i}
            className="anim-flip rounded-lg bg-slate-900 px-2.5 py-1.5 font-mono text-2xl font-bold text-white"
          >
            {d}
          </span>
        ))}
      </div>
    );

  if (style === "pulse")
    return (
      <div
        className={cx(
          "flex items-center justify-center rounded-full bg-white/15 font-bold text-white anim-pulse-ring",
          warn && "text-rose-200",
        )}
        style={{ width: size, height: size, fontSize: size / 3 }}
      >
        {secs}
      </div>
    );

  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const ring = warn ? "#fb7185" : color || "#34d399";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="timer"
      style={style === "ring_glow" ? { filter: `drop-shadow(0 0 8px ${ring})` } : undefined}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="8" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ring}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - pct * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .2s linear" }}
      />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white font-bold"
        style={{ fontSize: size / 3.2 }}
      >
        {paused ? "⏸" : secs}
      </text>
    </svg>
  );
}

/* ------------------------------ Answer grid ------------------------------ */
const SHAPES = ["▲", "◆", "●", "■", "★", "✚"];
const COLORS = [
  "#e2574c",
  "#2f80ed",
  "#f0b429",
  "#0f9d58",
  "#8b5cf6",
  "#0891b2",
];

export function AnswerGrid({
  options,
  type,
  selected,
  disabled,
  reveal,
  correct,
  hidden,
  onSelect,
}: {
  options: string[];
  type: string;
  selected: (string | number)[];
  disabled?: boolean;
  reveal?: boolean;
  correct?: (string | number)[];
  hidden?: number[];
  onSelect: (index: number) => void;
}) {
  const multi = type === "multi_select" || type === "poll";
  return (
    <div
      className={cx(
        "grid gap-3",
        options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
      )}
      role={multi ? "group" : "radiogroup"}
    >
      {options.map((opt, i) => {
        const isSel = selected.includes(i);
        const isCorrect = reveal && (correct ?? []).map(Number).includes(i);
        const isWrong = reveal && isSel && !isCorrect;
        if (hidden?.includes(i)) {
          return <div key={i} className="rounded-2xl bg-slate-200/40 min-h-[64px]" aria-hidden />;
        }
        return (
          <button
            key={i}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={isSel}
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={cx(
              "flex min-h-[64px] items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-base font-semibold text-white shadow-sm transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed",
              isSel ? "ring-4 ring-white/80" : "",
              isCorrect && "anim-pop ring-4 ring-emerald-300",
              isWrong && "anim-shake opacity-70",
              reveal && !isCorrect && "opacity-60",
            )}
            style={{ background: COLORS[i % COLORS.length] }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20 text-lg">
              {SHAPES[i % SHAPES.length]}
            </span>
            <span className="flex-1 leading-snug">{opt}</span>
            {reveal ? (
              <span className="text-xl">{isCorrect ? "✅" : isSel ? "❌" : ""}</span>
            ) : isSel ? (
              <span className="text-xl">✔</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Leaderboard ------------------------------ */
export type LeaderRow = {
  id: number;
  nickname: string;
  score: number;
  streak?: number;
  correctCount?: number;
  answeredCount?: number;
};

export function Leaderboard({
  rows,
  limit = 10,
  highlightId,
  compact,
}: {
  rows: LeaderRow[];
  limit?: number;
  highlightId?: number;
  compact?: boolean;
}) {
  const top = rows.slice(0, limit);
  if (!top.length)
    return <p className="py-6 text-center text-sm text-slate-400">এখনো কোনো স্কোর নেই</p>;
  return (
    <ol className="space-y-2">
      {top.map((r, i) => {
        const accuracy = r.answeredCount ? Math.round(((r.correctCount ?? 0) / r.answeredCount) * 100) : 0;
        return (
          <li
            key={r.id}
            className={cx(
              "anim-slide flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
              i === 0
                ? "border-amber-300 bg-amber-50"
                : i === 1
                  ? "border-slate-300 bg-slate-50"
                  : i === 2
                    ? "border-orange-200 bg-orange-50"
                    : "border-[var(--pg-line)] bg-white",
              highlightId === r.id && "ring-2 ring-[var(--pg-teal)]",
            )}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-sm font-extrabold shadow-sm">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.nickname}</span>
              {!compact ? (
                <span className="text-[11px] text-slate-500">
                  নির্ভুলতা {accuracy}% · স্ট্রিক {r.streak ?? 0}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums font-extrabold text-[var(--pg-deep)]">
              {Math.round(r.score)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------- Reactions ------------------------------- */
export const REACTIONS = ["❤️", "🔥", "👏", "😂", "😮", "🎯"];

export function ReactionStream({ items }: { items: { id: number; emoji: string }[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((r) => (
        <span
          key={r.id}
          className="anim-float absolute text-3xl"
          style={{ left: `${8 + (r.id % 84)}%`, bottom: 12 }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------ Cinematic intro --------------------------- */
export function CinematicIntro({
  title,
  questions,
  players,
  onDone,
}: {
  title: string;
  questions: number;
  players: number;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 900),
      setTimeout(() => setStep(2), 1700),
      setTimeout(() => setStep(3), 2400),
      setTimeout(() => setStep(4), 3000),
      setTimeout(onDone, 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);
  const labels = ["🎓", "3", "2", "1", "LET'S PLAY!"];
  return (
    <div className="pg-hero-bg fixed inset-0 z-50 grid place-items-center text-center text-white">
      <div>
        <p className="anim-fade text-sm uppercase tracking-[0.3em] text-white/70">
          পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ
        </p>
        <h1 className="anim-zoom mt-3 text-3xl font-extrabold sm:text-5xl">{title}</h1>
        <p className="anim-fade mt-2 text-white/80">
          {questions} প্রশ্ন · {players} জন খেলোয়াড়
        </p>
        <div key={step} className="anim-pop mt-8 text-6xl font-black sm:text-8xl">
          {labels[step]}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Streak banner ---------------------------- */
export function StreakBanner({ streak }: { streak: number }) {
  const label = useMemo(() => {
    if (streak >= 10) return "🔥 অবিশ্বাস্য! ১০+ স্ট্রিক";
    if (streak >= 5) return "🔥 দুর্দান্ত! ৫ স্ট্রিক";
    return "⚡ ৩ স্ট্রিক!";
  }, [streak]);
  if (streak < 3) return null;
  return (
    <div className="anim-pop mx-auto w-fit rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-5 py-2 text-sm font-bold text-white shadow-lg">
      {label}
    </div>
  );
}
