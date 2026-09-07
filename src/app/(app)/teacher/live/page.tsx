"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, SectionTitle, Select, Table, useToast } from "@/components/ui";

type Session = {
  id: number;
  pin: string;
  state: string;
  title: string;
  players: number;
  createdAt: string;
  endedAt: string | null;
};

export default function LivePage() {
  const router = useRouter();
  const { push } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [quizzes, setQuizzes] = useState<{ id: number; title: string; questionCount: number; mode: string }[]>([]);
  const [chosen, setChosen] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/live");
    if (res.ok) setSessions((await res.json()).sessions);
    const q = await fetch("/api/quizzes?mine=1");
    if (q.ok) setQuizzes((await q.json()).rows);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const start = async () => {
    if (!chosen) return push("একটি কুইজ নির্বাচন করুন", "error");
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", quizId: Number(chosen) }),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error ?? "ব্যর্থ", "error");
    router.push(`/host/${data.pin}`);
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="📡 লাইভ সেশন" subtitle="গেম পিন তৈরি করে ক্লাসে লাইভ কুইজ চালান" />

      <Card className="pg-hero-bg text-white">
        <p className="text-sm font-bold">নতুন লাইভ সেশন শুরু করুন</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Select value={chosen} onChange={(e) => setChosen(e.target.value)} className="text-slate-900">
            <option value="">কুইজ নির্বাচন করুন…</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} — {q.questionCount} প্রশ্ন ({q.mode})
              </option>
            ))}
          </Select>
          <Button variant="gold" onClick={start}>🚀 পিন তৈরি করুন</Button>
        </div>
        <p className="mt-2 text-xs text-white/70">
          শিক্ষার্থীরা /join পেজে গিয়ে পিন দিয়ে যোগ দেবে — অ্যাকাউন্ট ছাড়াই সম্ভব।
        </p>
      </Card>

      {sessions.length === 0 ? (
        <EmptyState icon="📡" title="কোনো সেশন নেই" description="উপরে থেকে নতুন লাইভ সেশন শুরু করুন।" />
      ) : (
        <Card padded={false}>
          <Table head={["পিন", "কুইজ", "স্ট্যাটাস", "খেলোয়াড়", "সময়", ""]}>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2.5 font-black tracking-wider">{s.pin}</td>
                <td className="px-3 py-2.5">{s.title}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={s.endedAt ? "slate" : "green"}>{s.state}</Badge>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{s.players}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {new Date(s.createdAt).toLocaleString("bn-BD")}
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/host/${s.pin}`}>
                    <Button size="sm" variant={s.endedAt ? "outline" : "primary"}>
                      {s.endedAt ? "ফলাফল" : "কন্ট্রোল"}
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
