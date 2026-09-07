"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, SectionTitle, Tabs, useToast } from "@/components/ui";

type Quiz = { id: number; title: string; description: string | null; mode: string; questionCount: number; durationMinutes: number | null };

export default function StudentQuizzes() {
  const router = useRouter();
  const { push } = useToast();
  const [rows, setRows] = useState<Quiz[]>([]);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    fetch("/api/quizzes").then(async (r) => r.ok && setRows((await r.json()).rows));
  }, []);

  const start = async (quiz: Quiz) => {
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", quizId: quiz.id, mode: quiz.mode === "exam" ? "exam" : "practice" }),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error ?? "শুরু করা যায়নি", "error");
    router.push(`/student/exam/${data.attemptId}`);
  };

  const filtered = rows.filter((r) => (tab === "all" ? true : r.mode === tab));

  return (
    <div className="space-y-4">
      <SectionTitle
        title="📝 কুইজ ও পরীক্ষা"
        subtitle="লাইভ কুইজে পিন দিয়ে যোগ দিন, অথবা পরীক্ষা ও অনুশীলন সেট শুরু করুন"
        action={<Link href="/join"><Button>লাইভ পিন দিন</Button></Link>}
      />
      <Tabs
        tabs={[
          { id: "all", label: "সব" },
          { id: "exam", label: "পরীক্ষা" },
          { id: "practice", label: "অনুশীলন" },
          { id: "live", label: "লাইভ" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {filtered.length === 0 ? (
        <EmptyState icon="📝" title="কোনো কুইজ নেই" description="শিক্ষক নতুন কুইজ প্রকাশ করলে এখানে দেখা যাবে।" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((q) => (
            <Card key={q.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold leading-tight">{q.title}</h3>
                <Badge tone={q.mode === "exam" ? "blue" : q.mode === "practice" ? "gold" : "teal"}>{q.mode}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{q.description}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                {q.questionCount} প্রশ্ন · {q.durationMinutes ?? 30} মিনিট
              </p>
              {q.mode === "live" ? (
                <Link href="/join">
                  <Button className="mt-3" block variant="outline">পিন দিয়ে যোগ দিন</Button>
                </Link>
              ) : (
                <Button className="mt-3" block onClick={() => start(q)}>
                  {q.mode === "exam" ? "পরীক্ষা শুরু করুন" : "অনুশীলন শুরু"}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
