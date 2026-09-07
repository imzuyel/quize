"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Select,
  Tabs,
  Toggle,
  useToast,
  cx,
} from "@/components/ui";
import { QuizTimer } from "@/components/quiz";
import { ThemeStage, ThemedAnswers, ThemedCard } from "@/components/theme-stage";
import { mergeTemplate } from "@/lib/theme";
import { DEFAULT_SETTINGS, EXAM_SETTINGS, formatDuration, type QuizSettings } from "@/lib/quiz-settings";

type Q = {
  id: number;
  text: string;
  type: string;
  options: string[];
  correct: (string | number)[];
  marks: number;
  timer: number;
  difficulty: string;
  subjectId: number | null;
  explanation: string | null;
  hint: string | null;
};

const PAGE_SIZE = 25;

export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quizId = Number(id);
  const router = useRouter();
  const { push } = useToast();
  const [quiz, setQuiz] = useState<{ id: number; title: string; description: string | null; mode: string; status: string; durationMinutes: number | null; settings: QuizSettings } | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [rounds, setRounds] = useState<{ id: number; name: string; settings: Record<string, unknown> }[]>([]);
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState("simple");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankRows, setBankRows] = useState<Q[]>([]);
  const [bankQuery, setBankQuery] = useState("");
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop" | "exam">("desktop");
  const [templates, setTemplates] = useState<{ id: number; name: string; config: Record<string, unknown> }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDiff, setAiDiff] = useState("medium");
  const [aiTypes, setAiTypes] = useState<string[]>(["mcq"]);
  const [aiLang, setAiLang] = useState("bn");
  const [aiBusy, setAiBusy] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [revealKey, setRevealKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quizzes?id=${quizId}`);
    if (!res.ok) return;
    const data = await res.json();
    setQuiz({ ...data.quiz, settings: { ...DEFAULT_SETTINGS, ...(data.quiz.settings ?? {}) } });
    setQuestions(data.questions);
    setRounds(data.rounds);
  }, [quizId]);

  useEffect(() => {
    load();
    fetch("/api/templates").then(async (r) => r.ok && setTemplates((await r.json()).rows));
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/quizzes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      push(data.error ?? "ব্যর্থ", "error");
      return null;
    }
    return data;
  };

  const saveSettings = async (settings: QuizSettings) => {
    setQuiz((q) => (q ? { ...q, settings } : q));
    await post({ op: "update", id: quizId, data: { settings } });
  };

  const searchBank = useCallback(async () => {
    const res = await fetch(`/api/questions?limit=30&q=${encodeURIComponent(bankQuery)}`);
    if (res.ok) setBankRows((await res.json()).rows);
  }, [bankQuery]);

  useEffect(() => {
    if (pickerOpen) searchBank();
  }, [pickerOpen, searchBank]);

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...questions];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
    await post({ op: "reorder", id: quizId, order: next.map((q) => q.id) });
  };

  const current = questions[active];
  const filtered = useMemo(() => {
    const needle = listQuery.trim().toLowerCase();
    return needle
      ? questions.filter((q) => q.text.toLowerCase().includes(needle) || q.type.includes(needle))
      : questions;
  }, [questions, listQuery]);
  const visible = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const totalTime = questions.reduce((s, q) => s + q.timer, 0);
  const mix = useMemo(() => {
    const byDiff: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    const byType: Record<string, number> = {};
    for (const q of questions) {
      byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1;
      byType[q.type] = (byType[q.type] ?? 0) + 1;
    }
    return { byDiff, byType };
  }, [questions]);

  const bulkRemove = async () => {
    if (!picked.length) return;
    await post({ op: "removeQuestion", id: quizId, questionIds: picked });
    setPicked([]);
    load();
    push(`${picked.length}টি প্রশ্ন সরানো হয়েছে`, "success");
  };

  const bulkTiming = async (field: "marks" | "timer", value: number) => {
    if (!picked.length) return;
    for (const qid of picked) {
      const q = questions.find((x) => x.id === qid);
      if (!q) continue;
      await post({
        op: "questionOverride",
        id: quizId,
        questionIds: [qid],
        data: { marks: field === "marks" ? value : q.marks, timer: field === "timer" ? value : q.timer },
      });
    }
    load();
    push("প্রয়োগ হয়েছে ✅", "success");
  };

  const quickAI = async () => {
    if (!aiTopic.trim()) return push("একটি বিষয় লিখুন", "error");
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "quickGenerate",
          quizId,
          params: {
            count: aiCount,
            topic: aiTopic,
            difficulty: aiDiff,
            types: aiTypes,
            language: aiLang,
            marks: 1,
            timer: s.globalTimer || 30,
            withExplanation: true,
            withHint: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      push(`${data.added}টি প্রশ্ন যোগ হয়েছে ✅`, "success");
      setAiOpen(false);
      setAiTopic("");
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    } finally {
      setAiBusy(false);
    }
  };

  const shuffleAll = async () => {
    const next = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(next);
    await post({ op: "reorder", id: quizId, order: next.map((q) => q.id) });
    push("প্রশ্ন এলোমেলো করা হয়েছে", "success");
  };

  if (!quiz) return <p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>;
  const s = quiz.settings;
  const theme = mergeTemplate(templates.find((t) => t.id === s.templateId)?.config);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/teacher/quizzes">
          <Button size="sm" variant="ghost">← ফিরে যান</Button>
        </Link>
        <input
          value={quiz.title}
          onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
          onBlur={() => post({ op: "update", id: quizId, data: { title: quiz.title } })}
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl font-extrabold hover:border-[var(--pg-line)]"
        />
        <Badge tone={quiz.status === "published" ? "green" : "slate"}>{quiz.status}</Badge>
        <Badge tone="blue">{questions.length} প্রশ্ন</Badge>
        <Badge tone="gold">{totalMarks} মার্কস</Badge>
        <Badge tone="teal">⏱ {formatDuration(totalTime + (s.examBufferSeconds ?? 0))}</Badge>
        <Button size="sm" variant="outline" onClick={() => post({ op: "publish", id: quizId }).then(load)}>
          প্রকাশ করুন
        </Button>
        {quiz.mode === "live" ? (
          <Button
            size="sm"
            onClick={async () => {
              const res = await fetch("/api/live", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "create", quizId }),
              });
              const data = await res.json();
              if (res.ok) router.push(`/host/${data.pin}`);
              else push(data.error, "error");
            }}
          >
            📡 লাইভ শুরু
          </Button>
        ) : (
          <Link href={`/student/quizzes`}>
            <Button size="sm">শিক্ষার্থী ভিউ</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
        {/* ------------------------------ question list ------------------------------ */}
        <Card padded={false} className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-slate-400">প্রশ্ন তালিকা</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={shuffleAll} title="এলোমেলো করুন">🔀</Button>
              <Button size="sm" variant="gold" onClick={() => setAiOpen(true)} title="এআই দিয়ে প্রশ্ন যোগ করুন">✨ AI</Button>
              <Button size="sm" onClick={() => setPickerOpen(true)}>+ যোগ</Button>
            </div>
          </div>

          <Input
            value={listQuery}
            onChange={(e) => { setListQuery(e.target.value); setPage(0); }}
            placeholder="🔍 প্রশ্ন খুঁজুন…"
            className="mb-2 py-2 text-xs"
          />

          {questions.length ? (
            <div className="mb-2 grid grid-cols-3 gap-1 text-center">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <div key={d} className="rounded-lg bg-slate-50 px-1 py-1.5">
                  <p className="text-sm font-black tabular-nums">{mix.byDiff[d] ?? 0}</p>
                  <p className="text-[10px] text-slate-500">
                    {d === "easy" ? "সহজ" : d === "medium" ? "মাঝারি" : "কঠিন"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {picked.length ? (
            <div className="mb-2 rounded-xl border border-teal-200 bg-teal-50 p-2">
              <p className="mb-1.5 text-xs font-bold">{picked.length}টি নির্বাচিত</p>
              <div className="flex flex-wrap gap-1">
                {[10, 30, 60].map((t) => (
                  <button key={t} onClick={() => bulkTiming("timer", t)}
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-bold">⏱{t}s</button>
                ))}
                {[1, 2, 5].map((m) => (
                  <button key={m} onClick={() => bulkTiming("marks", m)}
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-bold">🎯{m}</button>
                ))}
                <button onClick={bulkRemove} className="rounded-md bg-rose-500 px-2 py-1 text-[11px] font-bold text-white">সরান</button>
                <button onClick={() => setPicked([])} className="rounded-md px-2 py-1 text-[11px] font-bold text-slate-500">বাতিল</button>
              </div>
            </div>
          ) : null}
          <div className="max-h-[520px] space-y-1.5 overflow-y-auto pg-scroll">
            {visible.map((q, i) => {
              const index = questions.indexOf(q);
              return (
                <div
                  key={q.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(index); }}
                  onDragLeave={() => setDragOver((d) => (d === index ? null : d))}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isNaN(from) || from === index) return;
                    const next = [...questions];
                    const [item] = next.splice(from, 1);
                    next.splice(index, 0, item);
                    setQuestions(next);
                    await post({ op: "reorder", id: quizId, order: next.map((x) => x.id) });
                  }}
                  onClick={() => setActive(index)}
                  className={cx(
                    "cursor-grab rounded-xl border px-2.5 py-2 text-xs transition",
                    active === index ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
                    dragOver === index && "border-dashed border-[var(--pg-gold)] bg-amber-50",
                    picked.includes(q.id) && "ring-2 ring-[var(--pg-teal)]",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={picked.includes(q.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setPicked((s2) => (e.target.checked ? [...s2, q.id] : s2.filter((x) => x !== q.id)))
                      }
                      aria-label={`select question ${index + 1}`}
                    />
                    <span className="font-black text-slate-400">{index + 1}</span>
                    <span className="line-clamp-2 flex-1 font-semibold">{q.text}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge tone="teal">⏱{q.timer}s</Badge>
                    <Badge tone="slate">{q.marks}m</Badge>
                    <div className="flex-1" />
                    <button onClick={(e) => { e.stopPropagation(); move(index, -1); }} aria-label="up">↑</button>
                    <button onClick={(e) => { e.stopPropagation(); move(index, 1); }} aria-label="down">↓</button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await post({ op: "removeQuestion", id: quizId, questionIds: [q.id] });
                        load();
                      }}
                      className="text-rose-500"
                      aria-label="remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
            {!questions.length ? (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-400">এখনো কোনো প্রশ্ন নেই</p>
                <Button size="sm" variant="gold" className="mt-2" onClick={() => setAiOpen(true)}>
                  ✨ এআই দিয়ে শুরু করুন
                </Button>
              </div>
            ) : null}
          </div>
          {filtered.length > PAGE_SIZE ? (
            <div className="mt-2 flex items-center justify-between text-xs">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← আগের</button>
              <span>{page + 1} / {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}</span>
              <button
                disabled={(page + 1) * PAGE_SIZE >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                পরের →
              </button>
            </div>
          ) : null}
        </Card>

        {/* --------------------------------- canvas --------------------------------- */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(["desktop", "mobile", "exam"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPreviewMode(m)}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-xs font-bold",
                  previewMode === m ? "bg-[var(--pg-deep)] text-white" : "bg-slate-100",
                )}
              >
                {m === "desktop" ? "🖥️ ডেস্কটপ" : m === "mobile" ? "📱 মোবাইল" : "📝 পরীক্ষা"}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => { setShowReveal((v) => !v); setRevealKey((k) => k + 1); }}
              className={cx(
                "rounded-lg px-3 py-1.5 text-xs font-bold",
                showReveal ? "bg-emerald-600 text-white" : "bg-slate-100",
              )}
            >
              {showReveal ? "✅ উত্তর দেখানো হচ্ছে" : "👁 উত্তর রিভিল প্রিভিউ"}
            </button>
          </div>
          <ThemeStage
            config={previewMode === "exam" ? { ...theme, backgroundMotion: "static", particles: "none", background: "#f1f5f9" } : theme}
            className={cx(
              "mx-auto w-full rounded-2xl p-4 shadow-xl transition-all",
              previewMode === "mobile" && "max-w-sm",
            )}
          >
            {current ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className={cx("text-xs font-bold", previewMode === "exam" ? "text-slate-500" : "text-white/80")}>
                    প্রশ্ন {active + 1}/{questions.length}
                  </span>
                  {previewMode !== "exam" ? (
                    <QuizTimer endsAt={null} total={current.timer} style={theme.timerStyle} color={theme.accent} size={64} />
                  ) : (
                    <span className="text-xs font-bold text-slate-500">
                      মোট সময়: {formatDuration(totalTime + (s.examBufferSeconds ?? 0))}
                    </span>
                  )}
                </div>
                <ThemedCard config={theme} animate animKey={current.id} className="p-4">
                  <p className="text-lg font-bold">{current.text}</p>
                </ThemedCard>
                <div className="mt-3" key={revealKey}>
                  <ThemedAnswers
                    config={theme}
                    options={current.options}
                    type={current.type}
                    selected={showReveal ? [1] : []}
                    reveal={showReveal}
                    correct={current.correct}
                    disabled
                    onSelect={() => {}}
                  />
                </div>
                {showReveal ? (
                  <p className="mt-2 text-center text-[11px] text-white/70">
                    সবুজ = সঠিক · কাঁপুনি = ভুল উত্তর — শিক্ষার্থীরা এভাবেই দেখবে
                  </p>
                ) : null}
              </>
            ) : (
              <p className="py-16 text-center text-sm text-white/80">প্রিভিউ দেখতে প্রশ্ন যোগ করুন</p>
            )}
          </ThemeStage>

          {current ? (
            <Card>
              <p className="mb-2 text-xs font-bold uppercase text-slate-400">এই প্রশ্নের সেটিংস</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="মার্কস">
                  <Input
                    type="number"
                    value={current.marks}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setQuestions((qs) => qs.map((q, i) => (i === active ? { ...q, marks: v } : q)));
                    }}
                    onBlur={() =>
                      post({ op: "questionOverride", id: quizId, questionIds: [current.id], data: { marks: current.marks, timer: current.timer } })
                    }
                  />
                </Field>
                <Field label="এই প্রশ্নের সময় (সেকেন্ড)">
                  <Input
                    type="number" min={5} max={300}
                    value={current.timer}
                    onChange={(e) => {
                      const v = Math.max(5, Math.min(300, Number(e.target.value) || 5));
                      setQuestions((qs) => qs.map((q, i) => (i === active ? { ...q, timer: v } : q)));
                    }}
                    onBlur={() =>
                      post({ op: "questionOverride", id: quizId, questionIds: [current.id], data: { marks: current.marks, timer: current.timer } })
                    }
                  />
                </Field>
                <Field label="ডিফিকাল্টি">
                  <Input value={current.difficulty} disabled />
                </Field>
              </div>
              <div className="mt-2">
                <p className="mb-1.5 text-xs font-semibold text-slate-600">দ্রুত সময় নির্ধারণ</p>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 15, 20, 30, 45, 60, 90, 120].map((t) => (
                    <button
                      key={t}
                      onClick={async () => {
                        setQuestions((qs) => qs.map((q, i) => (i === active ? { ...q, timer: t } : q)));
                        await post({
                          op: "questionOverride",
                          id: quizId,
                          questionIds: [current.id],
                          data: { marks: current.marks, timer: t },
                        });
                      }}
                      className={cx(
                        "rounded-lg border px-2.5 py-1.5 text-xs font-bold",
                        current.timer === t ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
                      )}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  ⏱ কঠিন প্রশ্নে বেশি সময় দিন — মোট সময় নিজে থেকেই যোগ হবে।
                </p>
              </div>

              {current.explanation ? (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs"><b>ব্যাখ্যা:</b> {current.explanation}</p>
              ) : null}
            </Card>
          ) : null}
        </div>

        {/* -------------------------------- settings -------------------------------- */}
        <Card>
          <Tabs
            tabs={[
              { id: "simple", label: "সহজ" },
              { id: "advanced", label: "অ্যাডভান্সড" },
              { id: "rounds", label: "রাউন্ড" },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === "simple" ? (
            <div className="space-y-3">
              <Field label="ধরন">
                <Select
                  value={quiz.mode}
                  onChange={async (e) => {
                    const mode = e.target.value;
                    const settings = mode === "exam" ? EXAM_SETTINGS : DEFAULT_SETTINGS;
                    setQuiz({ ...quiz, mode, settings });
                    await post({ op: "update", id: quizId, data: { mode, settings } });
                  }}
                >
                  <option value="live">লাইভ কুইজ</option>
                  <option value="exam">ফরমাল পরীক্ষা</option>
                  <option value="practice">অনুশীলন</option>
                </Select>
              </Field>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-bold">⏱ মোট সময় স্বয়ংক্রিয়</p>
                <p className="mt-0.5 text-lg font-black text-[var(--pg-deep)]">
                  {formatDuration(totalTime + (s.examBufferSeconds ?? 0))}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {questions.length}টি প্রশ্নের সময়ের যোগফল ({formatDuration(totalTime)})
                  {s.examBufferSeconds ? ` + ${s.examBufferSeconds}s বাফার` : ""}।
                  প্রশ্ন যোগ করলে সময়ও বাড়বে।
                </p>
              </div>

              <Field label="নতুন প্রশ্নের ডিফল্ট সময়" hint="প্রতিটি প্রশ্নে আলাদা করে বদলাতে পারবেন">
                <Select value={s.globalTimer} onChange={(e) => saveSettings({ ...s, globalTimer: Number(e.target.value) })}>
                  {[5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map((t) => <option key={t} value={t}>{t} সেকেন্ড</option>)}
                </Select>
              </Field>

              <Field label="অতিরিক্ত বাফার (সেকেন্ড)" hint="পড়া ও নেভিগেশনের জন্য বাড়তি সময়">
                <Input
                  type="number" min={0} max={600} step={15}
                  value={s.examBufferSeconds ?? 60}
                  onChange={(e) => saveSettings({ ...s, examBufferSeconds: Number(e.target.value) })}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">থিম</p>
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pg-scroll">
                  <button
                    onClick={() => saveSettings({ ...s, templateId: null })}
                    className={cx(
                      "overflow-hidden rounded-xl border-2 text-left",
                      !s.templateId ? "border-[var(--pg-teal)]" : "border-[var(--pg-line)]",
                    )}
                  >
                    <ThemeStage config={{}} className="h-12" />
                    <span className="block px-2 py-1 text-[10px] font-bold">ডিফল্ট</span>
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => saveSettings({ ...s, templateId: t.id })}
                      className={cx(
                        "overflow-hidden rounded-xl border-2 text-left",
                        s.templateId === t.id ? "border-[var(--pg-teal)]" : "border-[var(--pg-line)]",
                      )}
                    >
                      <ThemeStage config={t.config} className="h-12" />
                      <span className="block truncate px-2 py-1 text-[10px] font-bold">{t.name}</span>
                    </button>
                  ))}
                </div>
                <Link href="/teacher/templates" className="mt-1.5 inline-block text-xs font-bold text-[var(--pg-teal)]">
                  🎨 টেমপ্লেট স্টুডিওতে নতুন থিম বানান →
                </Link>
              </div>
              <Toggle checked={s.leaderboard} onChange={(v) => saveSettings({ ...s, leaderboard: v })} label="লিডারবোর্ড" />
              <Toggle checked={s.cinematicIntro} onChange={(v) => saveSettings({ ...s, cinematicIntro: v })} label="সিনেমাটিক ইন্ট্রো" />
              <Toggle checked={s.feedbackEnabled} onChange={(v) => saveSettings({ ...s, feedbackEnabled: v })} label="ফিডব্যাক নিন" />
            </div>
          ) : null}

          {tab === "advanced" ? (
            <div className="space-y-3">
              <Field label="স্কোরিং">
                <Select value={s.scoring} onChange={(e) => saveSettings({ ...s, scoring: e.target.value as QuizSettings["scoring"] })}>
                  <option value="standard">স্ট্যান্ডার্ড</option>
                  <option value="speed">স্পিড বোনাস</option>
                  <option value="difficulty">ডিফিকাল্টি ভিত্তিক</option>
                  <option value="custom">কাস্টম</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="বেস পয়েন্ট">
                  <Input type="number" value={s.basePoints} onChange={(e) => saveSettings({ ...s, basePoints: Number(e.target.value) })} />
                </Field>
                <Field label="স্পিড বোনাস">
                  <Input type="number" value={s.speedBonus} onChange={(e) => saveSettings({ ...s, speedBonus: Number(e.target.value) })} />
                </Field>
              </div>
              <Toggle checked={s.streakBonus} onChange={(v) => saveSettings({ ...s, streakBonus: v })} label="স্ট্রিক বোনাস" />
              <Field label="টাইমার স্টাইল">
                <Select value={s.timerStyle} onChange={(e) => saveSettings({ ...s, timerStyle: e.target.value as QuizSettings["timerStyle"] })}>
                  {["circular", "linear", "digital", "flip", "pulse", "minimal"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="টাইমার মোড">
                <Select value={s.timerMode} onChange={(e) => saveSettings({ ...s, timerMode: e.target.value as QuizSettings["timerMode"] })}>
                  <option value="per_question">প্রতি প্রশ্নে</option>
                  <option value="global">গ্লোবাল</option>
                  <option value="per_round">প্রতি রাউন্ডে</option>
                </Select>
              </Field>
              <Field label="মোশন লেভেল">
                <Select value={s.motion} onChange={(e) => saveSettings({ ...s, motion: e.target.value as QuizSettings["motion"] })}>
                  <option value="low">কম</option>
                  <option value="medium">মাঝারি</option>
                  <option value="high">বেশি</option>
                </Select>
              </Field>
              <Toggle checked={s.reactions} onChange={(v) => saveSettings({ ...s, reactions: v })} label="লাইভ রিঅ্যাকশন" />
              <Toggle checked={s.sound} onChange={(v) => saveSettings({ ...s, sound: v })} label="সাউন্ড" />
              <Toggle
                checked={s.teamMode}
                onChange={(v) => saveSettings({ ...s, teamMode: v })}
                label="টিম মোড"
              />
              {s.teamMode ? (
                <Field label="টিম সংখ্যা (২-২০)">
                  <Input type="number" min={2} max={20} value={s.teamCount} onChange={(e) => saveSettings({ ...s, teamCount: Number(e.target.value) })} />
                </Field>
              ) : null}
              <p className="pt-2 text-xs font-bold uppercase text-slate-400">পাওয়ার-আপ</p>
              {Object.keys(s.powerUps).map((k) => (
                <Toggle
                  key={k}
                  checked={s.powerUps[k]}
                  onChange={(v) => saveSettings({ ...s, powerUps: { ...s.powerUps, [k]: v } })}
                  label={k}
                />
              ))}
              <p className="pt-2 text-xs font-bold uppercase text-slate-400">পরীক্ষা সেটিংস</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="নেগেটিভ মার্কিং">
                  <Input type="number" step={0.25} value={s.negativeMarking} onChange={(e) => saveSettings({ ...s, negativeMarking: Number(e.target.value) })} />
                </Field>
                <Field label="পাস মার্ক %">
                  <Input type="number" value={s.passMark} onChange={(e) => saveSettings({ ...s, passMark: Number(e.target.value) })} />
                </Field>
              </div>
              <Toggle checked={s.randomQuestions} onChange={(v) => saveSettings({ ...s, randomQuestions: v })} label="প্রশ্ন এলোমেলো" />
              <Toggle checked={s.randomOptions} onChange={(v) => saveSettings({ ...s, randomOptions: v })} label="অপশন এলোমেলো" />
              <Toggle checked={s.guestJoin} onChange={(v) => saveSettings({ ...s, guestJoin: v })} label="গেস্ট জয়েন (নিকনেম)" />

              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold">প্রিসেট হিসেবে সংরক্ষণ</p>
                <div className="flex gap-2">
                  <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="প্রিসেটের নাম" />
                  <Button
                    size="sm"
                    onClick={async () => {
                      await post({ op: "savePreset", name: presetName || "নতুন প্রিসেট", settings: s });
                      push("প্রিসেট সংরক্ষিত", "success");
                    }}
                  >
                    সংরক্ষণ
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => saveSettings({ ...DEFAULT_SETTINGS })}>দ্রুত ক্লাসরুম কুইজ</Button>
                  <Button size="sm" variant="outline" onClick={() => saveSettings({ ...EXAM_SETTINGS })}>ফরমাল পরীক্ষা</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveSettings({ ...DEFAULT_SETTINGS, scoring: "difficulty", teamMode: true, powerUps: { ...s.powerUps, double_points: true, fifty_fifty: true } })}
                  >
                    কম্পিটিশন মোড
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "rounds" ? (
            <div className="space-y-2">
              {rounds.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-xl border border-[var(--pg-line)] p-2">
                  <Input
                    value={r.name}
                    onChange={(e) => setRounds((rs) => rs.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                    onBlur={() => post({ op: "updateRound", id: r.id, name: r.name, settings: r.settings })}
                  />
                  <Button size="sm" variant="ghost" onClick={async () => { await post({ op: "deleteRound", id: r.id }); load(); }}>✕</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={async () => { await post({ op: "addRound", id: quizId }); load(); }}>
                + রাউন্ড যোগ করুন
              </Button>
              <p className="text-xs text-slate-500">
                রাউন্ড ব্যবহার করে বিষয়ভিত্তিক পর্ব তৈরি করুন — যেমন রাউন্ড ১ কম্পিউটার, রাউন্ড ২ গণিত।
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="✨ এআই দিয়ে প্রশ্ন যোগ করুন"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAiOpen(false)}>বাতিল</Button>
            <Button loading={aiBusy} onClick={quickAI} disabled={!aiTopic.trim()}>
              {aiCount}টি প্রশ্ন যোগ করুন
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="কোন বিষয়ে প্রশ্ন চান?" required hint="যেমন: HTML ফর্ম · সালোকসংশ্লেষণ · বাংলাদেশের মুক্তিযুদ্ধ">
            <Input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="বিষয় বা টপিক লিখুন"
              autoFocus
            />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">কতটি প্রশ্ন?</p>
            <div className="flex flex-wrap gap-1.5">
              {[3, 5, 10, 15, 20, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setAiCount(n)}
                  className={cx(
                    "rounded-lg border px-3 py-1.5 text-xs font-bold",
                    aiCount === n ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="ডিফিকাল্টি">
              <Select value={aiDiff} onChange={(e) => setAiDiff(e.target.value)}>
                <option value="easy">সহজ</option>
                <option value="medium">মাঝারি</option>
                <option value="hard">কঠিন</option>
              </Select>
            </Field>
            <Field label="ভাষা">
              <Select value={aiLang} onChange={(e) => setAiLang(e.target.value)}>
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
                <option value="mixed">মিশ্র</option>
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">প্রশ্নের ধরন</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["mcq", "বহুনির্বাচনি"],
                ["true_false", "সত্য/মিথ্যা"],
                ["multi_select", "একাধিক নির্বাচন"],
                ["short_answer", "সংক্ষিপ্ত"],
                ["word_jumble", "🧩 শব্দ সাজানো"],
                ["odd_one_out", "🧩 বেমানান"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() =>
                    setAiTypes((t) => (t.includes(v) ? t.filter((x) => x !== v) : [...t, v]))
                  }
                  className={cx(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                    aiTypes.includes(v) ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500">
            💡 প্রশ্নগুলো সরাসরি এই কুইজে যোগ হবে এবং প্রশ্ন ব্যাংকেও সংরক্ষিত থাকবে। যোগ হওয়ার পর
            সম্পাদনা করতে পারবেন।
          </p>
        </div>
      </Modal>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="প্রশ্ন ব্যাংক থেকে যোগ করুন" wide>
        <div className="flex gap-2">
          <Input value={bankQuery} onChange={(e) => setBankQuery(e.target.value)} placeholder="খুঁজুন…" />
          <Button onClick={searchBank}>খুঁজুন</Button>
        </div>
        <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto pg-scroll">
          {bankRows.map((q) => (
            <div key={q.id} className="flex items-center gap-2 rounded-xl border border-[var(--pg-line)] p-2 text-sm">
              <span className="flex-1">{q.text}</span>
              <Badge tone="slate">{q.difficulty}</Badge>
              <Button
                size="sm"
                onClick={async () => {
                  await post({ op: "addQuestions", id: quizId, questionIds: [q.id] });
                  load();
                  push("যোগ হয়েছে", "success");
                }}
              >
                + যোগ
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            variant="gold"
            block
            onClick={() => { setPickerOpen(false); setAiOpen(true); }}
          >
            ✨ এআই দিয়ে এখানেই তৈরি করুন
          </Button>
          <Link href="/teacher/ai">
            <Button variant="outline" block>📄 PDF / পেস্ট থেকে আনুন</Button>
          </Link>
        </div>
      </Modal>
    </div>
  );
}
