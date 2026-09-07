"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  FONT_STACKS,
  PARTICLE_GLYPH,
  answerStyleFor,
  cardStyle,
  mergeTemplate,
  shade,
  TRANSITION_CLASS,
  type TemplateConfig,
} from "@/lib/theme";
import { cx } from "./ui";
import { CrossMark, SparkBurst, TickMark } from "./reveal";

/* ------------------------------------------------------------------ */
/* Animated background layers                                          */
/* ------------------------------------------------------------------ */

function BackgroundMotionLayer({ cfg }: { cfg: TemplateConfig }) {
  const dur = (base: number) => `${(base / Math.max(0.3, cfg.motionSpeed)).toFixed(1)}s`;
  const { primary, accent, secondary, backgroundMotion: m } = cfg;

  if (m === "static") return null;

  if (m === "aurora")
    return (
      <div className="pg-layer overflow-hidden">
        <span
          className="pg-blob"
          style={{ width: "58%", height: "70%", left: "-12%", top: "-18%", background: primary, opacity: 0.55, animation: `pg-aurora-a ${dur(14)} ease-in-out infinite` }}
        />
        <span
          className="pg-blob"
          style={{ width: "52%", height: "62%", right: "-10%", top: "6%", background: accent, opacity: 0.4, animation: `pg-aurora-b ${dur(17)} ease-in-out infinite` }}
        />
        <span
          className="pg-blob"
          style={{ width: "48%", height: "56%", left: "22%", bottom: "-22%", background: secondary, opacity: 0.42, animation: `pg-aurora-a ${dur(20)} ease-in-out infinite reverse` }}
        />
      </div>
    );

  if (m === "mesh")
    return (
      <div
        className="pg-layer"
        style={{
          background: `radial-gradient(60% 60% at 18% 22%, ${primary}66, transparent 60%),
                       radial-gradient(55% 55% at 82% 18%, ${accent}55, transparent 60%),
                       radial-gradient(65% 65% at 50% 92%, ${secondary}55, transparent 62%)`,
          backgroundSize: "180% 180%",
          animation: `pg-bg-pan ${dur(16)} ease-in-out infinite`,
        }}
      />
    );

  if (m === "gradient_shift")
    return (
      <div
        className="pg-layer"
        style={{
          background: `linear-gradient(120deg, ${primary}, ${accent}, ${secondary}, ${primary})`,
          backgroundSize: "300% 300%",
          opacity: 0.75,
          animation: `pg-bg-pan ${dur(12)} ease-in-out infinite, pg-hue ${dur(26)} linear infinite`,
        }}
      />
    );

  if (m === "waves")
    return (
      <div className="pg-layer overflow-hidden">
        {[0, 1, 2].map((i) => (
          <svg
            key={i}
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="absolute left-0 h-[30%] w-[200%]"
            style={{
              bottom: `${i * 9}%`,
              opacity: 0.16 + i * 0.08,
              animation: `pg-wave ${dur(18 + i * 7)} linear infinite`,
            }}
          >
            <path
              d="M0,60 C150,110 350,0 600,55 C850,110 1050,10 1200,60 L1200,120 L0,120 Z M1200,60 C1350,110 1550,0 1800,55 C2050,110 2250,10 2400,60 L2400,120 L1200,120 Z"
              fill={i === 1 ? accent : i === 2 ? secondary : primary}
            />
          </svg>
        ))}
      </div>
    );

  if (m === "grid_pulse")
    return (
      <div
        className="pg-layer"
        style={{
          backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
          animation: `pg-grid-scroll ${dur(6)} linear infinite`,
          maskImage: "radial-gradient(70% 70% at 50% 45%, #000 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 50% 45%, #000 40%, transparent 100%)",
        }}
      />
    );

  if (m === "neon_rings")
    return (
      <div className="pg-layer grid place-items-center overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: "42vmin",
              height: "42vmin",
              border: `2px solid ${[primary, accent, secondary, accent][i]}`,
              animation: `pg-ring-expand ${dur(6)} ease-out infinite`,
              animationDelay: `${i * 1.5}s`,
            }}
          />
        ))}
      </div>
    );

  if (m === "starfield")
    return (
      <div className="pg-layer overflow-hidden">
        {[0, 1].map((layer) => (
          <div
            key={layer}
            className="absolute inset-0"
            style={{ animation: `pg-star-drift ${dur(layer ? 26 : 16)} linear infinite` }}
          >
            {Array.from({ length: 42 }).map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: layer ? 2 : 3,
                  height: layer ? 2 : 3,
                  left: `${(i * 37 + layer * 13) % 100}%`,
                  top: `${(i * 53 + layer * 29) % 130}%`,
                  opacity: layer ? 0.45 : 0.8,
                  animation: `pg-twinkle ${2 + (i % 4)}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );

  if (m === "bubbles")
    return (
      <div className="pg-layer overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              width: 18 + ((i * 13) % 62),
              height: 18 + ((i * 13) % 62),
              left: `${(i * 61) % 96}%`,
              bottom: "-15%",
              border: `2px solid ${[primary, accent, secondary][i % 3]}66`,
              background: `${[primary, accent, secondary][i % 3]}1f`,
              animation: `pg-particle-rise ${dur(11 + (i % 7) * 2)} linear infinite`,
              animationDelay: `${(i % 9) * 0.9}s`,
            }}
          />
        ))}
      </div>
    );

  if (m === "spotlight")
    return (
      <div className="pg-layer overflow-hidden">
        <div className="pg-rays" style={{ animationDuration: dur(18) }} />
        <span
          className="absolute -top-1/3 left-1/2 h-[160%] w-[42%] -translate-x-1/2"
          style={{
            background: `linear-gradient(to bottom, ${accent}44, transparent 70%)`,
            filter: "blur(28px)",
            animation: `pg-spotlight-sweep ${dur(9)} ease-in-out infinite`,
          }}
        />
      </div>
    );

  if (m === "circuit")
    return (
      <div className="pg-layer overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 300">
          {[
            "M10,40 H120 V110 H240 V60 H390",
            "M10,150 H80 V220 H200 V170 H390",
            "M10,260 H160 V210 H300 V270 H390",
            "M60,10 V90 H150 V10",
          ].map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={[primary, accent, secondary, accent][i]}
              strokeWidth="1.6"
              strokeDasharray="14 10"
              opacity="0.5"
              style={{ animation: `pg-circuit-dash ${dur(7 + i * 2)} linear infinite` }}
            />
          ))}
          {[[120, 110], [240, 60], [80, 220], [200, 170], [160, 210]].map(([cx2, cy], i) => (
            <circle
              key={i}
              cx={cx2}
              cy={cy}
              r="3.5"
              fill={accent}
              style={{ animation: `pg-twinkle ${2 + (i % 3)}s ease-in-out infinite` }}
            />
          ))}
        </svg>
      </div>
    );

  if (m === "confetti_rain")
    return (
      <div className="pg-layer overflow-hidden">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="pg-particle absolute"
            style={
              {
                width: 7,
                height: 12,
                left: `${(i * 41) % 98}%`,
                background: cfg.answerPalette[i % cfg.answerPalette.length],
                "--p-drift": `${((i % 5) - 2) * 26}px`,
                "--p-op": 0.9,
                animation: `pg-particle-fall ${dur(7 + (i % 6))} linear infinite`,
                animationDelay: `${(i % 10) * 0.7}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    );

  return null;
}

/* ------------------------------------------------------------------ */
/* Floating particles                                                  */
/* ------------------------------------------------------------------ */

function ParticleLayer({ cfg }: { cfg: TemplateConfig }) {
  const glyphs = PARTICLE_GLYPH[cfg.particles] ?? [];
  const count = Math.round((cfg.particleDensity / 100) * 34);

  const items = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        glyph: glyphs[i % Math.max(1, glyphs.length)],
        left: (i * 37) % 98,
        size: 10 + ((i * 7) % 18),
        dur: 8 + ((i * 3) % 12),
        delay: (i % 11) * 0.8,
        drift: ((i % 5) - 2) * 30,
        color:
          cfg.particles === "embers"
            ? ["#f59e0b", "#ef4444", "#fbbf24"][i % 3]
            : cfg.particles === "snow"
              ? "#e0f2fe"
              : cfg.particles === "petals"
                ? ""
                : cfg.particles === "code"
                  ? cfg.accent
                  : [cfg.primary, cfg.accent, cfg.secondary][i % 3],
      })),
    [count, glyphs, cfg.particles, cfg.primary, cfg.accent, cfg.secondary],
  );

  if (cfg.particles === "none" || !count) return null;
  const rising = cfg.particles === "embers" || cfg.particles === "bubbles";

  return (
    <div className="pg-layer overflow-hidden" aria-hidden>
      {items.map((p) => (
        <span
          key={p.id}
          className="pg-particle absolute select-none"
          style={
            {
              left: `${p.left}%`,
              [rising ? "bottom" : "top"]: "-8%",
              fontSize: p.size,
              lineHeight: 1,
              color: p.color || undefined,
              textShadow: cfg.glow && p.color ? `0 0 10px ${p.color}` : undefined,
              "--p-drift": `${p.drift}px`,
              "--p-op": cfg.particles === "bokeh" ? 0.35 : 0.8,
              animation: `${rising ? "pg-particle-rise" : "pg-particle-fall"} ${p.dur}s linear infinite`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function ThemeStage({
  config,
  children,
  className,
  minimal,
}: {
  config: unknown;
  children?: ReactNode;
  className?: string;
  minimal?: boolean;
}) {
  const cfg = mergeTemplate(config);
  return (
    <div
      className={cx("relative isolate overflow-hidden", className)}
      style={{ background: cfg.background, fontFamily: FONT_STACKS[cfg.font] ?? FONT_STACKS.sans }}
    >
      {!minimal ? (
        <>
          <BackgroundMotionLayer cfg={cfg} />
          <ParticleLayer cfg={cfg} />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function ThemedCard({
  config,
  children,
  className,
  animate,
  animKey,
}: {
  config: unknown;
  children: ReactNode;
  className?: string;
  animate?: boolean;
  animKey?: string | number;
}) {
  const cfg = mergeTemplate(config);
  return (
    <div
      key={animKey}
      className={cx(animate && TRANSITION_CLASS[cfg.transition], className)}
      style={cardStyle(cfg)}
    >
      {children}
    </div>
  );
}

const SHAPES = ["▲", "◆", "●", "■", "★", "✚"];

export function ThemedAnswers({
  config,
  options,
  type,
  selected,
  disabled,
  reveal,
  correct,
  hidden,
  onSelect,
}: {
  config: unknown;
  options: string[];
  type: string;
  selected: (string | number)[];
  disabled?: boolean;
  reveal?: boolean;
  correct?: (string | number)[];
  hidden?: number[];
  onSelect: (index: number) => void;
}) {
  const cfg = mergeTemplate(config);
  const multi = type === "multi_select" || type === "poll";
  return (
    <div className="grid gap-3 sm:grid-cols-2" role={multi ? "group" : "radiogroup"}>
      {options.map((opt, i) => {
        const isSel = selected.map(Number).includes(i);
        const isCorrect = reveal && (correct ?? []).map(Number).includes(i);
        const isWrong = reveal && isSel && !isCorrect;
        if (hidden?.includes(i))
          return <div key={i} className="min-h-[64px] rounded-2xl bg-black/10" aria-hidden />;
        const state = isCorrect ? "correct" : isWrong ? "wrong" : isSel ? "selected" : "idle";
        return (
          <button
            key={i}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={isSel}
            aria-label={reveal ? `${opt} — ${isCorrect ? "সঠিক উত্তর" : isSel ? "ভুল উত্তর" : ""}` : undefined}
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={cx(
              "relative flex min-h-[64px] items-center gap-3 px-4 py-3.5 text-left text-base font-semibold active:scale-[.985] disabled:cursor-not-allowed",
              isCorrect && "reveal-correct",
              isWrong && "reveal-wrong",
              reveal && !isCorrect && !isSel && "reveal-dim",
            )}
            style={{ ...answerStyleFor(cfg, i, state), animationDelay: reveal ? `${i * 70}ms` : undefined }}
          >
            {isCorrect ? <SparkBurst color={cfg.accent} /> : null}
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg"
              style={{ background: "rgba(0,0,0,.18)" }}
            >
              {SHAPES[i % SHAPES.length]}
            </span>
            <span className="relative z-10 flex-1 leading-snug">{opt}</span>
            {reveal ? (
              <span className="relative z-10 reveal-badge">
                {isCorrect ? <TickMark /> : isSel ? <CrossMark /> : null}
              </span>
            ) : isSel ? (
              <span className="text-xl">✔</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Celebration overlay driven by the theme's resultAnimation. */
export function Celebration({ config }: { config: unknown }) {
  const cfg = mergeTemplate(config);
  const palette = cfg.answerPalette;

  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        id: i,
        left: (i * 29) % 100,
        delay: (i % 12) * 0.12,
        dur: 2.4 + ((i * 7) % 20) / 10,
        color: palette[i % palette.length],
        size: 6 + ((i * 5) % 9),
      })),
    [palette],
  );

  if (cfg.resultAnimation === "minimal") return null;

  if (cfg.resultAnimation === "rays")
    return (
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        <div className="pg-rays" />
      </div>
    );

  if (cfg.resultAnimation === "coins")
    return (
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {pieces.slice(0, 34).map((p) => (
          <span
            key={p.id}
            className="absolute text-2xl"
            style={{ left: `${p.left}%`, animation: `pg-coin-drop ${p.dur}s linear ${p.delay}s forwards` }}
          >
            🪙
          </span>
        ))}
      </div>
    );

  if (cfg.resultAnimation === "fireworks")
    return (
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {Array.from({ length: 7 }).map((_, b) => (
          <span
            key={b}
            className="absolute"
            style={{ left: `${12 + b * 13}%`, top: `${18 + ((b * 17) % 45)}%` }}
          >
            {Array.from({ length: 14 }).map((_, s) => (
              <span
                key={s}
                className="absolute block h-1.5 w-1.5 rounded-full"
                style={{
                  background: palette[(b + s) % palette.length],
                  boxShadow: `0 0 8px ${palette[(b + s) % palette.length]}`,
                  transform: `rotate(${s * 26}deg) translateY(-2px)`,
                  animation: `pg-ring-expand ${1.6 + (b % 3) * 0.3}s ease-out ${b * 0.35}s infinite`,
                }}
              />
            ))}
          </span>
        ))}
      </div>
    );

  if (cfg.resultAnimation === "trophy")
    return (
      <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center" aria-hidden>
        <span className="anim-pop text-[22vmin] drop-shadow-2xl">🏆</span>
      </div>
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
            borderRadius: 2,
            animation: `pg-confetti-fall ${p.dur}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

export { mergeTemplate, shade };
