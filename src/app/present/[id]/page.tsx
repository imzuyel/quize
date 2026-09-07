"use client";

import { use, useCallback, useEffect, useState } from "react";
import { SlideView } from "@/components/slide-view";
import { getTheme, type Slide } from "@/lib/slides";
import { cx } from "@/components/ui";

export default function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("aurora");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const [ui, setUi] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/presentations?id=${id}`).then(async (r) => {
      if (!r.ok) return setLoaded(true);
      const d = await r.json();
      setTitle(d.title);
      setTheme(d.theme);
      setSlides((d.slides as Slide[]) ?? []);
      setLoaded(true);
    });
  }, [id]);

  const go = useCallback(
    (d: number) => setI((v) => Math.max(0, Math.min(slides.length - 1, v + d))),
    [slides.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(slides.length - 1);
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slides.length]);

  // Hide the chrome while the teacher is talking; any move brings it back.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setUi(true);
      clearTimeout(t);
      t = setTimeout(() => setUi(false), 3000);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

  if (!loaded) return <div className="grid min-h-screen place-items-center bg-slate-900 text-white">লোড হচ্ছে…</div>;
  if (!slides.length)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-900 p-6 text-center text-white">
        <div>
          <p className="text-lg font-bold">এই উপস্থাপনায় কোনো স্লাইড নেই</p>
          <a href={`/teacher/slides/${id}`} className="mt-3 inline-block rounded-xl bg-white px-5 py-2.5 font-bold text-slate-900">
            সম্পাদনা করুন
          </a>
        </div>
      </div>
    );

  const t = getTheme(theme);
  const cur = slides[i];
  const pct = ((i + 1) / slides.length) * 100;

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <div
        className="h-screen w-screen"
        onClick={(e) => {
          // Let media controls work without jumping to the next slide.
          const el = e.target as HTMLElement;
          if (el.closest("video,iframe,button,a")) return;
          go(1);
        }}
      >
        <SlideView key={cur.id + i} slide={cur} themeId={theme} scale={1} live />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-black/25">
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: t.accent }} />
      </div>

      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 p-3 transition-opacity duration-300",
          ui ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl bg-black/55 px-2.5 py-2 backdrop-blur">
          <button onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="rounded-lg px-3 py-1.5 text-lg text-white hover:bg-white/15" aria-label="আগের স্লাইড">←</button>
          <span className="min-w-[64px] text-center text-sm font-bold tabular-nums text-white">
            {i + 1} / {slides.length}
          </span>
          <button onClick={(e) => { e.stopPropagation(); go(1); }}
            className="rounded-lg px-3 py-1.5 text-lg text-white hover:bg-white/15" aria-label="পরের স্লাইড">→</button>
          <span className="mx-1 h-5 w-px bg-white/20" />
          <button onClick={(e) => { e.stopPropagation(); setNotes((v) => !v); }}
            className={cx("rounded-lg px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15", notes && "bg-white/20")}
            title="স্পিকার নোট (N)">🗣️</button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen().catch(() => {});
            }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15"
            title="ফুলস্ক্রিন (F)"
          >
            ⛶
          </button>
          <a href={`/teacher/slides/${id}`} onClick={(e) => e.stopPropagation()}
            className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15" title="সম্পাদনা">✏️</a>
        </div>
        <div className="flex-1" />
        <span className="pointer-events-auto hidden rounded-xl bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur sm:block">
          {title} · ← → দিয়ে চলুন
        </span>
      </div>

      {notes && cur.note ? (
        <div className="absolute inset-x-0 bottom-16 mx-auto max-w-3xl rounded-2xl bg-black/80 p-4 text-white backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-wide text-white/50">স্পিকার নোট</p>
          <p className="mt-1 text-sm">{cur.note}</p>
        </div>
      ) : null}
    </div>
  );
}
