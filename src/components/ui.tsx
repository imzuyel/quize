"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* --------------------------------- Button -------------------------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  block,
  className,
  children,
  disabled,
  ...rest
}: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const sizes = {
    sm: "text-sm px-3 py-2 min-h-[38px]",
    md: "text-sm px-4 py-2.5 min-h-[44px]",
    lg: "text-base px-6 py-3.5 min-h-[52px]",
  }[size];
  const variants = {
    primary: "bg-[var(--pg-teal)] text-white hover:bg-[var(--pg-teal-soft)] shadow-sm",
    secondary: "bg-[var(--pg-deep)] text-white hover:bg-[#16405f]",
    gold: "bg-[var(--pg-gold)] text-[#3b2a06] hover:brightness-105",
    danger: "bg-[var(--pg-coral)] text-white hover:brightness-105",
    outline: "border border-[var(--pg-line)] bg-white text-[var(--pg-ink)] hover:bg-slate-50",
    ghost: "text-[var(--pg-deep)] hover:bg-slate-100",
  }[variant];
  return (
    <button
      className={cx(base, sizes, variants, block && "w-full", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
}

/* --------------------------------- Card ---------------------------------- */
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cx("pg-surface pg-shadow", padded && "p-5", className)}>{children}</div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Inputs --------------------------------- */
export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label} {required && <span className="text-[var(--pg-coral)]">*</span>}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-400 mt-1">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--pg-line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--pg-teal)] min-h-[44px]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "min-h-[90px]", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "pr-8", props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--pg-line)] bg-white px-3 py-2.5 text-left text-sm min-h-[44px]"
    >
      <span className="font-medium text-slate-700">{label}</span>
      <span
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-[var(--pg-teal)]" : "bg-slate-300",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/* -------------------------------- Badge ---------------------------------- */
export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "teal" | "gold" | "coral" | "blue" | "green";
  className?: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    teal: "bg-teal-50 text-teal-800",
    gold: "bg-amber-50 text-amber-800",
    coral: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-800",
    green: "bg-emerald-50 text-emerald-800",
  }[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Progress -------------------------------- */
export function Progress({ value, tone = "teal" }: { value: number; tone?: string }) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: tone === "gold" ? "var(--pg-gold)" : "var(--pg-teal)",
        }}
      />
    </div>
  );
}

/* -------------------------------- Spinner -------------------------------- */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
      aria-label="loading"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("pg-skeleton rounded-xl", className)} />;
}

export function EmptyState({
  icon = "🗂️",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--pg-line)] bg-white/70 px-6 py-12 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="font-semibold">{title}</p>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-semibold">⚠️ {message}</p>
      {retry ? (
        <Button size="sm" variant="outline" className="mt-3" onClick={retry}>
          আবার চেষ্টা করুন
        </Button>
      ) : null}
    </div>
  );
}

/* --------------------------------- Modal --------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cx(
          "anim-fade max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-2xl pg-scroll",
          wide ? "sm:max-w-4xl" : "sm:max-w-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 id={id} className="text-lg font-bold">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        className="anim-slide h-full w-full max-w-md overflow-y-auto bg-white p-5 pg-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-xl text-slate-400" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------- Tabs ---------------------------------- */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cx(
            "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition min-h-[40px]",
            active === tab.id
              ? "bg-white text-[var(--pg-deep)] shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          {tab.icon ? <span className="mr-1">{tab.icon}</span> : null}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Toasts --------------------------------- */
type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<{ push: (m: string, t?: Toast["tone"]) => void }>({
  push: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = ++counter.current;
    setItems((s) => [...s, { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3800);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(94vw,420px)] -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              "anim-fade pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg",
              t.tone === "success"
                ? "bg-emerald-600"
                : t.tone === "error"
                  ? "bg-rose-600"
                  : "bg-slate-800",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* --------------------------------- Table --------------------------------- */
export function Table({
  head,
  children,
}: {
  head: (string | ReactNode)[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--pg-line)] bg-white pg-scroll">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

/* --------------------------------- Stats --------------------------------- */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  tone?: "teal" | "gold" | "blue" | "coral";
}) {
  const bg = {
    teal: "from-teal-500/10 to-teal-500/0",
    gold: "from-amber-400/15 to-amber-400/0",
    blue: "from-sky-500/10 to-sky-500/0",
    coral: "from-rose-500/10 to-rose-500/0",
  }[tone];
  return (
    <div className={cx("pg-surface pg-shadow relative overflow-hidden p-4 bg-gradient-to-br", bg)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="text-xl">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

/* --------------------------------- Charts -------------------------------- */
export function BarChart({
  data,
  max,
}: {
  data: { label: string; value: number; color?: string }[];
  max?: number;
}) {
  const top = max ?? Math.max(100, ...data.map((d) => d.value));
  if (!data.length) return <EmptyState title="ডেটা নেই" icon="📊" />;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
            <span className="truncate pr-2">{d.label}</span>
            <span className="tabular-nums">{Math.round(d.value)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(d.value / top) * 100}%`,
                background: d.color ?? "linear-gradient(90deg,#0f7b6c,#12a08c)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ value, label }: { value: number; label: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${label} ${value}%`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--pg-teal)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset .8s ease" }}
        />
        <text x="60" y="66" textAnchor="middle" className="fill-slate-800 text-xl font-bold">
          {Math.round(value)}%
        </text>
      </svg>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const path = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${40 - (p / max) * 36}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-12 w-full" preserveAspectRatio="none">
      <polyline points={path} fill="none" stroke="var(--pg-teal)" strokeWidth="2" />
    </svg>
  );
}

/* ------------------------------- Confetti -------------------------------- */
export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.4 + Math.random() * 1.8,
        color: ["#0f7b6c", "#f0b429", "#e2574c", "#2f80ed", "#12a08c"][i % 5],
        size: 6 + Math.random() * 8,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animation: `pg-confetti-fall ${p.dur}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
