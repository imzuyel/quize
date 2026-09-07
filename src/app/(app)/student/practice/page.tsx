"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Select, useToast } from "@/components/ui";

export default function PracticePage() {
  const router = useRouter();
  const { push } = useToast();
  const [quizzes, setQuizzes] = useState<{ id: number; title: string; questionCount: number }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [quizId, setQuizId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [limit, setLimit] = useState("10");
  const [weak, setWeak] = useState<{ weak: { subject: string; score: number }[]; strong: { subject: string; score: number }[]; message: string } | null>(null);
  const [attempts, setAttempts] = useState<{ id: number; title: string; score: number; maxScore: number; mode: string; status: string }[]>([]);

  useEffect(() => {
    fetch("/api/quizzes").then(async (r) => {
      if (r.ok) {
        const rows = (await r.json()).rows as { id: number; title: string; questionCount: number }[];
        setQuizzes(rows);
        if (rows[0]) setQuizId(String(rows[0].id));
      }
    });
    fetch("/api/structure").then(async (r) => r.ok && setSubjects((await r.json()).subjects));
    fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "practicePlan" }),
    }).then(async (r) => r.ok && setWeak(await r.json()));
    fetch("/api/exam").then(async (r) => r.ok && setAttempts((await r.json()).attempts));
  }, []);

  const start = async () => {
    if (!quizId) return push("একটি সেট নির্বাচন করুন", "error");
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "start",
        quizId: Number(quizId),
        mode: "practice",
        subjectId: subjectId ? Number(subjectId) : undefined,
        difficulty: difficulty || undefined,
        limit: Number(limit),
      }),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error ?? "শুরু করা যায়নি", "error");
    router.push(`/student/exam/${data.attemptId}`);
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="🎯 অনুশীলন" subtitle="সীমাহীন অনুশীলন, তাৎক্ষণিক ব্যাখ্যা ও হিন্টসহ" />

      <Card className="border-teal-200 bg-teal-50">
        <p className="text-sm font-bold">🤖 এআই ব্যক্তিগত পরামর্শ</p>
        <p className="mt-1 text-sm">{weak?.message ?? "বিশ্লেষণ চলছে…"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {weak?.weak.map((w) => <Badge key={w.subject} tone="coral">{w.subject} {w.score}%</Badge>)}
          {weak?.strong.map((w) => <Badge key={w.subject} tone="green">{w.subject} {w.score}%</Badge>)}
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="প্রশ্ন সেট">
            <Select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
              {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </Select>
          </Field>
          <Field label="বিষয়">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">সব বিষয়</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="ডিফিকাল্টি">
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">সব</option>
              <option value="easy">সহজ</option>
              <option value="medium">মাঝারি</option>
              <option value="hard">কঠিন</option>
            </Select>
          </Field>
          <Field label="প্রশ্ন সংখ্যা">
            <Select value={limit} onChange={(e) => setLimit(e.target.value)}>
              {[5, 10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
        </div>
        <Button className="mt-4" size="lg" block onClick={start}>
          🚀 {limit}টি অনুশীলন প্রশ্ন শুরু করুন
        </Button>
      </Card>

      <Card>
        <SectionTitle title="সাম্প্রতিক অনুশীলন" />
        {attempts.length === 0 ? (
          <EmptyState icon="🎯" title="এখনো অনুশীলন করেননি" />
        ) : (
          <div className="space-y-2">
            {attempts.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border border-[var(--pg-line)] p-3 text-sm">
                <span className="flex-1 font-semibold">{a.title}</span>
                <Badge tone={a.mode === "practice" ? "gold" : "blue"}>{a.mode}</Badge>
                <Badge tone={a.status === "submitted" ? "green" : "slate"}>{a.status}</Badge>
                <span className="tabular-nums font-bold">{Math.round(a.score)}/{Math.round(a.maxScore)}</span>
                {a.status === "in_progress" ? (
                  <Button size="sm" onClick={() => router.push(`/student/exam/${a.id}`)}>চালিয়ে যান</Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
