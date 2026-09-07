"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Progress,
  SectionTitle,
  Select,
  Tabs,
  Textarea,
  Toggle,
  useToast,
  cx,
} from "@/components/ui";
import { PUZZLE_TYPES, QUESTION_TYPES } from "@/lib/ai";
import { PASTE_EXAMPLE, PASTE_EXAMPLE_CSV, parseQuestions } from "@/lib/parse-questions";

type GenQuestion = {
  text: string;
  type: string;
  options: string[];
  correct: (string | number)[];
  explanation: string;
  hint: string;
  objective?: string;
  difficulty: string;
  marks: number;
  timer: number;
  language: string;
};

type ResultRow = {
  id: number;
  payload: GenQuestion;
  flags: { code: string; severity: string; message: string }[];
  approved: boolean;
};

const COUNTS = [10, 20, 30, 50, 100, 200, 500, 1000];

const TYPE_PRESETS = [
  { label: "📝 সাধারণ", types: ["mcq", "true_false", "short_answer"] },
  { label: "🧩 পাজল", types: [...PUZZLE_TYPES] },
  { label: "🎡 মিশ্র", types: ["mcq", "short_answer", "word_jumble", "odd_one_out", "categorize", "matching", "ordering", "riddle"] },
  { label: "⚡ শুধু MCQ", types: ["mcq"] },
];

function AIPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState(params.get("tab") ?? "generate");
  const [provider, setProvider] = useState<{
    configured: boolean; provider: string; model: string; note: string;
    chain?: { id: string; model: string; label: string }[];
  } | null>(null);

  // shared settings
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [count, setCount] = useState(Number(params.get("count") ?? 10));
  const [language, setLanguage] = useState<"bn" | "en" | "mixed">("bn");
  const [types, setTypes] = useState<string[]>(["mcq"]);
  const [difficulty, setDifficulty] = useState(params.get("difficulty") ?? "medium");
  const [dist, setDist] = useState({ easy: 40, medium: 40, hard: 20 });
  const [marks, setMarks] = useState(1);
  const [timer, setTimer] = useState(30);
  const [withExplanation, setWithExplanation] = useState(true);
  const [withHint, setWithHint] = useState(true);
  const [audience, setAudience] = useState("");

  // paste
  const [pasteMode, setPasteMode] = useState<"ready" | "source">("ready");
  const [pasteText, setPasteText] = useState("");
  const [sourceText, setSourceText] = useState("");

  // document
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<{
    documentId: number; name: string; pageCount: number; chars: number; method: string;
    outline: { title: string; pageFrom: number; pageTo: number }[]; preview?: string[];
  } | null>(null);
  const [recentDocs, setRecentDocs] = useState<{ id: number; name: string; pageCount: number; method: string; outline: { title: string; pageFrom: number; pageTo: number }[] }[]>([]);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(1);
  const [chapterLabel, setChapterLabel] = useState("");

  // job / review
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<{ status: string; progress: number; total: number; completed: number; validation: Record<string, number>; provider: string } | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [editing, setEditing] = useState<ResultRow | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  // "Straight to quiz" flow — no need to visit the quiz tab first.
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizMode, setQuizMode] = useState<"new" | "existing">("new");
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizType, setNewQuizType] = useState("live");
  const [existingQuiz, setExistingQuiz] = useState("");
  const [myQuizzes, setMyQuizzes] = useState<{ id: number; title: string; questionCount: number; mode: string }[]>([]);

  useEffect(() => {
    fetch("/api/ai").then(async (r) => r.ok && setProvider((await r.json()).provider));
    fetch("/api/ai?documents=1").then(async (r) => r.ok && setRecentDocs((await r.json()).documents));
    fetch("/api/quizzes?mine=1").then(async (r) => r.ok && setMyQuizzes((await r.json()).rows));
    // Apply the teacher's saved defaults so they don't re-pick every time.
    fetch("/api/profile").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      const t = d.teacherDefaults;
      if (!t) return;
      setTimer(t.timer ?? 30);
      setMarks(t.marks ?? 1);
      setLanguage(t.language ?? "bn");
      setWithExplanation(t.withExplanation !== false);
      setWithHint(t.withHint !== false);
      if (!params.get("count")) setCount(t.questionCount ?? 10);
      if (!params.get("difficulty")) setDifficulty(t.difficulty ?? "medium");
    });
  }, [params]);

  const pollJob = useCallback(async (id: number) => {
    const res = await fetch(`/api/ai?job=${id}&results=1`);
    if (!res.ok) return;
    const data = await res.json();
    setJob(data.job);
    setResults(data.results);
    if (data.job.status === "running" || data.job.status === "queued") setTimeout(() => pollJob(id), 900);
  }, []);

  useEffect(() => {
    if (jobId) pollJob(jobId);
  }, [jobId, pollJob]);

  const baseParams = () => ({
    count, language, types, difficulty,
    distribution: difficulty === "custom" ? dist : undefined,
    marks, timer, withExplanation, withHint,
    topic: topic || undefined,
    objective: audience || undefined,
  });

  const runGenerate = async (extra: Record<string, unknown> = {}, action = "generate") => {
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, params: baseParams(), ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId);
      setSelected([]);
      setTab("review");
      push("প্রশ্ন তৈরি শুরু হয়েছে…", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    } finally {
      setBusy(false);
    }
  };

  const importPasted = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "importPasted",
          text: pasteText,
          defaults: { difficulty, marks, timer, language },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId);
      setSelected([]);
      setTab("review");
      push(`${data.imported}টি প্রশ্ন আমদানি হয়েছে${data.skipped ? `, ${data.skipped}টি বাদ` : ""}`, "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    } finally {
      setBusy(false);
    }
  };

  const analyzeDoc = async () => {
    if (!file) return push("একটি ফাইল নির্বাচন করুন", "error");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDoc(data);
      setPageFrom(1);
      setPageTo(data.pageCount);
      setChapterLabel("");
      push(`${data.pageCount} পেজ পড়া হয়েছে ✅`, "success");
      fetch("/api/ai?documents=1").then(async (r) => r.ok && setRecentDocs((await r.json()).documents));
    fetch("/api/quizzes?mine=1").then(async (r) => r.ok && setMyQuizzes((await r.json()).rows));
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    } finally {
      setBusy(false);
    }
  };

  const act = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error ?? "ব্যর্থ", "error");
    if (jobId) pollJob(jobId);
    return data;
  };

  const publish = async () => {
    const data = await act({
      action: "publish",
      jobId,
      resultIds: selected.length ? selected : undefined,
      meta: {},
    });
    if (data?.published) push(`${data.published}টি প্রশ্ন প্রশ্ন ব্যাংকে যোগ হয়েছে ✅`, "success");
  };

  const sendToQuiz = async () => {
    if (quizMode === "new" && !newQuizTitle.trim())
      return push("কুইজের নাম লিখুন", "error");
    if (quizMode === "existing" && !existingQuiz)
      return push("একটি কুইজ বেছে নিন", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "publishToQuiz",
          jobId,
          resultIds: selected.length ? selected : undefined,
          ...(quizMode === "new"
            ? { title: newQuizTitle, mode: newQuizType }
            : { quizId: Number(existingQuiz) }),
          meta: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      push(
        data.created
          ? `কুইজ তৈরি হয়েছে — ${data.added}টি প্রশ্নসহ ✅`
          : `${data.added}টি প্রশ্ন কুইজে যোগ হয়েছে ✅`,
        "success",
      );
      setQuizOpen(false);
      router.push(`/teacher/quizzes/${data.quizId}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(
    () => (pasteText.trim() ? parseQuestions(pasteText, { difficulty: difficulty as "medium", marks, timer, language }) : null),
    [pasteText, difficulty, marks, timer, language],
  );

  /* ---------------------------- shared controls ---------------------------- */
  const SharedSettings = (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="প্রশ্ন সংখ্যা">
          <Input type="number" min={1} max={2000} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </Field>
        <Field label="ভাষা">
          <Select value={language} onChange={(e) => setLanguage(e.target.value as "bn")}>
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
            <option value="mixed">মিশ্র</option>
          </Select>
        </Field>
        <Field label="প্রতি প্রশ্নে মার্কস">
          <Input type="number" min={0.5} step={0.5} value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
        </Field>
        <Field label="টাইমার (৫-৩০০ সেকেন্ড)">
          <Input type="number" min={5} max={300} value={timer} onChange={(e) => setTimer(Number(e.target.value))} />
        </Field>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {COUNTS.map((c) => (
          <button key={c} onClick={() => setCount(c)}
            className={cx("rounded-lg border px-3 py-1.5 text-xs font-bold",
              count === c ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]")}>
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-slate-600">ডিফিকাল্টি</p>
        <div className="flex flex-wrap gap-1.5">
          {[["easy", "সহজ"], ["medium", "মাঝারি"], ["hard", "কঠিন"], ["custom", "কাস্টম মিশ্রণ"]].map(([v, l]) => (
            <button key={v} onClick={() => setDifficulty(v)}
              className={cx("rounded-lg border px-3 py-1.5 text-xs font-bold",
                difficulty === v ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]")}>
              {l}
            </button>
          ))}
        </div>
        {difficulty === "custom" ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["easy", "medium", "hard"] as const).map((k) => (
              <Field key={k} label={`${k} %`}>
                <Input type="number" value={dist[k]} onChange={(e) => setDist((x) => ({ ...x, [k]: Number(e.target.value) }))} />
              </Field>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-slate-600">প্রশ্নের ধরন</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {TYPE_PRESETS.map((p) => (
            <Button key={p.label} size="sm" variant="outline" onClick={() => setTypes(p.types)}>{p.label}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUESTION_TYPES.map((t) => (
            <button key={t.value}
              onClick={() => setTypes((s) => (s.includes(t.value) ? s.filter((x) => x !== t.value) : [...s, t.value]))}
              className={cx("rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                types.includes(t.value) ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]")}>
              {t.labelBn}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Toggle checked={withExplanation} onChange={setWithExplanation} label="ব্যাখ্যা যোগ করুন" />
        <Toggle checked={withHint} onChange={setWithHint} label="হিন্ট যোগ করুন" />
      </div>
    </>
  );

  return (
    <div className="space-y-5">
      <SectionTitle
        title="✨ প্রশ্ন তৈরি করুন"
        subtitle="বিষয় লিখে এআই দিয়ে, তৈরি প্রশ্ন পেস্ট করে, অথবা PDF/বই থেকে"
      />

      {provider ? (
        <Card className={provider.configured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={provider.configured ? "green" : "gold"}>
              {provider.configured ? "✨ AI সক্রিয়" : "সেটআপ প্রয়োজন"}
            </Badge>
            {provider.chain?.length ? (
              provider.chain.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  {i > 0 ? <span className="text-slate-400">→</span> : null}
                  <span
                    className={cx(
                      "rounded-lg px-2 py-1 text-xs font-bold",
                      i === 0 ? "bg-emerald-600 text-white" : "bg-white text-slate-600",
                    )}
                    title={c.model}
                  >
                    {i === 0 ? "১ম " : `${i + 1}ম `}
                    {c.label}
                  </span>
                </span>
              ))
            ) : (
              <span className="font-semibold">{provider.provider}</span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-600">{provider.note}</p>

          {!provider.configured ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
              <p className="text-sm font-bold">🆓 ফ্রি Gemini কী দিয়ে মান অনেক বাড়ান</p>
              <ol className="mt-2 space-y-1 text-xs text-slate-600">
                <li>
                  ১.{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[var(--pg-teal)] underline"
                  >
                    aistudio.google.com/apikey
                  </a>{" "}
                  এ যান (গুগল অ্যাকাউন্ট দিয়ে লগইন)
                </li>
                <li>২. &quot;Create API key&quot; চাপুন — ক্রেডিট কার্ড লাগবে না</li>
                <li>
                  ৩. কী কপি করে{" "}
                  <a href="/admin/ai" className="font-bold text-[var(--pg-teal)] underline">
                    অ্যাডমিন → এআই কী
                  </a>{" "}
                  পেজে বসান (অথবা সার্ভারে <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY</code>)
                </li>
                <li>৪. &quot;যাচাই করুন&quot; চেপে নিশ্চিত হোন — সাথে সাথেই চালু হবে</li>
              </ol>
              <p className="mt-2 text-[11px] text-slate-500">
                কী ছাড়াও সব ফিচার চলছে — বিল্ট-ইন জেনারেটর প্রশ্ন বানাচ্ছে, তবে এআই ব্যবহার করলে
                প্রশ্ন অনেক বেশি প্রাসঙ্গিক ও গভীর হবে।
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Tabs
        tabs={[
          { id: "generate", label: "এআই জেনারেট", icon: "✨" },
          { id: "paste", label: "প্রশ্ন পেস্ট করুন", icon: "📋" },
          { id: "document", label: "PDF / বই", icon: "📄" },
          { id: "review", label: `রিভিউ (${results.length})`, icon: "🔍" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ------------------------------ generate ------------------------------ */}
      {tab === "generate" ? (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="বিষয় / টপিক" required hint="যেমন: HTML ফর্ম · বাংলাদেশের মুক্তিযুদ্ধ · Photosynthesis">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="যে বিষয়ে প্রশ্ন চান" />
            </Field>
            <Field label="কাদের জন্য? (ঐচ্ছিক)" hint="যেমন: ক্লাস ১০ · বিশ্ববিদ্যালয় ভর্তি · চাকরির পরীক্ষা · অফিস ট্রেনিং">
              <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="শ্রোতা বা স্তর" />
            </Field>
          </div>
          {SharedSettings}
          <Button className="mt-5" size="lg" block loading={busy} onClick={() => runGenerate()} disabled={!topic.trim()}>
            ✨ {count}টি প্রশ্ন তৈরি করুন
          </Button>
          {!topic.trim() ? (
            <p className="mt-2 text-center text-xs text-slate-400">শুরু করতে একটি বিষয় লিখুন</p>
          ) : null}
        </Card>
      ) : null}

      {/* -------------------------------- paste ------------------------------- */}
      {tab === "paste" ? (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {([["ready", "📋 তৈরি প্রশ্ন পেস্ট করুন"], ["source", "📄 লেখা থেকে প্রশ্ন বানান"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setPasteMode(v)}
                className={cx("flex-1 rounded-lg py-2 text-sm font-bold",
                  pasteMode === v ? "bg-white shadow-sm" : "text-slate-500")}>
                {l}
              </button>
            ))}
          </div>

          {pasteMode === "ready" ? (
            <>
              <Card>
                <SectionTitle
                  title="তৈরি প্রশ্ন পেস্ট করুন"
                  subtitle="Word, Excel, Google Docs বা অন্য কুইজ অ্যাপ থেকে কপি করে বসান — অপশন ও উত্তরসহ"
                />
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={PASTE_EXAMPLE}
                  className="min-h-[260px] font-mono text-xs"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setPasteText(PASTE_EXAMPLE)}>উদাহরণ (প্রশ্ন-উত্তর)</Button>
                  <Button size="sm" variant="outline" onClick={() => setPasteText(PASTE_EXAMPLE_CSV)}>উদাহরণ (Excel/CSV)</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPasteText("")}>মুছুন</Button>
                </div>

                {preview ? (
                  <div className="mt-3 rounded-xl border border-[var(--pg-line)] bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={preview.questions.length ? "green" : "coral"}>
                        {preview.questions.length}টি প্রশ্ন শনাক্ত
                      </Badge>
                      {preview.skipped ? <Badge tone="gold">{preview.skipped} লাইন বাদ</Badge> : null}
                      <Badge tone="blue">ফরম্যাট: {preview.format}</Badge>
                    </div>
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="mt-1.5 text-xs text-amber-700">⚠️ {w}</p>
                    ))}
                    {preview.questions.slice(0, 3).map((q, i) => (
                      <div key={i} className="mt-2 rounded-lg bg-white p-2 text-xs">
                        <p className="font-semibold">{i + 1}. {q.text}</p>
                        <p className="mt-0.5 text-slate-500">
                          {q.options.map((o, oi) => (
                            <span key={oi} className={cx("mr-2", q.correct.map(Number).includes(oi) && "font-bold text-emerald-700")}>
                              {String.fromCharCode(65 + oi)}) {o}
                            </span>
                          ))}
                          {!q.options.length ? <span>উত্তর: {String(q.correct[0] ?? "")}</span> : null}
                        </p>
                      </div>
                    ))}
                    {preview.questions.length > 3 ? (
                      <p className="mt-1 text-xs text-slate-400">…আরও {preview.questions.length - 3}টি</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="ডিফিকাল্টি">
                    <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      <option value="easy">সহজ</option>
                      <option value="medium">মাঝারি</option>
                      <option value="hard">কঠিন</option>
                    </Select>
                  </Field>
                  <Field label="মার্কস"><Input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} /></Field>
                  <Field label="টাইমার"><Input type="number" value={timer} onChange={(e) => setTimer(Number(e.target.value))} /></Field>
                </div>

                <Button className="mt-4" size="lg" block loading={busy}
                  disabled={!preview?.questions.length} onClick={importPasted}>
                  📥 {preview?.questions.length ?? 0}টি প্রশ্ন আমদানি করুন
                </Button>
              </Card>

              <Card>
                <p className="mb-2 text-xs font-bold uppercase text-slate-400">সমর্থিত ফরম্যাট</p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li>✅ <b>নম্বরযুক্ত প্রশ্ন</b> — <code>1. প্রশ্ন</code> তারপর <code>A) অপশন</code> ও <code>Answer: B</code></li>
                  <li>✅ <b>Excel / Google Sheets</b> — কলাম কপি করে সরাসরি পেস্ট করুন (ট্যাব আলাদা)</li>
                  <li>✅ <b>CSV</b> — <code>Question,Option1,Option2,...,Answer,Time</code></li>
                  <li>✅ <b>তারকা চিহ্ন</b> — সঠিক অপশনের আগে <code>*</code> দিন</li>
                  <li>✅ <b>ব্যাখ্যা ও হিন্ট</b> — <code>ব্যাখ্যা:</code> / <code>হিন্ট:</code> লাইন যোগ করুন</li>
                  <li>✅ <b>সত্য/মিথ্যা</b> ও <b>সংক্ষিপ্ত উত্তর</b> স্বয়ংক্রিয়ভাবে শনাক্ত হয়</li>
                </ul>
              </Card>
            </>
          ) : (
            <Card>
              <SectionTitle
                title="লেখা থেকে প্রশ্ন বানান"
                subtitle="যেকোনো অনুচ্ছেদ, নোট বা আর্টিকেল পেস্ট করুন — এআই সেখান থেকে প্রশ্ন তৈরি করবে"
              />
              <Textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="এখানে আপনার পড়ার বিষয়বস্তু পেস্ট করুন…"
                className="min-h-[220px]"
              />
              <p className="mt-1 text-xs text-slate-500">{sourceText.length} অক্ষর</p>
              <Field label="বিষয়ের নাম (ঐচ্ছিক)">
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="যেমন: কোষ বিভাজন" />
              </Field>
              {SharedSettings}
              <Button className="mt-5" size="lg" block loading={busy}
                disabled={sourceText.trim().length < 60}
                onClick={() => runGenerate({ params: { ...baseParams(), documentText: sourceText } })}>
                ✨ এই লেখা থেকে {count}টি প্রশ্ন তৈরি করুন
              </Button>
              {sourceText.trim().length < 60 ? (
                <p className="mt-2 text-center text-xs text-slate-400">কমপক্ষে ৬০ অক্ষর লিখুন</p>
              ) : null}
            </Card>
          )}
        </div>
      ) : null}

      {/* ------------------------------ document ------------------------------ */}
      {tab === "document" ? (
        <div className="space-y-4">
          <Card>
            <SectionTitle title="১️⃣ ফাইল আপলোড করুন" subtitle="সম্পূর্ণ বইয়ের PDF দিতে পারেন — পরে অধ্যায় বেছে নেবেন" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input type="file" accept=".pdf,.docx,.pptx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="flex-1 rounded-xl border border-dashed border-[var(--pg-line)] p-4 text-sm" />
              <Button loading={busy} onClick={analyzeDoc}>📄 পড়ুন ও বিশ্লেষণ করুন</Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              PDF, DOCX, PPTX, TXT (সর্বোচ্চ ৪০MB)। স্ক্যান করা ছবি-ভিত্তিক PDF থেকে টেক্সট পড়া যায় না।
            </p>
            {recentDocs.length ? (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-bold uppercase text-slate-400">আগের আপলোড</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentDocs.map((d) => (
                    <button key={d.id}
                      onClick={() => { setDoc({ documentId: d.id, name: d.name, pageCount: d.pageCount, chars: 0, method: d.method, outline: d.outline ?? [] }); setPageFrom(1); setPageTo(d.pageCount); }}
                      className={cx("rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                        doc?.documentId === d.id ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]")}>
                      📘 {d.name} · {d.pageCount}পেজ
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {doc ? (
            <>
              <Card>
                <SectionTitle title="২️⃣ অধ্যায় বা পেজ রেঞ্জ" subtitle={`${doc.name} — ${doc.pageCount} পেজ`}
                  action={<Badge tone="teal">{doc.method}</Badge>} />
                {doc.outline?.length ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {doc.outline.map((o) => (
                      <button key={o.title}
                        onClick={() => { setPageFrom(o.pageFrom); setPageTo(o.pageTo); setChapterLabel(o.title); }}
                        className={cx("rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                          chapterLabel === o.title ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]")}>
                        {o.title} <span className="text-slate-400">({o.pageFrom}-{o.pageTo})</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-slate-500">অধ্যায় শিরোনাম শনাক্ত হয়নি — নিচে পেজ নম্বর দিন।</p>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="শুরুর পেজ">
                    <Input type="number" min={1} max={doc.pageCount} value={pageFrom}
                      onChange={(e) => setPageFrom(Math.max(1, Math.min(doc.pageCount, Number(e.target.value))))} />
                  </Field>
                  <Field label="শেষ পেজ">
                    <Input type="number" min={1} max={doc.pageCount} value={pageTo}
                      onChange={(e) => setPageTo(Math.max(1, Math.min(doc.pageCount, Number(e.target.value))))} />
                  </Field>
                  <Field label="অধ্যায়ের নাম (ঐচ্ছিক)">
                    <Input value={chapterLabel} onChange={(e) => setChapterLabel(e.target.value)} placeholder="যেমন: অধ্যায় ১" />
                  </Field>
                </div>
                <p className="mt-2 text-xs font-semibold text-[var(--pg-teal)]">
                  নির্বাচিত: পেজ {pageFrom}-{pageTo} ({Math.max(0, pageTo - pageFrom + 1)}টি পেজ)
                </p>
                {doc.preview?.length ? (
                  <details className="mt-2 text-xs text-slate-500">
                    <summary className="cursor-pointer font-semibold">📖 পড়া টেক্সটের নমুনা</summary>
                    {doc.preview.map((p, i) => <p key={i} className="mt-1 rounded-lg bg-slate-50 p-2">{p}…</p>)}
                  </details>
                ) : null}
              </Card>

              <Card>
                <SectionTitle title="৩️⃣ প্রশ্নের ধরন ও সংখ্যা" />
                {SharedSettings}
                <Button className="mt-4" size="lg" block loading={busy}
                  onClick={() => runGenerate({ documentId: doc.documentId, pageFrom, pageTo, chapterLabel }, "generateFromDoc")}>
                  ✨ পেজ {pageFrom}-{pageTo} থেকে {count}টি প্রশ্ন তৈরি করুন
                </Button>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------- review ------------------------------- */}
      {tab === "review" ? (
        <div className="space-y-4">
          {job ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    স্ট্যাটাস: <Badge tone={job.status === "completed" ? "green" : "gold"}>{job.status}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">{job.completed}/{job.total} প্রশ্ন · উৎস {job.provider}</p>
                </div>
                <div className="w-full sm:w-64">
                  <Progress value={job.progress} />
                  <p className="mt-1 text-right text-xs font-bold tabular-nums">{job.progress}%</p>
                </div>
              </div>
              {job.validation && Object.keys(job.validation).length ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone="green">ক্লিন: {job.validation.clean ?? 0}</Badge>
                  <Badge tone="gold">সতর্কতা: {job.validation.warnings ?? 0}</Badge>
                  <Badge tone="coral">ত্রুটি: {job.validation.errors ?? 0}</Badge>
                </div>
              ) : null}
            </Card>
          ) : (
            <Card><p className="text-sm text-slate-500">প্রথমে প্রশ্ন তৈরি বা পেস্ট করুন।</p></Card>
          )}

          {results.length ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(results.map((r) => r.id))}>সব নির্বাচন</Button>
              <Button size="sm" variant="outline" onClick={() => setSelected([])}>বাতিল</Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={publish}>
                🗃️ প্রশ্ন ব্যাংকে যোগ করুন
              </Button>
              <Button
                onClick={() => {
                  setNewQuizTitle(topic || chapterLabel || "নতুন কুইজ");
                  setQuizOpen(true);
                }}
              >
                🎛️ সরাসরি কুইজ তৈরি করুন →
              </Button>
            </div>
          ) : null}

          <div className="space-y-3">
            {results.map((r, idx) => (
              <Card key={r.id} className={cx(r.approved && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.includes(r.id)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                    className="mt-1 h-5 w-5" aria-label={`select ${idx + 1}`} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1.5">
                      <Badge tone="blue">{r.payload.type}</Badge>
                      <Badge tone={r.payload.difficulty === "hard" ? "coral" : r.payload.difficulty === "easy" ? "green" : "gold"}>
                        {r.payload.difficulty}
                      </Badge>
                      <Badge>{r.payload.marks} মার্কস</Badge>
                      <Badge>{r.payload.timer}s</Badge>
                      {r.approved ? <Badge tone="green">প্রকাশিত</Badge> : null}
                    </div>
                    <p className="font-semibold">{idx + 1}. {r.payload.text}</p>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {r.payload.options.map((o, i) => (
                        <li key={i} className={cx("rounded-lg border px-2.5 py-1.5 text-sm",
                          r.payload.correct.map(Number).includes(i)
                            ? "border-emerald-300 bg-emerald-50 font-semibold"
                            : "border-[var(--pg-line)]")}>
                          {o}
                        </li>
                      ))}
                    </ul>
                    {!r.payload.options.length && r.payload.correct.length ? (
                      <p className="mt-1 text-sm"><b>উত্তর:</b> {String(r.payload.correct[0])}</p>
                    ) : null}
                    {r.payload.explanation ? <p className="mt-2 text-xs text-slate-600"><b>ব্যাখ্যা:</b> {r.payload.explanation}</p> : null}
                    {r.payload.hint ? <p className="text-xs text-slate-500"><b>হিন্ট:</b> {r.payload.hint}</p> : null}
                    {r.flags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.flags.map((f, i) => (
                          <Badge key={i} tone={f.severity === "error" ? "coral" : f.severity === "warn" ? "gold" : "slate"}>
                            {f.message}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setEditing(r)}>সম্পাদনা</Button>
                      <Button size="sm" variant="ghost" onClick={() => act({ action: "transform", resultId: r.id, mode: "improve" })}>উন্নত করুন</Button>
                      <Button size="sm" variant="ghost" onClick={() => act({ action: "transform", resultId: r.id, mode: "easier" })}>সহজ</Button>
                      <Button size="sm" variant="ghost" onClick={() => act({ action: "transform", resultId: r.id, mode: "harder" })}>কঠিন</Button>
                      <Button size="sm" variant="ghost" onClick={() => act({ action: "transform", resultId: r.id, mode: "explanation" })}>ব্যাখ্যা</Button>
                      <Button size="sm" variant="ghost" onClick={() => act({ action: "duplicateResult", resultId: r.id })}>ডুপ্লিকেট</Button>
                      <Button size="sm" variant="danger" onClick={() => act({ action: "deleteResult", resultId: r.id })}>মুছুন</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="প্রশ্ন সম্পাদনা" wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>বাতিল</Button>
            <Button onClick={async () => {
              if (!editing) return;
              await act({ action: "updateResult", resultId: editing.id, payload: editing.payload });
              setEditing(null);
              push("সংরক্ষিত", "success");
            }}>সংরক্ষণ</Button>
          </>
        }>
        {editing ? (
          <div className="space-y-3">
            <Field label="প্রশ্ন">
              <Textarea value={editing.payload.text}
                onChange={(e) => setEditing({ ...editing, payload: { ...editing.payload, text: e.target.value } })} />
            </Field>
            {editing.payload.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" checked={editing.payload.correct.map(Number).includes(i)}
                  onChange={() => setEditing({ ...editing, payload: { ...editing.payload, correct: [i] } })}
                  aria-label={`correct ${i}`} />
                <Input value={o} onChange={(e) => {
                  const opts = [...editing.payload.options];
                  opts[i] = e.target.value;
                  setEditing({ ...editing, payload: { ...editing.payload, options: opts } });
                }} />
              </div>
            ))}
            <Field label="ব্যাখ্যা">
              <Textarea value={editing.payload.explanation}
                onChange={(e) => setEditing({ ...editing, payload: { ...editing.payload, explanation: e.target.value } })} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="ডিফিকাল্টি">
                <Select value={editing.payload.difficulty}
                  onChange={(e) => setEditing({ ...editing, payload: { ...editing.payload, difficulty: e.target.value } })}>
                  <option value="easy">সহজ</option>
                  <option value="medium">মাঝারি</option>
                  <option value="hard">কঠিন</option>
                </Select>
              </Field>
              <Field label="মার্কস">
                <Input type="number" value={editing.payload.marks}
                  onChange={(e) => setEditing({ ...editing, payload: { ...editing.payload, marks: Number(e.target.value) } })} />
              </Field>
              <Field label="টাইমার">
                <Input type="number" value={editing.payload.timer}
                  onChange={(e) => setEditing({ ...editing, payload: { ...editing.payload, timer: Number(e.target.value) } })} />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default function AIPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>}>
      <AIPageInner />
    </Suspense>
  );
}
