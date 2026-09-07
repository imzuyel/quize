"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Progress,
  SectionTitle,
  Select,
  Skeleton,
  StatCard,
  Table,
  useToast,
} from "@/components/ui";

type Analytics = {
  quizzes: { id: number; title: string; mode: string; scheduledAt: string | null; status: string }[];
  totals: {
    quizzes: number;
    results: number;
    averageScore: number;
    accuracy: number;
    participation: number;
    avgResponseMs: number;
    activeSessions: number;
  };
  activeSessions: { id: number; pin: string; state: string; quizId: number }[];
  recentResults: { playerName: string; score: number; accuracy: number; createdAt: string }[];
  insights: string[];
};

const ACTIONS = [
  { href: "/teacher/ai", icon: "✨", label: "এআই দিয়ে তৈরি করুন", tone: "bg-gradient-to-br from-violet-500 to-indigo-600" },
  { href: "/teacher/quizzes", icon: "🎛️", label: "কুইজ তৈরি", tone: "bg-gradient-to-br from-teal-500 to-emerald-600" },
  { href: "/teacher/live", icon: "📡", label: "লাইভ কুইজ শুরু", tone: "bg-gradient-to-br from-rose-500 to-orange-500" },
  { href: "/teacher/quizzes?mode=exam", icon: "📝", label: "পরীক্ষা তৈরি", tone: "bg-gradient-to-br from-sky-600 to-blue-700" },
  { href: "/teacher/bank", icon: "🗃️", label: "প্রশ্ন ব্যাংক", tone: "bg-gradient-to-br from-amber-500 to-yellow-600" },
  { href: "/teacher/templates", icon: "🎨", label: "টেমপ্লেট স্টুডিও", tone: "bg-gradient-to-br from-fuchsia-500 to-pink-600" },
  { href: "/teacher/slides", icon: "🎞️", label: "প্রেজেন্টেশন", tone: "bg-gradient-to-br from-cyan-500 to-blue-600" },
];

export default function TeacherDashboard() {
  const router = useRouter();
  const { push } = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [smartOpen, setSmartOpen] = useState(false);
  const [prompt, setPrompt] = useState("ক্লাস ১০ কম্পিউটার, HTML ফর্ম, মাঝারি, ৩০ প্রশ্ন");
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [quizList, setQuizList] = useState<{ id: number; title: string; questionCount: number }[]>([]);
  const [chosen, setChosen] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/analytics?scope=teacher");
    if (res.ok) setData(await res.json());
    const q = await fetch("/api/quizzes?mine=1");
    if (q.ok) setQuizList((await q.json()).rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startLive = async () => {
    if (!chosen) return push("একটি কুইজ বাছাই করুন", "error");
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", quizId: Number(chosen) }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? "ব্যর্থ", "error");
    router.push(`/host/${json.pin}`);
  };

  return (
    <div className="space-y-6">
      <div className="pg-hero-bg pg-shadow relative overflow-hidden rounded-2xl p-5 text-white">
        <div className="pg-grid-lines absolute inset-0 opacity-50" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest text-white/60">শিক্ষক ড্যাশবোর্ড</p>
          <h1 className="mt-1 text-2xl font-extrabold">আজ কী শেখাবেন?</h1>
          <p className="mt-1 text-sm text-white/70">
            পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ · এআই-চালিত কুইজ প্ল্যাটফর্ম
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="gold" onClick={() => setSmartOpen(true)}>
              🤖 স্মার্ট কুইজ তৈরি
            </Button>
            <Button variant="outline" onClick={() => setLiveOpen(true)}>
              📡 লাইভ কুইজ শুরু
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}>
            <div
              className={`${a.tone} pg-shadow flex h-full min-h-[104px] flex-col justify-between rounded-2xl p-4 text-white transition hover:-translate-y-0.5`}
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-sm font-bold leading-tight">{a.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {!data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="আমার কুইজ" value={data.totals.quizzes} icon="📚" />
            <StatCard label="গড় স্কোর" value={data.totals.averageScore} sub="সব ফলাফলের গড়" icon="🎯" tone="gold" />
            <StatCard label="অংশগ্রহণ" value={`${data.totals.participation}%`} icon="👥" tone="blue" />
            <StatCard
              label="গড় উত্তর সময়"
              value={`${Math.round(data.totals.avgResponseMs / 1000)}s`}
              icon="⏱️"
              tone="coral"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SectionTitle
                title="আজকের ও আসন্ন কুইজ"
                subtitle="সময়সূচি অনুযায়ী"
                action={
                  <Link href="/teacher/quizzes">
                    <Button size="sm" variant="outline">
                      সব দেখুন
                    </Button>
                  </Link>
                }
              />
              {data.quizzes.length === 0 ? (
                <EmptyState
                  title="এখনো কোনো কুইজ নেই"
                  description="এআই জেনারেটর বা কুইজ স্টুডিও দিয়ে শুরু করুন।"
                  action={
                    <Link href="/teacher/ai">
                      <Button className="mt-3">এআই দিয়ে তৈরি করুন</Button>
                    </Link>
                  }
                />
              ) : (
                <Table head={["শিরোনাম", "ধরন", "স্ট্যাটাস", "তারিখ", ""]}>
                  {data.quizzes.slice(0, 6).map((q) => (
                    <tr key={q.id}>
                      <td className="px-3 py-2 font-semibold">{q.title}</td>
                      <td className="px-3 py-2">
                        <Badge tone={q.mode === "exam" ? "blue" : q.mode === "practice" ? "gold" : "teal"}>
                          {q.mode}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={q.status === "published" ? "green" : "slate"}>{q.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {q.scheduledAt ? new Date(q.scheduledAt).toLocaleDateString("bn-BD") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/teacher/quizzes/${q.id}`}>
                          <Button size="sm" variant="ghost">
                            খুলুন
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            <Card>
              <SectionTitle title="🤖 এআই শিক্ষণ পরামর্শ" />
              <ul className="space-y-2 text-sm">
                {data.insights.map((i, idx) => (
                  <li key={idx} className="rounded-xl bg-slate-50 p-3 leading-relaxed">
                    {i}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold text-slate-500">সামগ্রিক নির্ভুলতা</p>
                <Progress value={data.totals.accuracy} />
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle title="সক্রিয় লাইভ সেশন" />
              {data.activeSessions.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">কোনো সক্রিয় সেশন নেই</p>
              ) : (
                <div className="space-y-2">
                  {data.activeSessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[var(--pg-line)] p-3">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-black text-white">{s.pin}</span>
                      <Badge tone="teal">{s.state}</Badge>
                      <div className="flex-1" />
                      <Link href={`/host/${s.pin}`}>
                        <Button size="sm">কন্ট্রোল</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle title="সাম্প্রতিক ফলাফল" />
              {data.recentResults.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">এখনো ফলাফল নেই</p>
              ) : (
                <Table head={["শিক্ষার্থী", "স্কোর", "নির্ভুলতা"]}>
                  {data.recentResults.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.playerName}</td>
                      <td className="px-3 py-2 font-bold tabular-nums">{Math.round(r.score)}</td>
                      <td className="px-3 py-2">{Math.round(r.accuracy)}%</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>
        </>
      )}

      <Modal
        open={smartOpen}
        onClose={() => setSmartOpen(false)}
        title="স্মার্ট কুইজ তৈরি"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setSmartOpen(false)}>
              বন্ধ
            </Button>
            <Button
              loading={loadingPlan}
              onClick={async () => {
                setLoadingPlan(true);
                const res = await fetch("/api/ai", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "plan", prompt }),
                });
                setPlan(await res.json());
                setLoadingPlan(false);
              }}
            >
              পরিকল্পনা তৈরি করুন
            </Button>
            {plan ? (
              <Button
                variant="gold"
                onClick={() =>
                  router.push(
                    `/teacher/ai?topic=${encodeURIComponent(String(plan.topic ?? ""))}&count=${plan.count}&difficulty=${plan.difficulty}`,
                  )
                }
              >
                এআই জেনারেটরে নিন →
              </Button>
            ) : null}
          </>
        }
      >
        <p className="mb-2 text-sm text-slate-500">
          উদাহরণ: &quot;ক্লাস ১০ কম্পিউটার, HTML ফর্ম, মাঝারি, ৩০ প্রশ্ন&quot;
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[80px] w-full rounded-xl border border-[var(--pg-line)] p-3 text-sm"
        />
        {plan ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-bold">{String(plan.title)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Badge>প্রশ্ন: {String(plan.count)}</Badge>
              <Badge>ডিফিকাল্টি: {String(plan.difficulty)}</Badge>
              <Badge>টাইমার: {String(plan.timer)}s</Badge>
              <Badge>মার্কস: {String(plan.marks)}</Badge>
            </div>
            <ul className="mt-3 list-disc pl-5 text-xs text-slate-600">
              {(plan.notes as string[]).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] font-semibold text-amber-700">
              ⚠️ প্রকাশের আগে অবশ্যই রিভিউ করুন।
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={liveOpen}
        onClose={() => setLiveOpen(false)}
        title="লাইভ কুইজ শুরু করুন"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLiveOpen(false)}>
              বাতিল
            </Button>
            <Button onClick={startLive}>পিন তৈরি করুন</Button>
          </>
        }
      >
        <Select value={chosen} onChange={(e) => setChosen(e.target.value)}>
          <option value="">কুইজ বাছাই করুন…</option>
          {quizList.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title} ({q.questionCount} প্রশ্ন)
            </option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}
