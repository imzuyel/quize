"use client";

import { useEffect, useMemo, useState } from "react";
import { cx } from "./ui";

/* --------------------------- tick / cross marks --------------------------- */

export function TickMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#10b981" />
      <path
        className="tick-path"
        d="M6.5 12.5l3.5 3.5 7.5-8"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CrossMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#f43f5e" />
      <path className="cross-path" d="M8 8l8 8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path className="cross-path" d="M16 8l-8 8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ spark burst ------------------------------ */

export function SparkBurst({ color = "#34d399", count = 12 }: { color?: string; count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 42 + (i % 3) * 16;
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          delay: (i % 4) * 0.04,
          size: 5 + (i % 3) * 3,
        };
      }),
    [count],
  );
  return (
    <span className="pg-burst pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden>
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute block rounded-full"
          style={
            {
              width: b.size,
              height: b.size,
              background: color,
              boxShadow: `0 0 8px ${color}`,
              "--bx": `${b.x}px`,
              "--by": `${b.y}px`,
              animation: `pg-burst-out .72s cubic-bezier(.2,.8,.3,1) ${b.delay}s forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/* ---------------------------- full-screen banner --------------------------- */

export type RevealKind = "correct" | "wrong" | "timeout" | null;

const COPY: Record<
  Exclude<RevealKind, null>,
  { title: string; sub: string; emoji: string; from: string; to: string }
> = {
  correct: {
    title: "সঠিক উত্তর!",
    sub: "দুর্দান্ত — চালিয়ে যান",
    emoji: "🎉",
    from: "#059669",
    to: "#10b981",
  },
  wrong: {
    title: "ভুল হয়েছে",
    sub: "ব্যাখ্যাটি দেখে নিন",
    emoji: "💡",
    from: "#e11d48",
    to: "#fb7185",
  },
  timeout: {
    title: "সময় শেষ",
    sub: "পরের প্রশ্নে প্রস্তুত থাকুন",
    emoji: "⏱️",
    from: "#475569",
    to: "#94a3b8",
  },
};

/**
 * Short, purposeful feedback banner shown to a student the moment the host
 * reveals the answer. Auto-dismisses so it never blocks the next question.
 */
export function AnswerFeedback({
  kind,
  points,
  streak,
  onDone,
}: {
  kind: RevealKind;
  points?: number;
  streak?: number;
  onDone?: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!kind) return;
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, 2200);
    return () => clearTimeout(t);
  }, [kind, onDone]);

  if (!kind || !show) return null;
  const c = COPY[kind];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-3" role="status" aria-live="polite">
      <div
        className="reveal-banner relative flex items-center gap-3 overflow-hidden rounded-2xl px-5 py-3.5 text-white shadow-2xl"
        style={{ background: `linear-gradient(120deg, ${c.from}, ${c.to})` }}
      >
        {kind === "correct" ? <SparkBurst color="#fff" count={14} /> : null}
        <span className={cx("text-3xl", kind === "correct" ? "reveal-badge" : "")}>{c.emoji}</span>
        <span className="relative z-10">
          <span className="block text-lg font-extrabold leading-tight">{c.title}</span>
          <span className="block text-xs opacity-90">{c.sub}</span>
        </span>
        {points ? (
          <span className="relative z-10 rounded-xl bg-black/25 px-3 py-1.5 text-lg font-black tabular-nums">
            +{Math.round(points)}
          </span>
        ) : null}
        {kind === "correct" && (streak ?? 0) >= 3 ? (
          <span className="relative z-10 rounded-full bg-black/25 px-2.5 py-1 text-xs font-bold">
            🔥 {streak}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Floating "+250" that rises from the score chip. */
export function ScorePop({ points }: { points: number }) {
  if (!points) return null;
  return (
    <span className="score-float pointer-events-none absolute -top-1 right-0 text-lg font-black text-emerald-300 drop-shadow">
      +{Math.round(points)}
    </span>
  );
}

/* ------------------------- host-side answer tally ------------------------- */

/** Animated bar chart of how many players picked each option. */
export function AnswerDistribution({
  options,
  counts,
  correct,
  palette,
}: {
  options: string[];
  counts: number[];
  correct: (string | number)[];
  palette: string[];
}) {
  const total = Math.max(1, counts.reduce((a, b) => a + b, 0));
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {options.map((opt, i) => {
        const isCorrect = correct.map(Number).includes(i);
        const n = counts[i] ?? 0;
        const pct = Math.round((n / total) * 100);
        return (
          <div
            key={i}
            className={cx(
              "relative overflow-hidden rounded-xl border px-3 py-2.5",
              isCorrect ? "border-emerald-400 bg-emerald-50 reveal-correct" : "border-[var(--pg-line)] bg-white reveal-dim",
            )}
          >
            <div
              className="absolute inset-y-0 left-0 opacity-25 transition-[width] duration-700"
              style={{ width: `${pct}%`, background: palette[i % palette.length] }}
            />
            <div className="relative flex items-center gap-2">
              {isCorrect ? <TickMark size={20} /> : <span className="h-5 w-5" />}
              <span className="flex-1 truncate text-sm font-semibold">{opt}</span>
              <span className="tabular-nums text-sm font-bold">{n}</span>
              <span className="tabular-nums text-xs text-slate-500">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
