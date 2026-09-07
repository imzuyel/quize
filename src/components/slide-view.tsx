"use client";

import { FONT_STACK, getTheme, resolveMedia, type Slide, type SlideTheme } from "@/lib/slides";
import { cx } from "./ui";

const ANIM_CLASS: Record<string, string> = {
  fade: "anim-fade",
  slide: "anim-slide",
  zoom: "anim-zoom",
  flip: "anim-flip",
  reveal: "anim-reveal",
  cube: "anim-cube",
  swipe: "anim-swipe",
  none: "",
};

/** Animated backdrop matching the theme's motion setting. */
function Motion({ t }: { t: SlideTheme }) {
  const { motion, primary, accent } = t;
  if (motion === "none") return null;

  if (motion === "aurora")
    return (
      <div className="pg-layer overflow-hidden">
        <span className="pg-blob" style={{ width: "55%", height: "70%", left: "-10%", top: "-18%", background: primary, opacity: 0.5, animation: "pg-aurora-a 15s ease-in-out infinite" }} />
        <span className="pg-blob" style={{ width: "50%", height: "62%", right: "-8%", top: "8%", background: accent, opacity: 0.35, animation: "pg-aurora-b 18s ease-in-out infinite" }} />
      </div>
    );

  if (motion === "mesh")
    return (
      <div className="pg-layer" style={{
        background: `radial-gradient(60% 60% at 20% 25%, ${primary}55, transparent 60%), radial-gradient(55% 55% at 82% 20%, ${accent}44, transparent 60%)`,
        backgroundSize: "180% 180%", animation: "pg-bg-pan 17s ease-in-out infinite",
      }} />
    );

  if (motion === "waves")
    return (
      <div className="pg-layer overflow-hidden">
        {[0, 1].map((i) => (
          <svg key={i} viewBox="0 0 1200 120" preserveAspectRatio="none"
            className="absolute left-0 h-[28%] w-[200%]"
            style={{ bottom: `${i * 8}%`, opacity: 0.18 + i * 0.1, animation: `pg-wave ${20 + i * 8}s linear infinite` }}>
            <path d="M0,60 C150,110 350,0 600,55 C850,110 1050,10 1200,60 L1200,120 L0,120 Z M1200,60 C1350,110 1550,0 1800,55 C2050,110 2250,10 2400,60 L2400,120 L1200,120 Z"
              fill={i ? accent : primary} />
          </svg>
        ))}
      </div>
    );

  if (motion === "grid")
    return (
      <div className="pg-layer" style={{
        backgroundImage: `linear-gradient(${accent}20 1px, transparent 1px), linear-gradient(90deg, ${accent}20 1px, transparent 1px)`,
        backgroundSize: "48px 48px", animation: "pg-grid-scroll 7s linear infinite",
        maskImage: "radial-gradient(75% 75% at 50% 45%, #000 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(75% 75% at 50% 45%, #000 40%, transparent 100%)",
      }} />
    );

  if (motion === "stars")
    return (
      <div className="pg-layer overflow-hidden">
        {Array.from({ length: 34 }).map((_, i) => (
          <span key={i} className="absolute rounded-full bg-white"
            style={{
              width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3,
              left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`,
              opacity: 0.6, animation: `pg-twinkle ${2 + (i % 4)}s ease-in-out infinite`,
            }} />
        ))}
      </div>
    );

  if (motion === "bubbles")
    return (
      <div className="pg-layer overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="absolute rounded-full"
            style={{
              width: 22 + ((i * 17) % 60), height: 22 + ((i * 17) % 60),
              left: `${(i * 61) % 94}%`, bottom: "-12%",
              border: `2px solid ${(i % 2 ? accent : primary)}55`,
              background: `${(i % 2 ? accent : primary)}18`,
              animation: `pg-particle-rise ${12 + (i % 6) * 2}s linear infinite`,
              animationDelay: `${(i % 8) * 1.1}s`,
            }} />
        ))}
      </div>
    );

  if (motion === "rings")
    return (
      <div className="pg-layer grid place-items-center overflow-hidden">
        {[0, 1, 2].map((i) => (
          <span key={i} className="absolute rounded-full"
            style={{
              width: "44vmin", height: "44vmin",
              border: `2px solid ${i % 2 ? accent : primary}`,
              animation: "pg-ring-expand 6s ease-out infinite", animationDelay: `${i * 2}s`,
            }} />
        ))}
      </div>
    );

  if (motion === "circuit")
    return (
      <div className="pg-layer overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 300">
          {["M10,40 H120 V110 H240 V60 H390", "M10,160 H80 V230 H210 V180 H390", "M10,265 H170 V215 H310 V275 H390"].map((d, i) => (
            <path key={i} d={d} fill="none" stroke={i % 2 ? accent : primary} strokeWidth="1.6"
              strokeDasharray="14 10" opacity="0.45"
              style={{ animation: `pg-circuit-dash ${8 + i * 2}s linear infinite` }} />
          ))}
        </svg>
      </div>
    );

  return null;
}

/** Image / video / embed block used by every media-aware layout. */
function Media({
  slide,
  scale,
  rounded = true,
  live,
}: {
  slide: Slide;
  scale: number;
  rounded?: boolean;
  live: boolean;
}) {
  const url = slide.media?.url || slide.image || "";
  const { kind, src } = resolveMedia(url);
  const fit = slide.media?.fit ?? "cover";

  if (!src)
    return (
      <div
        className="grid h-full w-full place-items-center"
        style={{
          background: "rgba(255,255,255,.08)",
          borderRadius: rounded ? 16 * scale : 0,
          border: "2px dashed rgba(255,255,255,.25)",
          fontSize: `${28 * scale}px`,
        }}
      >
        🖼️
      </div>
    );

  const style: React.CSSProperties = {
    borderRadius: rounded ? 16 * scale : 0,
    objectFit: fit,
    width: "100%",
    height: "100%",
  };

  if (kind === "youtube" || kind === "embed")
    return live ? (
      <iframe
        src={src}
        title={slide.title || "media"}
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ ...style, border: 0 }}
      />
    ) : (
      <div className="grid h-full w-full place-items-center"
        style={{ background: "#000", borderRadius: rounded ? 16 * scale : 0, fontSize: `${26 * scale}px` }}>
        ▶️
      </div>
    );

  if (kind === "video")
    return (
      <video
        src={src}
        controls={live}
        playsInline
        muted={!live}
        preload="metadata"
        style={style}
      />
    );

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={slide.media?.caption ?? slide.title ?? ""} style={style} />;
}

/**
 * Renders one slide. `scale` shrinks all typography for thumbnails so the
 * preview is pixel-accurate to the presentation view.
 */
export function SlideView({
  slide,
  themeId,
  scale = 1,
  animate = true,
  live = false,
  className,
}: {
  slide: Slide;
  themeId: string;
  scale?: number;
  animate?: boolean;
  /** Enables interactive media (video controls, iframes). */
  live?: boolean;
  className?: string;
}) {
  const t = getTheme(themeId);
  const f = (px: number) => `${(px * scale).toFixed(1)}px`;
  const anim = animate ? ANIM_CLASS[slide.anim] ?? "anim-fade" : "";
  const bullets = (slide.bullets ?? []).filter(Boolean);

  // Element-level entrance: applied to title/bullets with an optional stagger.
  const el = animate ? `el-${slide.elementAnim ?? "fade_up"}` : "";
  const step = slide.stagger ?? 90;
  const delay = (i: number): React.CSSProperties =>
    animate ? { animationDelay: `${i * step}ms` } : {};

  const mediaUrl = slide.media?.url || slide.image || "";
  const pos = slide.media?.position ?? "right";
  const hasMedia = Boolean(mediaUrl) || slide.layout === "media" || slide.layout === "image_text";
  const isBackdrop = hasMedia && (pos === "background" || slide.layout === "media" || pos === "full");

  const Title = ({ size = 44, center = false }: { size?: number; center?: boolean }) => (
    <h2
      className={cx("font-extrabold leading-tight", center && "text-center", el)}
      style={{ fontSize: f(size), color: t.text, ...delay(0) }}
    >
      {slide.icon ? <span className="mr-2">{slide.icon}</span> : null}
      {slide.title}
    </h2>
  );

  const Sub = ({ size = 20, center = false }: { size?: number; center?: boolean }) =>
    slide.subtitle ? (
      <p className={cx(center && "text-center", el)} style={{ fontSize: f(size), color: t.muted, marginTop: 8 * scale, ...delay(1) }}>
        {slide.subtitle}
      </p>
    ) : null;

  const Bar = ({ center }: { center?: boolean }) => (
    <span className={cx("block rounded-full", center && "mx-auto")}
      style={{ width: 64 * scale, height: 4 * scale, background: t.accent, marginTop: 12 * scale }} />
  );

  return (
    <div
      className={cx("relative isolate flex h-full w-full flex-col overflow-hidden", className)}
      style={{ background: t.bg, fontFamily: FONT_STACK[t.font], color: t.text }}
    >
      <Motion t={t} />

      {isBackdrop && mediaUrl ? (
        <>
          <div className="absolute inset-0 z-0">
            <Media slide={slide} scale={scale} rounded={false} live={live} />
          </div>
          <div
            className="absolute inset-0 z-0"
            style={{ background: `rgba(2,6,23,${(slide.media?.dim ?? 55) / 100})` }}
          />
        </>
      ) : null}

      <span className="absolute inset-y-0 left-0 z-10" style={{ width: 6 * scale, background: t.primary }} />

      <div
        className="relative z-10 flex h-full flex-col justify-center"
        style={{ padding: `${44 * scale}px ${56 * scale}px ${44 * scale}px ${64 * scale}px` }}
      >
        {slide.layout === "title" || slide.layout === "section" || slide.layout === "closing" ? (
          <div className="text-center">
            {slide.icon ? (
              <div className={el} style={{ fontSize: f(64), ...delay(0) }}>{slide.icon}</div>
            ) : null}
            <h1 className={cx("font-extrabold leading-tight", el)}
              style={{ fontSize: f(slide.layout === "title" ? 54 : 44), color: t.text, marginTop: 10 * scale, ...delay(1) }}>
              {slide.title}
            </h1>
            <Sub size={22} center />
            <Bar center />
          </div>
        ) : slide.layout === "quote" ? (
          <div className="text-center">
            <div className={anim} style={{ fontSize: f(56), color: t.accent, lineHeight: 1 }}>❝</div>
            <p className={cx("font-bold italic leading-snug", anim)}
              style={{ fontSize: f(34), color: t.text, marginTop: 12 * scale }}>
              {slide.title}
            </p>
            <Sub size={18} center />
          </div>
        ) : slide.layout === "big_number" ? (
          <div className="text-center">
            <p className={cx("font-black leading-none", anim)} style={{ fontSize: f(110), color: t.accent }}>
              {slide.title}
            </p>
            <Sub size={24} center />
          </div>
        ) : slide.layout === "media" ? (
          <div className="flex h-full flex-col justify-end">
            <h2 className={cx("font-extrabold", el)} style={{ fontSize: f(38), ...delay(0) }}>
              {slide.icon ? <span className="mr-2">{slide.icon}</span> : null}
              {slide.title}
            </h2>
            <Sub size={20} />
            {slide.media?.caption ? (
              <p className={el} style={{ fontSize: f(15), color: t.muted, marginTop: 6 * scale, ...delay(2) }}>
                {slide.media.caption}
              </p>
            ) : null}
          </div>
        ) : hasMedia && (pos === "left" || pos === "right" || pos === "top") ? (
          <div
            className={cx("flex h-full gap-6", pos === "top" ? "flex-col" : pos === "left" ? "flex-row-reverse" : "flex-row")}
            style={{ gap: 26 * scale }}
          >
            <div className={cx("flex min-w-0 flex-col justify-center", pos === "top" ? "" : "flex-1")}>
              <Title size={34} />
              <Bar />
              <ul style={{ marginTop: 18 * scale }}>
                {bullets.map((b, i) => (
                  <li key={i} className={cx("flex items-start", el)}
                    style={{ gap: 10 * scale, marginBottom: 12 * scale, ...delay(i + 2) }}>
                    <span className="shrink-0 rounded-full"
                      style={{ width: 8 * scale, height: 8 * scale, background: t.accent, marginTop: 9 * scale }} />
                    <span style={{ fontSize: f(19), color: t.text, lineHeight: 1.45 }}>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className={cx("shrink-0 overflow-hidden", el)}
              style={{
                ...delay(1),
                width: pos === "top" ? "100%" : "42%",
                height: pos === "top" ? "46%" : "auto",
                minHeight: pos === "top" ? undefined : "62%",
                borderRadius: 16 * scale,
              }}
            >
              <Media slide={slide} scale={scale} live={live} />
            </div>
          </div>
        ) : (
          <>
            <Title size={38} />
            <Bar />
            {slide.layout === "two_column" || slide.layout === "comparison" ? (
              <div className="grid flex-1 grid-cols-2 items-start" style={{ gap: 24 * scale, marginTop: 22 * scale }}>
                {[0, 1].map((col) => {
                  const half = Math.ceil(bullets.length / 2);
                  const items = col === 0 ? bullets.slice(0, half) : bullets.slice(half);
                  return (
                    <div key={col} className="rounded-2xl"
                      style={{ background: t.surface, padding: 18 * scale, border: `1px solid ${t.dark ? "rgba(255,255,255,.16)" : "rgba(15,23,42,.08)"}` }}>
                      {items.map((b, i) => (
                        <p key={i} className={el}
                          style={{ fontSize: f(18), color: t.text, marginBottom: 10 * scale, ...delay(i + 2) }}>
                          <span style={{ color: col ? t.accent : t.primary, marginRight: 8 }}>●</span>
                          {b}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : slide.layout === "timeline" ? (
              <ol className="flex-1" style={{ marginTop: 22 * scale }}>
                {bullets.map((b, i) => (
                  <li key={i} className={cx("flex items-start", el)}
                    style={{ gap: 14 * scale, marginBottom: 14 * scale, ...delay(i + 2) }}>
                    <span className="grid shrink-0 place-items-center rounded-full font-black"
                      style={{ width: 34 * scale, height: 34 * scale, fontSize: f(16), background: t.accent, color: t.dark ? "#0b1120" : "#fff" }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: f(20), color: t.text, paddingTop: 4 * scale }}>{b}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="flex-1" style={{ marginTop: 22 * scale }}>
                {bullets.map((b, i) => (
                  <li key={i} className={cx("flex items-start", el)}
                    style={{ gap: 12 * scale, marginBottom: 14 * scale, ...delay(i + 2) }}>
                    <span className="shrink-0 rounded-full"
                      style={{ width: 9 * scale, height: 9 * scale, background: t.accent, marginTop: 10 * scale }} />
                    <span style={{ fontSize: f(22), color: t.text, lineHeight: 1.45 }}>{b}</span>
                  </li>
                ))}
                {!bullets.length && slide.body ? (
                  <p style={{ fontSize: f(20), color: t.muted }}>{slide.body}</p>
                ) : null}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
