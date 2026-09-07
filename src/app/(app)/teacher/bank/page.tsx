"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
  useToast,
  cx,
} from "@/components/ui";
import { QUESTION_TYPES } from "@/lib/ai";

type Question = {
  id: number;
  text: string;
  type: string;
  options: string[];
  correct: (string | number)[];
  explanation: string | null;
  hint: string | null;
  difficulty: string;
  marks: number;
  timer: number;
  source: string;
  usedCount: number;
  subjectId: number | null;
  classId: number | null;
  chapterId: number | null;
  topicId: number | null;
};

export default function BankPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({ q: "", limit: "20", sort: "new" });
  const [structure, setStructure] = useState<{ classes: { id: number; name: string }[]; subjects: { id: number; name: string }[]; trades: { id: number; name: string }[] } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<Question | null>(null);
  const [preview, setPreview] = useState<Question | null>(null);
  const [quizzes, setQuizzes] = useState<{ id: number; title: string }[]>([]);
  const [bulkValue, setBulkValue] = useState("");
  const [dupes, setDupes] = useState<{ pairs: { a: { id: number; text: string }; b: { id: number; text: string }; score: number }[]; scanned: number } | null>(null);
  const [dupeBusy, setDupeBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page) });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    const res = await fetch(`/api/questions?${qs}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows);
      setTotal(data.total);
      setPages(data.pages);
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    fetch("/api/structure").then(async (r) => r.ok && setStructure(await r.json()));
    fetch("/api/quizzes?mine=1").then(async (r) => r.ok && setQuizzes((await r.json()).rows));
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error ?? "ব্যর্থ", "error");
    load();
    return data;
  };

  const bulk = async (action: string, value?: unknown, quizId?: number) => {
    if (!selected.length) return push("প্রথমে প্রশ্ন নির্বাচন করুন", "error");
    await post({ op: "bulk", ids: selected, action, value, quizId });
    push("সম্পন্ন হয়েছে", "success");
    setSelected([]);
  };

  const set = (k: string, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="🗃️ প্রশ্ন ব্যাংক"
        subtitle={`মোট ${total}টি প্রশ্ন`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={dupeBusy}
              onClick={async () => {
                setDupeBusy(true);
                const d = await post({ op: "findDuplicates" });
                setDupeBusy(false);
                if (d) {
                  setDupes(d);
                  push(d.pairs.length ? `${d.pairs.length} জোড়া মিল পাওয়া গেছে` : "কোনো ডুপ্লিকেট নেই ✅", d.pairs.length ? "info" : "success");
                }
              }}
            >
              🔍 ডুপ্লিকেট খুঁজুন
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const qs = new URLSearchParams({ format: "csv", limit: "500" });
                for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
                window.open(`/api/questions?${qs}`, "_blank");
              }}
            >
              ⬇️ CSV এক্সপোর্ট
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setEditing({
                  id: 0,
                  text: "",
                  type: "mcq",
                  options: ["", "", "", ""],
                  correct: [0],
                  explanation: "",
                  hint: "",
                  difficulty: "medium",
                  marks: 1,
                  timer: 30, // default; adjustable per question
                  source: "manual",
                  usedCount: 0,
                  subjectId: null,
                  classId: null,
                  chapterId: null,
                  topicId: null,
                })
              }
            >
              + নতুন প্রশ্ন
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="🔍 প্রশ্ন খুঁজুন…" value={filters.q} onChange={(e) => set("q", e.target.value)} />
          <Select value={filters.classId ?? ""} onChange={(e) => set("classId", e.target.value)}>
            <option value="">সব শ্রেণি</option>
            {structure?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={filters.subjectId ?? ""} onChange={(e) => set("subjectId", e.target.value)}>
            <option value="">সব বিষয়</option>
            {structure?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={filters.tradeId ?? ""} onChange={(e) => set("tradeId", e.target.value)}>
            <option value="">সব ট্রেড</option>
            {structure?.trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={filters.difficulty ?? ""} onChange={(e) => set("difficulty", e.target.value)}>
            <option value="">সব ডিফিকাল্টি</option>
            <option value="easy">সহজ</option>
            <option value="medium">মাঝারি</option>
            <option value="hard">কঠিন</option>
          </Select>
          <Select value={filters.type ?? ""} onChange={(e) => set("type", e.target.value)}>
            <option value="">সব ধরন</option>
            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.labelBn}</option>)}
          </Select>
          <Select value={filters.source ?? ""} onChange={(e) => set("source", e.target.value)}>
            <option value="">এআই + ম্যানুয়াল</option>
            <option value="ai">শুধু এআই</option>
            <option value="manual">শুধু ম্যানুয়াল</option>
          </Select>
          <Select value={filters.used ?? ""} onChange={(e) => set("used", e.target.value)}>
            <option value="">ব্যবহৃত + অব্যবহৃত</option>
            <option value="yes">ব্যবহৃত</option>
            <option value="no">অব্যবহৃত</option>
          </Select>
          <Select value={filters.sort} onChange={(e) => set("sort", e.target.value)}>
            <option value="new">নতুন আগে</option>
            <option value="old">পুরনো আগে</option>
            <option value="marks">মার্কস অনুযায়ী</option>
            <option value="used">ব্যবহার অনুযায়ী</option>
          </Select>
          <Select value={filters.limit} onChange={(e) => set("limit", e.target.value)}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / পৃষ্ঠা</option>)}
          </Select>
        </div>
      </Card>

      {dupes ? (
        <Card className={dupes.pairs.length ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}>
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm">
              {dupes.pairs.length
                ? `⚠️ ${dupes.pairs.length} জোড়া প্রায় একই প্রশ্ন`
                : "✅ কোনো ডুপ্লিকেট পাওয়া যায়নি"}
            </b>
            <span className="text-xs text-slate-500">({dupes.scanned}টি প্রশ্ন স্ক্যান করা হয়েছে)</span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setDupes(null)}>বন্ধ</Button>
          </div>
          {dupes.pairs.length ? (
            <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pg-scroll">
              {dupes.pairs.map((pr, i) => (
                <div key={i} className="rounded-xl bg-white p-2.5 text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone="coral">{Math.round(pr.score * 100)}% মিল</Badge>
                  </div>
                  {[pr.a, pr.b].map((q) => (
                    <div key={q.id} className="flex items-start gap-2 border-t border-slate-100 py-1.5 first:border-0">
                      <span className="min-w-0 flex-1">{q.text.slice(0, 100)}</span>
                      <Button size="sm" variant="ghost" onClick={() => post({ op: "delete", id: q.id })}>
                        মুছুন
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {selected.length ? (
        <Card className="border-teal-200 bg-teal-50">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm">{selected.length}টি নির্বাচিত</b>
            <Select className="w-auto" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
              <option value="">কুইজে যোগ করুন…</option>
              {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </Select>
            <Button size="sm" onClick={() => bulk("addToQuiz", null, Number(bulkValue))} disabled={!bulkValue}>
              যোগ করুন
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("duplicate")}>ডুপ্লিকেট</Button>
            <Button size="sm" variant="outline" onClick={() => bulk("difficulty", "hard")}>কঠিন করুন</Button>
            <Button size="sm" variant="outline" onClick={() => bulk("marks", 2)}>মার্কস ২</Button>
            <Button size="sm" variant="outline" onClick={() => bulk("explanations")}>ব্যাখ্যা তৈরি</Button>
            <Button size="sm" variant="danger" onClick={() => bulk("delete")}>মুছুন</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>বাতিল</Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="কোনো প্রশ্ন পাওয়া যায়নি" description="ফিল্টার পরিবর্তন করুন বা এআই দিয়ে নতুন প্রশ্ন তৈরি করুন।" />
      ) : (
        <div className="space-y-2">
          {rows.map((q) => (
            <Card key={q.id} padded={false} className="p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={selected.includes(q.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, q.id] : s.filter((x) => x !== q.id)))}
                  aria-label={`select ${q.id}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{q.text}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="blue">{q.type}</Badge>
                    <Badge tone={q.difficulty === "hard" ? "coral" : q.difficulty === "easy" ? "green" : "gold"}>
                      {q.difficulty}
                    </Badge>
                    <Badge>{q.marks} মার্কস</Badge>
                    <Badge>{q.timer}s</Badge>
                    <Badge tone={q.source === "ai" ? "teal" : "slate"}>{q.source}</Badge>
                    <Badge>{q.usedCount > 0 ? `ব্যবহৃত ${q.usedCount}x` : "অব্যবহৃত"}</Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button size="sm" variant="ghost" onClick={() => setPreview(q)}>প্রিভিউ</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>সম্পাদনা</Button>
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "duplicate", id: q.id })}>কপি</Button>
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "delete", id: q.id })}>মুছুন</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← আগের</Button>
        <span className="text-sm font-semibold">{page} / {Math.max(1, pages)}</span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>পরের →</Button>
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="প্রশ্ন প্রিভিউ" wide>
        {preview ? (
          <div>
            <p className="text-lg font-bold">{preview.text}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {preview.options.map((o, i) => (
                <div
                  key={i}
                  className={cx(
                    "rounded-xl px-3 py-3 text-sm font-semibold text-white",
                    preview.correct.map(Number).includes(i) ? "ring-4 ring-emerald-300" : "",
                  )}
                  style={{ background: ["#e2574c", "#2f80ed", "#f0b429", "#0f9d58"][i % 4] }}
                >
                  {o}
                </div>
              ))}
            </div>
            {preview.explanation ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><b>ব্যাখ্যা:</b> {preview.explanation}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <QuestionEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={async (q) => {
          if (q.id) await post({ op: "update", id: q.id, data: q });
          else await post({ op: "create", data: { ...q, id: undefined } });
          setEditing(null);
          push("সংরক্ষিত ✅", "success");
        }}
        structure={structure}
      />
    </div>
  );
}

function QuestionEditor({
  editing,
  onClose,
  onSave,
  structure,
}: {
  editing: Question | null;
  onClose: () => void;
  onSave: (q: Question) => void;
  structure: { classes: { id: number; name: string }[]; subjects: { id: number; name: string }[] } | null;
}) {
  const [draft, setDraft] = useState<Question | null>(editing);
  useEffect(() => setDraft(editing), [editing]);
  if (!draft) return null;
  return (
    <Modal
      open={Boolean(editing)}
      onClose={onClose}
      title={draft.id ? "প্রশ্ন সম্পাদনা" : "নতুন প্রশ্ন"}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>বাতিল</Button>
          <Button onClick={() => onSave(draft)}>সংরক্ষণ</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="প্রশ্ন" required>
          <Textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="ধরন">
            <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.labelBn}</option>)}
            </Select>
          </Field>
          <Field label="ডিফিকাল্টি">
            <Select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}>
              <option value="easy">সহজ</option>
              <option value="medium">মাঝারি</option>
              <option value="hard">কঠিন</option>
            </Select>
          </Field>
          <Field label="মার্কস">
            <Input type="number" value={draft.marks} onChange={(e) => setDraft({ ...draft, marks: Number(e.target.value) })} />
          </Field>
          <Field label="টাইমার (সেকেন্ড)">
            <Input type="number" value={draft.timer} onChange={(e) => setDraft({ ...draft, timer: Number(e.target.value) })} />
          </Field>
          <Field label="শ্রেণি">
            <Select
              value={draft.classId ?? ""}
              onChange={(e) => setDraft({ ...draft, classId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">—</option>
              {structure?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="বিষয়">
            <Select
              value={draft.subjectId ?? ""}
              onChange={(e) => setDraft({ ...draft, subjectId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">—</option>
              {structure?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-600">অপশন (সঠিকটি নির্বাচন করুন)</p>
          {draft.options.map((o, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.correct.map(Number).includes(i)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    correct: e.target.checked
                      ? draft.type === "multi_select"
                        ? [...draft.correct.map(Number), i]
                        : [i]
                      : draft.correct.map(Number).filter((x) => x !== i),
                  })
                }
                className="h-5 w-5"
                aria-label={`correct ${i}`}
              />
              <Input
                value={o}
                onChange={(e) => {
                  const opts = [...draft.options];
                  opts[i] = e.target.value;
                  setDraft({ ...draft, options: opts });
                }}
              />
              <button
                onClick={() => setDraft({ ...draft, options: draft.options.filter((_, x) => x !== i) })}
                className="px-2 text-rose-500"
                aria-label="remove option"
              >
                ✕
              </button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}>
            + অপশন যোগ
          </Button>
        </div>
        <Field label="ব্যাখ্যা">
          <Textarea value={draft.explanation ?? ""} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />
        </Field>
        <Field label="হিন্ট">
          <Input value={draft.hint ?? ""} onChange={(e) => setDraft({ ...draft, hint: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
