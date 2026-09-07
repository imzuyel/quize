"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
  useToast,
  cx,
} from "@/components/ui";
import { SlideView } from "@/components/slide-view";
import {
  ANIMS,
  ELEMENT_ANIMS,
  ICON_GROUPS,
  LAYOUTS,
  MEDIA_POSITIONS,
  SLIDE_THEMES,
  newSlide,
  resolveMedia,
  type ElementAnim,
  type Slide,
  type SlideAnim,
  type SlideLayout,
  type SlideMedia,
} from "@/lib/slides";

export default function SlideEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const deckId = Number(id);
  const { push } = useToast();

  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("aurora");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState("content");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiBusy, setAiBusy] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [replay, setReplay] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    fetch(`/api/presentations?id=${deckId}`).then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      setTitle(d.title);
      setTheme(d.theme);
      setSlides((d.slides as Slide[]) ?? []);
      setLoaded(true);
    });
  }, [deckId]);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true);
      await fetch("/api/presentations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "update", id: deckId, ...patch }),
      });
      setSaving(false);
      dirty.current = false;
    },
    [deckId],
  );

  // Autosave a moment after the teacher stops typing.
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    const t = setTimeout(() => save({ title, theme, slides }), 900);
    return () => clearTimeout(t);
  }, [title, theme, slides, loaded, save]);

  const mutate = (fn: (list: Slide[]) => Slide[]) => {
    dirty.current = true;
    setSlides((prev) => fn(prev));
  };

  const patchSlide = (p: Partial<Slide>) =>
    mutate((list) => list.map((s, i) => (i === active ? { ...s, ...p } : s)));

  const patchMedia = (p: Partial<SlideMedia>) =>
    mutate((list) =>
      list.map((s, i) =>
        i === active
          ? {
              ...s,
              media: {
                kind: "image",
                url: "",
                position: "right",
                fit: "cover",
                dim: 55,
                ...(s.media ?? {}),
                ...p,
              },
            }
          : s,
      ),
    );

  const addSlide = (layout: SlideLayout) => {
    mutate((list) => {
      const next = [...list];
      next.splice(active + 1, 0, newSlide(layout));
      return next;
    });
    setActive((a) => a + 1);
  };

  const removeSlide = (i: number) => {
    mutate((list) => list.filter((_, x) => x !== i));
    setActive((a) => Math.max(0, a > i ? a - 1 : a === i ? Math.min(a, slides.length - 2) : a));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= slides.length || from === to) return;
    mutate((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setActive(to);
  };

  const aiAdd = async () => {
    if (!aiTopic.trim()) return push("বিষয় লিখুন", "error");
    setAiBusy(true);
    try {
      const res = await fetch("/api/presentations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "aiOutline", id: deckId, topic: aiTopic, count: aiCount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSlides(d.slides as Slide[]);
      push(`${d.added}টি স্লাইড যোগ হয়েছে ✅`, "success");
      setAiOpen(false);
      setAiTopic("");
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    } finally {
      setAiBusy(false);
    }
  };

  if (!loaded) return <p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>;
  const cur = slides[active];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/teacher/slides"><Button size="sm" variant="ghost">← ফিরে যান</Button></Link>
        <input
          value={title}
          onChange={(e) => { dirty.current = true; setTitle(e.target.value); }}
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl font-extrabold hover:border-[var(--pg-line)]"
        />
        <Badge tone={saving ? "gold" : "green"}>{saving ? "সংরক্ষণ হচ্ছে…" : "✓ সংরক্ষিত"}</Badge>
        <Badge tone="blue">{slides.length} স্লাইড</Badge>
        <Button size="sm" variant="gold" onClick={() => setAiOpen(true)}>✨ AI স্লাইড</Button>
        <Link href={`/present/${deckId}`} target="_blank"><Button size="sm">▶ উপস্থাপন</Button></Link>
        <Button size="sm" variant="outline"
          onClick={() => window.open(`/api/presentations/export?id=${deckId}`, "_blank")}>
          ⬇ PPTX
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[210px_1fr_320px]">
        {/* ---------------------------- slide rail ---------------------------- */}
        <Card padded={false} className="p-2">
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pg-scroll">
            {slides.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  move(Number(e.dataTransfer.getData("text/plain")), i);
                }}
                onClick={() => setActive(i)}
                className={cx(
                  "cursor-grab overflow-hidden rounded-lg border-2 transition",
                  active === i ? "border-[var(--pg-teal)]" : "border-[var(--pg-line)]",
                  dragOver === i && "border-dashed border-[var(--pg-gold)]",
                )}
              >
                <div className="relative aspect-video">
                  <SlideView slide={s} themeId={theme} scale={0.16} animate={false} />
                  <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                    className="absolute right-1 top-1 rounded bg-black/55 px-1.5 text-[10px] text-white"
                    aria-label={`স্লাইড ${i + 1} মুছুন`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {!slides.length ? <p className="py-6 text-center text-xs text-slate-400">স্লাইড যোগ করুন</p> : null}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1">
            {LAYOUTS.slice(0, 6).map((l) => (
              <button
                key={l.id}
                onClick={() => addSlide(l.id)}
                title={l.hint}
                className="rounded-lg border border-[var(--pg-line)] px-1.5 py-1.5 text-[10px] font-bold hover:bg-slate-50"
              >
                {l.icon} {l.label}
              </button>
            ))}
          </div>
          <Select
            className="mt-1 py-1.5 text-xs"
            value=""
            onChange={(e) => e.target.value && addSlide(e.target.value as SlideLayout)}
          >
            <option value="">+ আরও লেআউট…</option>
            {LAYOUTS.slice(6).map((l) => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
          </Select>
        </Card>

        {/* ------------------------------ canvas ------------------------------ */}
        <div>
          <div className="overflow-hidden rounded-2xl shadow-xl">
            <div className="aspect-video w-full">
              {cur ? (
                <SlideView
                  key={`${cur.id}-${cur.anim}-${cur.elementAnim}-${theme}-${replay}`}
                  slide={cur}
                  themeId={theme}
                  scale={0.62}
                  live
                />
              ) : (
                <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-400">
                  স্লাইড নির্বাচন করুন
                </div>
              )}
            </div>
          </div>
          {cur?.note ? (
            <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
              🗣️ <b>স্পিকার নোট:</b> {cur.note}
            </p>
          ) : null}
        </div>

        {/* ----------------------------- inspector ---------------------------- */}
        <Card className="max-h-[76vh] overflow-y-auto pg-scroll">
          <Tabs
            tabs={[
              { id: "content", label: "কনটেন্ট" },
              { id: "media", label: "মিডিয়া" },
              { id: "motion", label: "অ্যানিমেশন" },
              { id: "design", label: "থিম" },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === "content" && cur ? (
            <div className="space-y-3">
              <Field label="লেআউট">
                <Select value={cur.layout} onChange={(e) => patchSlide({ layout: e.target.value as SlideLayout })}>
                  {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
                </Select>
              </Field>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">আইকন</p>
                <div className="flex items-center gap-2">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--pg-line)] text-2xl">
                    {cur.icon || "—"}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setIconOpen(true)}>বাছাই করুন</Button>
                  {cur.icon ? (
                    <Button size="sm" variant="ghost" onClick={() => patchSlide({ icon: "" })}>সরান</Button>
                  ) : null}
                </div>
              </div>

              <Field label="শিরোনাম">
                <Textarea value={cur.title} onChange={(e) => patchSlide({ title: e.target.value })} className="min-h-[60px]" />
              </Field>
              <Field label="উপশিরোনাম">
                <Input value={cur.subtitle ?? ""} onChange={(e) => patchSlide({ subtitle: e.target.value })} />
              </Field>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">পয়েন্ট</p>
                {(cur.bullets ?? []).map((b, i) => (
                  <div key={i} className="mb-1.5 flex items-center gap-1.5">
                    <Input
                      value={b}
                      onChange={(e) => {
                        const next = [...cur.bullets];
                        next[i] = e.target.value;
                        patchSlide({ bullets: next });
                      }}
                    />
                    <button
                      onClick={() => patchSlide({ bullets: cur.bullets.filter((_, x) => x !== i) })}
                      className="px-1.5 text-rose-500"
                      aria-label="পয়েন্ট মুছুন"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => patchSlide({ bullets: [...(cur.bullets ?? []), ""] })}>
                  + পয়েন্ট
                </Button>
              </div>

              <Field label="স্পিকার নোট">
                <Textarea value={cur.note ?? ""} onChange={(e) => patchSlide({ note: e.target.value })}
                  placeholder="ক্লাসে কী বলবেন (PPTX-এও যাবে)" />
              </Field>
            </div>
          ) : null}

          {tab === "media" && cur ? (
            <div className="space-y-3">
              <Field
                label="ছবি বা ভিডিওর লিংক"
                hint="YouTube, Vimeo, MP4 বা ছবির URL — স্বয়ংক্রিয়ভাবে শনাক্ত হবে"
              >
                <Input
                  value={cur.media?.url ?? cur.image ?? ""}
                  onChange={(e) => patchMedia({ url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=… বা https://…/ছবি.jpg"
                />
              </Field>

              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  📁 ডিভাইস থেকে ছবি
                </Button>
                {cur.media?.url ? (
                  <Button size="sm" variant="ghost" onClick={() => patchMedia({ url: "" })}>সরান</Button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) {
                    push("ছবিটি ২MB এর কম হতে হবে", "error");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => patchMedia({ url: String(reader.result), kind: "image" });
                  reader.readAsDataURL(f);
                  e.target.value = "";
                }}
              />

              {cur.media?.url ? (
                <>
                  <div className="overflow-hidden rounded-xl border border-[var(--pg-line)]">
                    <div className="aspect-video bg-slate-900">
                      <SlideView slide={cur} themeId={theme} scale={0.3} animate={false} />
                    </div>
                  </div>
                  <Badge tone="teal">শনাক্ত: {resolveMedia(cur.media.url).kind}</Badge>

                  <Field label="অবস্থান">
                    <Select
                      value={cur.media?.position ?? "right"}
                      onChange={(e) => patchMedia({ position: e.target.value as SlideMedia["position"] })}
                    >
                      {MEDIA_POSITIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="ফিট">
                    <Select
                      value={cur.media?.fit ?? "cover"}
                      onChange={(e) => patchMedia({ fit: e.target.value as "cover" })}
                    >
                      <option value="cover">পূর্ণ ঢেকে দিন</option>
                      <option value="contain">সম্পূর্ণ দেখান</option>
                    </Select>
                  </Field>
                  {(cur.media?.position === "background" || cur.media?.position === "full" || cur.layout === "media") ? (
                    <Field label={`ব্যাকগ্রাউন্ড অন্ধকার — ${cur.media?.dim ?? 55}%`}>
                      <input
                        type="range" min={0} max={90}
                        value={cur.media?.dim ?? 55}
                        onChange={(e) => patchMedia({ dim: Number(e.target.value) })}
                        className="w-full"
                      />
                    </Field>
                  ) : null}
                  <Field label="ক্যাপশন">
                    <Input value={cur.media?.caption ?? ""} onChange={(e) => patchMedia({ caption: e.target.value })} />
                  </Field>
                </>
              ) : (
                <>
                  {cur.searchTerm ? (
                    <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                      <p className="text-xs font-bold">🤖 এআই এই স্লাইডের জন্য ছবি প্রস্তাব করেছে</p>
                      <p className="mt-1 text-sm font-semibold">&quot;{cur.searchTerm}&quot;</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <a
                          href={`https://www.pexels.com/search/${encodeURIComponent(cur.searchTerm)}/`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline">Pexels-এ খুঁজুন</Button>
                        </a>
                        <a
                          href={`https://unsplash.com/s/photos/${encodeURIComponent(cur.searchTerm)}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline">Unsplash-এ খুঁজুন</Button>
                        </a>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        ছবির লিংক কপি করে উপরের ঘরে বসান।
                      </p>
                    </div>
                  ) : null}
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    💡 ভিডিও যোগ করলে উপস্থাপন মোডে সরাসরি চালানো যাবে। YouTube লিংক দিলে
                    স্বয়ংক্রিয়ভাবে এমবেড হবে।
                  </p>
                </>
              )}
            </div>
          ) : null}

          {tab === "motion" && cur ? (
            <div className="space-y-3">
              <Field label="স্লাইড ট্রানজিশন" hint="এক স্লাইড থেকে পরেরটিতে যাওয়ার ধরন">
                <Select value={cur.anim} onChange={(e) => patchSlide({ anim: e.target.value as SlideAnim })}>
                  {ANIMS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              </Field>

              <Field label="লেখা আসার ধরন" hint="শিরোনাম ও পয়েন্ট কীভাবে ফুটে উঠবে">
                <Select
                  value={cur.elementAnim ?? "fade_up"}
                  onChange={(e) => patchSlide({ elementAnim: e.target.value as ElementAnim })}
                >
                  {ELEMENT_ANIMS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              </Field>

              <Field label={`পয়েন্টের বিরতি — ${cur.stagger ?? 90}ms`} hint="একটির পর একটি ফুটে ওঠার গতি">
                <input
                  type="range" min={0} max={400} step={10}
                  value={cur.stagger ?? 90}
                  onChange={(e) => patchSlide({ stagger: Number(e.target.value) })}
                  className="w-full"
                />
              </Field>

              <Button size="sm" variant="outline" block onClick={() => setReplay((r) => r + 1)}>
                🔄 অ্যানিমেশন আবার চালান
              </Button>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="mb-1.5 text-xs font-bold">সব স্লাইডে প্রয়োগ করুন</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost"
                    onClick={() => { mutate((l) => l.map((x) => ({ ...x, anim: cur.anim }))); push("ট্রানজিশন প্রয়োগ হয়েছে", "success"); }}>
                    ট্রানজিশন
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => { mutate((l) => l.map((x) => ({ ...x, elementAnim: cur.elementAnim, stagger: cur.stagger }))); push("অ্যানিমেশন প্রয়োগ হয়েছে", "success"); }}>
                    লেখার অ্যানিমেশন
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "design" ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">থিম (সব স্লাইডে প্রযোজ্য)</p>
              <div className="grid grid-cols-2 gap-2">
                {SLIDE_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { dirty.current = true; setTheme(t.id); }}
                    className={cx(
                      "overflow-hidden rounded-xl border-2 text-left",
                      theme === t.id ? "border-[var(--pg-teal)]" : "border-[var(--pg-line)]",
                    )}
                  >
                    <span className="block h-12" style={{ background: t.bg }} />
                    <span className="block truncate px-2 py-1 text-[11px] font-bold">{t.name}</span>
                    <span className="block px-2 pb-1 text-[10px] text-slate-400">{t.category}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* ------------------------------ modals ------------------------------ */}
      <Modal open={iconOpen} onClose={() => setIconOpen(false)} title="আইকন বাছাই করুন" wide>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pg-scroll">
          {ICON_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 text-xs font-bold text-slate-500">{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.icons.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => { patchSlide({ icon: ic }); setIconOpen(false); }}
                    className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--pg-line)] text-2xl hover:border-[var(--pg-teal)] hover:bg-teal-50"
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="✨ এআই দিয়ে স্লাইড যোগ করুন"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAiOpen(false)}>বাতিল</Button>
            <Button loading={aiBusy} onClick={aiAdd} disabled={!aiTopic.trim()}>যোগ করুন</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="বিষয়" required>
            <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="যে বিষয়ে স্লাইড চান" autoFocus />
          </Field>
          <Field label="কতটি স্লাইড">
            <Select value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
              {[3, 5, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <p className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500">
            নতুন স্লাইডগুলো বর্তমান উপস্থাপনার শেষে যোগ হবে।
          </p>
        </div>
      </Modal>
    </div>
  );
}
