"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Confetti, DonutChart, Modal, useToast, cx } from "@/components/ui";
import { QuestionInput } from "@/components/interactive";

type Q = {
  id: number;
  text: string;
  type: string;
  options: string[];
  correct?: (string | number)[];
  explanation: string | null;
  hint: string | null;
  marks: number;
  difficulty: string;
};

type Attempt = { id: number; status: string; endsAt: string | null; mode: string; maxScore: number };

export default function ExamRunner({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const { push } = useToast();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [quiz, setQuiz] = useState<{ title: string } | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number[] | string[]>>({});
  const [marked, setMarked] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string | null; correctAnswer: (string | number)[] } | null>(null);
  const [result, setResult] = useState<{ score: number; maxScore: number; accuracy: number; correctCount: number; total: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/exam?attempt=${attemptId}`);
    if (!res.ok) return;
    const data = await res.json();
    setAttempt(data.attempt);
    setQuiz(data.quiz);
    setQuestions(data.questions);
    setMarked((data.attempt.flags as number[]) ?? []);
    const saved: Record<number, number[]> = {};
    for (const a of data.answers) saved[a.questionId] = a.answer as number[];
    setAnswers(saved);
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const submit = useCallback(async () => {
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "submit", attemptId: Number(attemptId) }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data);
      push("জমা হয়েছে ✅", "success");
    }
  }, [attemptId, push]);

  const remaining = attempt?.endsAt ? Math.max(0, new Date(attempt.endsAt).getTime() - now) : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && attempt?.status === "in_progress" && !result) {
      submit();
    }
  }, [remaining, attempt, result, submit]);

  const q = questions[index];
  const isPractice = attempt?.mode === "practice";

  const save = async (answer: (number | string)[], markFlag = false) => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: answer as number[] }));
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save",
        attemptId: Number(attemptId),
        questionId: q.id,
        answer,
        marked: markFlag,
      }),
    });
    const data = await res.json();
    if (res.ok && isPractice && data.correct !== undefined) {
      setFeedback({ correct: data.correct, explanation: data.explanation, correctAnswer: data.correctAnswer ?? [] });
    }
  };

  const answeredCount = Object.keys(answers).length;
  const palette = useMemo(
    () =>
      questions.map((qq, i) => ({
        i,
        answered: Boolean(answers[qq.id]),
        marked: marked.includes(i),
      })),
    [questions, answers, marked],
  );

  if (result)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Confetti />
        <Card className="text-center">
          <div className="text-5xl">🎉</div>
          <h1 className="mt-2 text-2xl font-extrabold">ফলাফল</h1>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
            <DonutChart value={result.accuracy} label="নির্ভুলতা" />
            <div className="text-left">
              <p className="text-sm">স্কোর: <b>{Math.round(result.score)}</b> / {Math.round(result.maxScore)}</p>
              <p className="text-sm">সঠিক: <b>{result.correctCount}</b> / {result.total}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/student/results"><Button>ফলাফল দেখুন</Button></Link>
            <Link href="/student"><Button variant="outline">ড্যাশবোর্ড</Button></Link>
          </div>
        </Card>
      </div>
    );

  if (!q) return <p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-extrabold">{quiz?.title}</h1>
        <Badge tone={isPractice ? "gold" : "blue"}>{isPractice ? "অনুশীলন" : "পরীক্ষা"}</Badge>
        <div className="flex-1" />
        {remaining !== null ? (
          <Badge tone={remaining < 60000 ? "coral" : "teal"}>
            ⏱ {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
          </Badge>
        ) : null}
        <Badge>{answeredCount}/{questions.length} উত্তর দেওয়া</Badge>
        <Button size="sm" onClick={() => setConfirmOpen(true)}>জমা দিন</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-bold">
              {index + 1}. {q.text}
            </p>
            <Badge tone="slate">{q.marks} মার্কস</Badge>
          </div>
          {isPractice && q.hint ? (
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold">💡 হিন্ট</summary>
              <p className="mt-1">{q.hint}</p>
            </details>
          ) : null}

          <div className="mt-4">
            <QuestionInput
              type={q.type}
              text={q.text}
              options={q.options}
              value={(answers[q.id] as (string | number)[]) ?? []}
              reveal={Boolean(feedback) && isPractice}
              correct={feedback?.correctAnswer}
              onChange={(v) => save(v)}
            />
          </div>

          {feedback && isPractice ? (
            <div className={cx("anim-fade mt-3 rounded-xl p-3 text-sm", feedback.correct ? "bg-emerald-50" : "bg-rose-50")}>
              <p className="font-bold">{feedback.correct ? "✅ সঠিক!" : "❌ ভুল হয়েছে"}</p>
              {feedback.explanation ? <p className="mt-1">{feedback.explanation}</p> : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" disabled={index === 0} onClick={() => { setIndex((i) => i - 1); setFeedback(null); }}>
              ← আগের
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const next = marked.includes(index) ? marked.filter((m) => m !== index) : [...marked, index];
                setMarked(next);
                await fetch("/api/exam", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "mark", attemptId: Number(attemptId), flags: next }),
                });
              }}
            >
              {marked.includes(index) ? "🔖 রিভিউ বাতিল" : "🔖 রিভিউ চিহ্ন"}
            </Button>
            <div className="flex-1" />
            <Button
              disabled={index >= questions.length - 1}
              onClick={() => { setIndex((i) => i + 1); setFeedback(null); }}
            >
              পরের →
            </Button>
          </div>
        </Card>

        <Card>
          <p className="mb-2 text-xs font-bold uppercase text-slate-400">প্রশ্ন প্যালেট</p>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {palette.map((p) => (
              <button
                key={p.i}
                onClick={() => { setIndex(p.i); setFeedback(null); }}
                className={cx(
                  "aspect-square rounded-lg text-xs font-bold",
                  p.i === index
                    ? "bg-[var(--pg-deep)] text-white"
                    : p.marked
                      ? "bg-amber-200"
                      : p.answered
                        ? "bg-emerald-200"
                        : "bg-slate-100",
                )}
              >
                {p.i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-[11px] text-slate-500">
            <p><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-200" /> উত্তর দেওয়া</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded bg-amber-200" /> রিভিউ চিহ্নিত</p>
            <p><span className="mr-1 inline-block h-3 w-3 rounded bg-slate-100" /> বাকি</p>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">উত্তর স্বয়ংক্রিয়ভাবে সংরক্ষিত হচ্ছে।</p>
        </Card>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="জমা দিতে চান?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>বাতিল</Button>
            <Button onClick={() => { setConfirmOpen(false); submit(); }}>হ্যাঁ, জমা দিন</Button>
          </>
        }
      >
        <p className="text-sm">
          আপনি {answeredCount}/{questions.length} প্রশ্নের উত্তর দিয়েছেন। জমা দিলে আর পরিবর্তন করা যাবে না।
        </p>
      </Modal>
    </div>
  );
}
