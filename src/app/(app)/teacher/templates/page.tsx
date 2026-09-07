"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
  Tabs,
  Textarea,
  Toggle,
  useToast,
  cx,
} from "@/components/ui";
import { QuizTimer } from "@/components/quiz";
import { Celebration, ThemeStage, ThemedAnswers, ThemedCard } from "@/components/theme-stage";
import {
  BG_MOTION_LABEL,
  CLASSIC_PALETTE,
  DEFAULT_TEMPLATE,
  PARTICLE_LABEL,
  THEME_PRESETS,
  mergeTemplate,
  shade,
  type BackgroundMotion,
  type ParticleKind,
  type TemplateConfig,
} from "@/lib/theme";

type Template = {
  id: number;
  name: string;
  category: string;
  config: TemplateConfig;
  visibility: string;
  rating: number;
  uses: number;
  official: boolean;
  ownerId: number | null;
};

const CATEGORIES = [
  "all", "academic", "science", "mathematics", "computer", "technology", "electronics",
  "electrical", "language", "kids", "competition", "minimal", "professional", "festival", "examination",
];

const DEMO_Q = {
  text: "HTML ফর্মে ব্যবহারকারীর ইনপুট নিতে কোন ট্যাগটি ব্যবহৃত হয়?",
  options: ["<input>", "<entry>", "<field>", "<form-data>"],
};

export default function TemplatesPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<Template[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState("library");
  const [editor, setEditor] = useState<TemplateConfig | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [visibility, setVisibility] = useState("private");
  const [prompt, setPrompt] = useState("একটি রঙিন অ্যানিমেটেড নিয়ন কুইজ থিম তৈরি করো");
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [reveal, setReveal] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/templates?category=${category}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows);
      setFavorites(data.favorites);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      push(data.error ?? "ব্যর্থ", "error");
      return null;
    }
    load();
    return data;
  };

  const openEditor = (cfg: Partial<TemplateConfig>, id: number | null, vis = "private") => {
    setEditor(mergeTemplate(cfg));
    setEditingId(id);
    setVisibility(vis);
    setTab("studio");
    setPreviewKey((k) => k + 1);
  };

  const patch = (p: Partial<TemplateConfig>) => setEditor((e) => (e ? { ...e, ...p } : e));

  return (
    <div className="space-y-4">
      <SectionTitle
        title="🎨 টেমপ্লেট স্টুডিও"
        subtitle="অ্যানিমেটেড ব্যাকগ্রাউন্ড, পার্টিকেল, গ্লো ও ট্রানজিশন — কোড ছাড়াই"
        action={<Button onClick={() => openEditor(DEFAULT_TEMPLATE, null)}>+ নতুন থিম</Button>}
      />

      <Tabs
        tabs={[
          { id: "library", label: "লাইব্রেরি", icon: "📚" },
          { id: "studio", label: "স্টুডিও", icon: "🎛️" },
          { id: "ai", label: "এআই থিম", icon: "✨" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ------------------------------- library ------------------------------- */}
      {tab === "library" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cx(
                  "rounded-lg border px-3 py-1.5 text-xs font-bold",
                  category === c ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)] bg-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((t) => {
              const cfg = mergeTemplate(t.config);
              return (
                <Card key={t.id} padded={false} className="overflow-hidden">
                  <ThemeStage config={cfg} className="h-32">
                    <div className="flex h-32 flex-col justify-between p-3">
                      <div className="flex justify-between">
                        <span className="rounded-md bg-black/30 px-2 py-0.5 text-[10px] font-bold text-white">
                          {BG_MOTION_LABEL[cfg.backgroundMotion]}
                        </span>
                        <button
                          onClick={() => post({ op: "favorite", id: t.id })}
                          className="text-lg leading-none"
                          aria-label="favorite"
                        >
                          {favorites.includes(t.id) ? "⭐" : "☆"}
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {cfg.answerPalette.slice(0, 5).map((c, i) => (
                          <span key={i} className="h-4 flex-1 rounded" style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                  </ThemeStage>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold leading-tight">{t.name}</p>
                      {t.official ? <Badge tone="teal">অফিসিয়াল</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t.category} · ⭐ {t.rating.toFixed(1)} · {t.uses} বার
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        onClick={() =>
                          post({ op: "use", id: t.id }).then(
                            () => push("কুইজ স্টুডিওর সেটিংসে এই থিম নির্বাচন করুন", "success"),
                          )
                        }
                      >
                        ব্যবহার
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditor(t.config, t.id, t.visibility)}>
                        কাস্টমাইজ
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => post({ op: "duplicate", id: t.id })}>কপি</Button>
                      {!t.official ? (
                        <Button size="sm" variant="ghost" onClick={() => post({ op: "delete", id: t.id })}>মুছুন</Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      {/* --------------------------------- AI --------------------------------- */}
      {tab === "ai" ? (
        <Card>
          <Field label="আপনার থিম বর্ণনা করুন">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </Field>
          <Button
            className="mt-3"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "template", prompt }),
              });
              const config = await res.json();
              setBusy(false);
              if (res.ok) {
                openEditor(config, null);
                push("এআই থিম তৈরি হয়েছে — সম্পাদনা করে সংরক্ষণ করুন", "success");
              }
            }}
          >
            ✨ থিম তৈরি করুন
          </Button>
          <p className="mt-4 mb-2 text-xs font-bold uppercase text-slate-400">দ্রুত আইডিয়া</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "ফিউচারিস্টিক নীল প্রযুক্তি থিম, নিয়ন গ্লোসহ",
              "প্রফেশনাল গণিত প্রতিযোগিতা, ন্যূনতম অ্যানিমেশন",
              "উজ্জ্বল রঙিন শিশুবান্ধব থিম বুদবুদসহ",
              "পহেলা বৈশাখ উৎসব থিম পাপড়ি ঝরার সাথে",
              "মহাকাশ গ্যালাক্সি থিম তারার আকাশসহ",
              "ইলেকট্রনিক্স সার্কিট ডার্ক থিম",
              "সোনালি চ্যাম্পিয়নশিপ থিম স্পটলাইটসহ",
              "শীতের তুষারপাত থিম",
            ].map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className="rounded-lg border border-[var(--pg-line)] px-2.5 py-1.5 text-xs hover:bg-slate-50"
              >
                {p}
              </button>
            ))}
          </div>

          <p className="mt-5 mb-2 text-xs font-bold uppercase text-slate-400">বিল্ট-ইন অ্যানিমেটেড প্রিসেট</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {THEME_PRESETS.map((p) => {
              const cfg = mergeTemplate(p);
              return (
                <button key={p.name} onClick={() => openEditor(p, null)} className="overflow-hidden rounded-xl border border-[var(--pg-line)] text-left">
                  <ThemeStage config={cfg} className="h-16" />
                  <span className="block px-2 py-1.5 text-[11px] font-bold">{p.name}</span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* ------------------------------- studio ------------------------------- */}
      {tab === "studio" && editor ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <ThemeStage config={editor} className="rounded-2xl p-5" key={previewKey}>
              {celebrate ? <Celebration config={editor} /> : null}
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-black/25 px-2.5 py-1 text-xs font-bold text-white">
                  প্রশ্ন ৩ / ১০
                </span>
                <QuizTimer
                  endsAt={new Date(Date.now() + 25000).toISOString()}
                  total={30}
                  style={editor.timerStyle}
                  color={editor.accent}
                  size={70}
                />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-1/3 rounded-full" style={{ background: editor.accent }} />
              </div>
              <ThemedCard config={editor} animate animKey={previewKey} className="mt-3 p-4">
                <p className="text-lg font-bold">{DEMO_Q.text}</p>
              </ThemedCard>
              <div className="mt-3">
                <ThemedAnswers
                  config={editor}
                  options={DEMO_Q.options}
                  type="mcq"
                  selected={sel}
                  reveal={reveal}
                  correct={[0]}
                  onSelect={(i) => setSel([i])}
                />
              </div>
            </ThemeStage>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewKey((k) => k + 1)}>
                🔄 ট্রানজিশন চালান
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReveal((v) => !v)}>
                {reveal ? "উত্তর লুকান" : "👁 উত্তর প্রকাশ"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCelebrate(true);
                  setTimeout(() => setCelebrate(false), 4000);
                }}
              >
                🎉 উদযাপন দেখুন
              </Button>
            </div>
          </div>

          <Card className="max-h-[78vh] overflow-y-auto pg-scroll">
            <div className="space-y-3">
              <Field label="থিমের নাম">
                <Input value={editor.name} onChange={(e) => patch({ name: e.target.value })} />
              </Field>
              <Field label="ক্যাটাগরি">
                <Select value={editor.category} onChange={(e) => patch({ category: e.target.value })}>
                  {CATEGORIES.filter((c) => c !== "all").map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>

              <p className="pt-2 text-xs font-bold uppercase text-slate-400">🌈 রঙ</p>
              <div className="grid grid-cols-3 gap-2">
                {(["primary", "accent", "secondary"] as const).map((k) => (
                  <Field key={k} label={k === "primary" ? "প্রধান" : k === "accent" ? "অ্যাকসেন্ট" : "গৌণ"}>
                    <input
                      type="color"
                      value={editor[k]}
                      onChange={(e) => patch({ [k]: e.target.value } as Partial<TemplateConfig>)}
                      className="h-10 w-full rounded-lg border border-[var(--pg-line)]"
                    />
                  </Field>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                block
                onClick={() =>
                  patch({
                    background: `linear-gradient(140deg, ${shade(editor.primary, -70)}, ${shade(editor.primary, -30)} 55%, ${shade(editor.secondary, -20)})`,
                  })
                }
              >
                🎨 রঙ থেকে ব্যাকগ্রাউন্ড তৈরি
              </Button>
              <Field label="ব্যাকগ্রাউন্ড (CSS gradient)">
                <Input value={editor.background} onChange={(e) => patch({ background: e.target.value })} />
              </Field>

              <p className="pt-2 text-xs font-bold uppercase text-slate-400">🌊 অ্যানিমেশন</p>
              <Field label="ব্যাকগ্রাউন্ড মোশন">
                <Select
                  value={editor.backgroundMotion}
                  onChange={(e) => patch({ backgroundMotion: e.target.value as BackgroundMotion })}
                >
                  {Object.entries(BG_MOTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label={`মোশন গতি — ${editor.motionSpeed.toFixed(1)}x`}>
                <input
                  type="range" min={0.4} max={2} step={0.1}
                  value={editor.motionSpeed}
                  onChange={(e) => patch({ motionSpeed: Number(e.target.value) })}
                  className="w-full"
                />
              </Field>
              <Field label="পার্টিকেল">
                <Select value={editor.particles} onChange={(e) => patch({ particles: e.target.value as ParticleKind })}>
                  {Object.entries(PARTICLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label={`পার্টিকেল ঘনত্ব — ${editor.particleDensity}%`}>
                <input
                  type="range" min={0} max={100}
                  value={editor.particleDensity}
                  onChange={(e) => patch({ particleDensity: Number(e.target.value) })}
                  className="w-full"
                />
              </Field>
              <Field label="প্রশ্ন ট্রানজিশন">
                <Select value={editor.transition} onChange={(e) => patch({ transition: e.target.value as TemplateConfig["transition"] })}>
                  {["fade", "slide", "zoom", "scale", "flip", "reveal", "cube", "swipe"].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="ফলাফল উদযাপন">
                <Select value={editor.resultAnimation} onChange={(e) => patch({ resultAnimation: e.target.value as TemplateConfig["resultAnimation"] })}>
                  {["confetti", "fireworks", "trophy", "rays", "coins", "minimal"].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>

              <p className="pt-2 text-xs font-bold uppercase text-slate-400">�� কার্ড ও বাটন</p>
              <Field label="প্রশ্ন কার্ড">
                <Select value={editor.questionCard} onChange={(e) => patch({ questionCard: e.target.value as TemplateConfig["questionCard"] })}>
                  {["elevated", "glass", "outline", "solid", "neon", "paper"].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="উত্তর বাটন স্টাইল">
                <Select value={editor.answerStyle} onChange={(e) => patch({ answerStyle: e.target.value as TemplateConfig["answerStyle"] })}>
                  {["grid", "pill", "3d", "glass", "neon", "flat", "outline"].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">উত্তর প্যালেট (৬টি রঙ)</p>
                <div className="flex gap-1.5">
                  {editor.answerPalette.map((c, i) => (
                    <input
                      key={i}
                      type="color"
                      value={c}
                      onChange={(e) => {
                        const next = [...editor.answerPalette];
                        next[i] = e.target.value;
                        patch({ answerPalette: next });
                      }}
                      className="h-9 flex-1 rounded-lg border border-[var(--pg-line)]"
                      aria-label={`palette ${i + 1}`}
                    />
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="mt-1" onClick={() => patch({ answerPalette: [...CLASSIC_PALETTE] })}>
                  ডিফল্টে ফিরুন
                </Button>
              </div>
              <Field label={`কর্নার রেডিয়াস — ${editor.radius}px`}>
                <input
                  type="range" min={0} max={34}
                  value={editor.radius}
                  onChange={(e) => patch({ radius: Number(e.target.value) })}
                  className="w-full"
                />
              </Field>
              <Field label="ফন্ট">
                <Select value={editor.font} onChange={(e) => patch({ font: e.target.value as TemplateConfig["font"] })}>
                  {["sans", "rounded", "serif", "mono", "display"].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="টাইমার স্টাইল">
                <Select value={editor.timerStyle} onChange={(e) => patch({ timerStyle: e.target.value as TemplateConfig["timerStyle"] })}>
                  {["circular", "ring_glow", "linear", "digital", "flip", "pulse", "minimal"].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Toggle checked={editor.glow} onChange={(v) => patch({ glow: v })} label="গ্লো ইফেক্ট" />
              <Toggle checked={editor.sound} onChange={(v) => patch({ sound: v })} label="সাউন্ড ইফেক্ট" />
              <Field label="মোশন লেভেল">
                <Select value={editor.motion} onChange={(e) => patch({ motion: e.target.value as TemplateConfig["motion"] })}>
                  <option value="low">কম (লো-এন্ড ডিভাইস)</option>
                  <option value="medium">মাঝারি</option>
                  <option value="high">বেশি</option>
                </Select>
              </Field>
              <Field label="লোগো URL">
                <Input value={editor.logo} onChange={(e) => patch({ logo: e.target.value })} />
              </Field>
              <Field label="ভিজিবিলিটি">
                <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                  <option value="private">শুধু আমি</option>
                  <option value="school">স্কুল</option>
                  <option value="shared">শেয়ারড</option>
                </Select>
              </Field>

              <Button
                block
                onClick={async () => {
                  const body = editingId
                    ? { op: "update", id: editingId, name: editor.name, category: editor.category, config: editor, visibility }
                    : { op: "create", name: editor.name, category: editor.category, config: editor, visibility };
                  const data = await post(body);
                  if (data) {
                    push("থিম সংরক্ষিত ✅", "success");
                    setTab("library");
                  }
                }}
              >
                💾 আমার থিম হিসেবে সংরক্ষণ
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "studio" && !editor ? (
        <Card>
          <p className="text-sm text-slate-500">লাইব্রেরি থেকে কাস্টমাইজ করুন অথবা নতুন থিম শুরু করুন।</p>
          <Button className="mt-3" onClick={() => openEditor(DEFAULT_TEMPLATE, null)}>নতুন থিম</Button>
        </Card>
      ) : null}
    </div>
  );
}
