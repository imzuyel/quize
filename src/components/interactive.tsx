"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, cx } from "./ui";
import { ThemedAnswers } from "./theme-stage";
import { mergeTemplate } from "@/lib/theme";

export const INTERACTIVE_TYPES = [
  "word_jumble",
  "crossword",
  "riddle",
  "categorize",
  "matching",
  "ordering",
  "ranking",
  "slider",
  "short_answer",
  "fill_blank",
  "word_cloud",
];

/** Everything that is answered with the standard option grid. */
export function isGridType(type: string) {
  return !INTERACTIVE_TYPES.includes(type);
}

type Props = {
  config?: unknown;
  type: string;
  text: string;
  options: string[];
  value: (string | number)[];
  disabled?: boolean;
  reveal?: boolean;
  correct?: (string | number)[];
  hidden?: number[];
  onChange: (value: (string | number)[]) => void;
  onSubmit?: () => void;
};

export function QuestionInput({
  config,
  type,
  options,
  value,
  disabled,
  reveal,
  correct,
  hidden,
  onChange,
  onSubmit,
}: Props) {
  const theme = mergeTemplate(config);

  /* ------------------------- letter / word puzzles ------------------------ */
  if (type === "word_jumble" || type === "crossword") {
    return (
      <LetterPuzzle
        tiles={type === "word_jumble" ? options : []}
        length={String(correct?.[0] ?? "").length || undefined}
        value={String(value[0] ?? "")}
        accent={theme.accent}
        radius={theme.radius}
        disabled={disabled}
        reveal={reveal}
        answer={String(correct?.[0] ?? "")}
        onChange={(v) => onChange([v])}
        onSubmit={onSubmit}
      />
    );
  }

  /* -------------------------------- riddle -------------------------------- */
  if (type === "riddle" || type === "short_answer" || type === "fill_blank" || type === "word_cloud") {
    return (
      <div>
        <input
          value={String(value[0] ?? "")}
          onChange={(e) => onChange([e.target.value])}
          disabled={disabled}
          placeholder={type === "riddle" ? "আপনার অনুমান লিখুন…" : "উত্তর লিখুন…"}
          className="w-full rounded-2xl border-2 px-4 py-4 text-lg font-semibold outline-none"
          style={{ borderColor: theme.accent, borderRadius: theme.radius }}
        />
        {reveal && correct?.length ? (
          <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-sm font-bold text-emerald-800">
            সঠিক উত্তর: {String(correct[0])}
          </p>
        ) : null}
        {onSubmit && !disabled ? (
          <Button block size="lg" className="mt-3" onClick={onSubmit}>জমা দিন</Button>
        ) : null}
      </div>
    );
  }

  /* ------------------------------ categorize ------------------------------ */
  if (type === "categorize") {
    const buckets = Array.from(new Set((correct ?? []).map(String)));
    const fallback = buckets.length ? buckets : ["ক", "খ"];
    return (
      <Categorize
        items={options}
        buckets={fallback}
        value={value.map(String)}
        correct={(correct ?? []).map(String)}
        reveal={reveal}
        disabled={disabled}
        accent={theme.accent}
        palette={theme.answerPalette}
        radius={theme.radius}
        onChange={(v) => onChange(v)}
        onSubmit={onSubmit}
      />
    );
  }

  /* ------------------------------- matching ------------------------------- */
  if (type === "matching") {
    return (
      <Matching
        pairs={options}
        value={value.map(Number)}
        disabled={disabled}
        reveal={reveal}
        palette={theme.answerPalette}
        radius={theme.radius}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
  }

  /* --------------------------- ordering / ranking -------------------------- */
  if (type === "ordering" || type === "ranking") {
    return (
      <OrderList
        options={options}
        value={value.length ? value.map(Number) : options.map((_, i) => i)}
        disabled={disabled}
        reveal={reveal}
        correct={(correct ?? []).map(Number)}
        palette={theme.answerPalette}
        radius={theme.radius}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
  }

  /* -------------------------------- slider -------------------------------- */
  if (type === "slider") {
    const v = Number(value[0] ?? 50);
    return (
      <div className="rounded-2xl bg-white/95 p-4">
        <input
          type="range" min={0} max={100} value={v}
          onChange={(e) => onChange([Number(e.target.value)])}
          disabled={disabled}
          className="w-full"
          style={{ accentColor: theme.primary }}
        />
        <p className="mt-1 text-center text-3xl font-black" style={{ color: theme.primary }}>{v}</p>
        {reveal && correct?.length ? (
          <p className="text-center text-sm font-bold text-emerald-700">সঠিক: {String(correct[0])}</p>
        ) : null}
        {onSubmit && !disabled ? (
          <Button block size="lg" className="mt-3" onClick={onSubmit}>জমা দিন</Button>
        ) : null}
      </div>
    );
  }

  /* ------------------------------ option grid ------------------------------ */
  return (
    <ThemedAnswers
      config={theme}
      options={options}
      type={type}
      selected={value}
      hidden={hidden}
      reveal={reveal}
      correct={correct}
      disabled={disabled}
      onSelect={(i) => {
        if (type === "multi_select" || type === "poll") {
          const prev = value.map(Number);
          onChange(prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
        } else {
          onChange([i]);
        }
      }}
    />
  );
}

/* ------------------------------------------------------------------ */

function LetterPuzzle({
  tiles, length, value, accent, radius, disabled, reveal, answer, onChange, onSubmit,
}: {
  tiles: string[];
  length?: number;
  value: string;
  accent: string;
  radius: number;
  disabled?: boolean;
  reveal?: boolean;
  answer: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
}) {
  const slots = length ?? Math.max(4, value.length + 2);
  return (
    <div className="rounded-2xl bg-white/95 p-4">
      {tiles.length ? (
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          {tiles.map((t, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value + t)}
              className="grid h-11 w-11 place-items-center rounded-xl text-lg font-black text-white active:scale-95"
              style={{ background: accent, borderRadius: radius / 1.6 }}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length: slots }).map((_, i) => (
          <span
            key={i}
            className="grid h-11 w-9 place-items-center border-b-4 text-xl font-black"
            style={{ borderColor: accent }}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        disabled={disabled}
        placeholder="টাইপ করুন বা অক্ষরে ট্যাপ করুন"
        className="mt-3 w-full rounded-xl border px-3 py-2.5 text-center text-sm"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange(value.slice(0, -1))}>
          ⌫ মুছুন
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange("")}>রিসেট</Button>
        {onSubmit && !disabled ? (
          <Button size="sm" className="flex-1" onClick={onSubmit}>জমা দিন</Button>
        ) : null}
      </div>
      {reveal && answer ? (
        <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-center text-sm font-bold text-emerald-800">
          সঠিক উত্তর: {answer}
        </p>
      ) : null}
    </div>
  );
}

function Categorize({
  items, buckets, value, correct, reveal, disabled, accent, palette, radius, onChange, onSubmit,
}: {
  items: string[];
  buckets: string[];
  value: string[];
  correct: string[];
  reveal?: boolean;
  disabled?: boolean;
  accent: string;
  palette: string[];
  radius: number;
  onChange: (v: string[]) => void;
  onSubmit?: () => void;
}) {
  const assigned = useMemo(
    () => items.map((_, i) => value[i] ?? ""),
    [items, value],
  );
  const set = (idx: number, bucket: string) => {
    const next = [...assigned];
    next[idx] = next[idx] === bucket ? "" : bucket;
    onChange(next);
  };
  return (
    <div className="rounded-2xl bg-white/95 p-4">
      <div className="space-y-2">
        {items.map((item, i) => {
          const good = reveal && assigned[i] === correct[i];
          const bad = reveal && assigned[i] && assigned[i] !== correct[i];
          return (
            <div
              key={i}
              className={cx(
                "rounded-xl border p-2.5",
                good && "border-emerald-400 bg-emerald-50",
                bad && "border-rose-300 bg-rose-50",
              )}
              style={{ borderRadius: radius / 1.4 }}
            >
              <p className="mb-1.5 text-sm font-bold">{item}</p>
              <div className="flex flex-wrap gap-1.5">
                {buckets.map((b, bi) => (
                  <button
                    key={b}
                    type="button"
                    disabled={disabled}
                    onClick={() => set(i, b)}
                    className={cx(
                      "rounded-lg px-3 py-2 text-xs font-bold transition",
                      assigned[i] === b ? "text-white" : "text-slate-600",
                    )}
                    style={{
                      background: assigned[i] === b ? palette[bi % palette.length] : "#f1f5f9",
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
              {reveal && bad ? (
                <p className="mt-1 text-[11px] font-bold text-emerald-700">সঠিক: {correct[i]}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {onSubmit && !disabled ? (
        <Button block size="lg" className="mt-3" style={{ background: accent }} onClick={onSubmit}>
          জমা দিন
        </Button>
      ) : null}
    </div>
  );
}

function Matching({
  pairs, value, disabled, reveal, palette, radius, onChange, onSubmit,
}: {
  pairs: string[];
  value: number[];
  disabled?: boolean;
  reveal?: boolean;
  palette: string[];
  radius: number;
  onChange: (v: number[]) => void;
  onSubmit?: () => void;
}) {
  // Options arrive as "left → right"; the learner rebuilds each pair.
  const parsed = pairs.map((p) => {
    const [l, r] = p.split("→").map((x) => x.trim());
    return { left: l ?? p, right: r ?? p };
  });
  const [rights] = useState(() => parsed.map((p, i) => ({ i, text: p.right })).sort(() => Math.random() - 0.5));
  const [active, setActive] = useState<number | null>(null);

  const pick = (leftIdx: number, rightIdx: number) => {
    const next = [...value];
    while (next.length < parsed.length) next.push(-1);
    next[leftIdx] = rightIdx;
    onChange(next);
    setActive(null);
  };

  return (
    <div className="rounded-2xl bg-white/95 p-4">
      <div className="space-y-2">
        {parsed.map((p, i) => {
          const chosen = value[i];
          const good = reveal && chosen === i;
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-white"
                style={{ background: palette[i % palette.length], borderRadius: radius / 1.4 }}
              >
                {p.left}
              </span>
              <span className="text-slate-400">→</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setActive(active === i ? null : i)}
                className={cx(
                  "flex-1 rounded-xl border-2 border-dashed px-3 py-2.5 text-left text-sm font-semibold",
                  active === i && "border-[var(--pg-teal)] bg-teal-50",
                  good && "border-emerald-400 bg-emerald-50",
                  reveal && chosen >= 0 && !good && "border-rose-300 bg-rose-50",
                )}
              >
                {chosen >= 0 && chosen != null ? parsed[chosen]?.right : "বেছে নিন…"}
              </button>
            </div>
          );
        })}
      </div>

      {active !== null ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-2">
          <p className="mb-1.5 text-xs font-bold text-slate-500">মিল করুন:</p>
          <div className="flex flex-wrap gap-1.5">
            {rights.map((r) => (
              <button
                key={r.i}
                type="button"
                onClick={() => pick(active, r.i)}
                className="rounded-lg border border-[var(--pg-line)] bg-white px-3 py-2 text-xs font-semibold"
              >
                {r.text}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {onSubmit && !disabled ? (
        <Button block size="lg" className="mt-3" onClick={onSubmit}>জমা দিন</Button>
      ) : null}
    </div>
  );
}

function OrderList({
  options, value, disabled, reveal, correct, palette, radius, onChange, onSubmit,
}: {
  options: string[];
  value: number[];
  disabled?: boolean;
  reveal?: boolean;
  correct: number[];
  palette: string[];
  radius: number;
  onChange: (v: number[]) => void;
  onSubmit?: () => void;
}) {
  const [order, setOrder] = useState<number[]>(value);
  useEffect(() => {
    if (value.length) setOrder(value);
  }, [value]);

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
    onChange(next);
  };

  return (
    <div className="rounded-2xl bg-white/95 p-4">
      <p className="mb-2 text-xs font-bold text-slate-500">↑↓ চেপে সঠিক ক্রমে সাজান</p>
      <div className="space-y-2">
        {order.map((optIdx, pos) => {
          const good = reveal && correct[pos] === optIdx;
          return (
            <div
              key={optIdx}
              className={cx(
                "flex items-center gap-2 rounded-xl px-3 py-2.5",
                good && "ring-2 ring-emerald-400",
              )}
              style={{ background: palette[pos % palette.length], borderRadius: radius / 1.4 }}
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-black/25 text-xs font-black text-white">
                {pos + 1}
              </span>
              <span className="flex-1 text-sm font-bold text-white">{options[optIdx]}</span>
              <button type="button" disabled={disabled} onClick={() => move(pos, -1)} aria-label="up" className="px-1.5 text-lg text-white">↑</button>
              <button type="button" disabled={disabled} onClick={() => move(pos, 1)} aria-label="down" className="px-1.5 text-lg text-white">↓</button>
            </div>
          );
        })}
      </div>
      {onSubmit && !disabled ? (
        <Button block size="lg" className="mt-3" onClick={onSubmit}>জমা দিন</Button>
      ) : null}
    </div>
  );
}
