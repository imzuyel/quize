"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Badge,
  Button,
  Card,
  DonutChart,
  EmptyState,
  SectionTitle,
  Select,
  Skeleton,
  StatCard,
  Table,
  Tabs,
  cx,
  useToast,
} from "@/components/ui";
import { VERDICT_META } from "@/lib/psychometrics";

type Analytics = {
  totals: { quizzes: number; results: number; averageScore: number; accuracy: number; participation: number; avgResponseMs: number };
  hardestQuestions: { id: number; text: string; accuracy: number; attempts: number; avgMs: number }[];
  subjectPerformance: { label: string; value: number }[];
  insights: string[];
  recentResults: { playerName: string; score: number; accuracy: number }[];
  quizzes: { id: number; title: string }[];
};

type ItemStat = {
  questionId: number;
  text: string;
  attempts: number;
  correct: number;
  pValue: number;
  discrimination: number;
  pointBiserial: number;
  verdict: keyof typeof VERDICT_META;
  advice: string;
  options: string[];
  distractors: { choice: number; count: number; share: number; isCorrect: boolean }[];
};

type ItemReport = {
  quiz: { id: number; title: string };
  learners: number;
  totalResponses: number;
  reliability: { alpha: number; label: string } | null;
  items: ItemStat[];
  summary: Record<string, number>;
};

function TeacherAnalyticsInner() {
  const params = useSearchParams();
  const { push } = useToast();
  const [tab, setTab] = useState(params.get("tab") ?? "overview");
  const [data, setData] = useState<Analytics | null>(null);
  const [feedback, setFeedback] = useState<{ id: number; overall: number; difficulty: number; timerRating: number; quality: number; engagement: number; comment: string | null; playerName: string | null }[]>([]);
  const [reports, setReports] = useState<{ id: number; questionText: string | null; reason: string; detail: string | null; status: string; reporterName: string | null }[]>([]);
  const [summary, setSummary] = useState<{ rating: number; liked: string[]; disliked: string[]; recommendations: string[] } | null>(null);
  const [quizId, setQuizId] = useState("");
  const [items, setItems] = useState<ItemReport | null>(null);
  const [itemQuiz, setItemQuiz] = useState("");
  const [itemBusy, setItemBusy] = useState(false);
  const [scores, setScores] = useState<{ quiz: { title: string } | null; rows: { rank: number; playerName: string; avatar: string; className: string; score: number; accuracy: number; correctCount: number; totalQuestions: number }[] } | null>(null);
  const [scoreQuiz, setScoreQuiz] = useState("");
  const [scoreBusy, setScoreBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/analytics?scope=teacher");
    if (res.ok) setData(await res.json());
    const f = await fetch("/api/feedback");
    if (f.ok) {
      const j = await f.json();
      setFeedback(j.feedback);
      setReports(j.reports);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const analyse = async () => {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "feedbackAnalysis", items: feedback }),
    });
    if (res.ok) setSummary(await res.json());
  };

  const download = (type: string) =>
    window.open(`/api/reports?type=${type}&format=csv${quizId ? `&id=${quizId}` : ""}`, "_blank");

  if (!data)
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );

  return (
    <div className="space-y-4">
      <SectionTitle title="📈 অ্যানালিটিক্স ও রিপোর্ট" subtitle="পারফরম্যান্স, ফিডব্যাক, রিপোর্ট ও সার্টিফিকেট" />
      <Tabs
        tabs={[
          { id: "overview", label: "ওভারভিউ", icon: "📊" },
          { id: "feedback", label: `ফিডব্যাক (${feedback.length})`, icon: "💬" },
          { id: "reports", label: `প্রশ্ন রিপোর্ট (${reports.filter((r) => r.status === "open").length})`, icon: "⚠️" },
          { id: "scores", label: "কে কত পেল", icon: "🥇" },
          { id: "items", label: "প্রশ্নের মান", icon: "🔬" },
          { id: "export", label: "রিপোর্ট ও সার্টিফিকেট", icon: "📄" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="গড় স্কোর" value={data.totals.averageScore} icon="🎯" />
            <StatCard label="নির্ভুলতা" value={`${data.totals.accuracy}%`} icon="✅" tone="gold" />
            <StatCard label="অংশগ্রহণ" value={`${data.totals.participation}%`} icon="👥" tone="blue" />
            <StatCard label="গড় উত্তর সময়" value={`${Math.round(data.totals.avgResponseMs / 1000)}s`} icon="⏱️" tone="coral" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SectionTitle title="বিষয়ভিত্তিক পারফরম্যান্স" />
              <BarChart data={data.subjectPerformance} />
            </Card>
            <Card className="flex flex-col items-center justify-center">
              <DonutChart value={data.totals.accuracy} label="সামগ্রিক নির্ভুলতা" />
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle title="সবচেয়ে কঠিন প্রশ্ন" subtitle="সবচেয়ে বেশি ভুল হওয়া প্রশ্ন" />
              {data.hardestQuestions.length === 0 ? (
                <EmptyState title="ডেটা নেই" />
              ) : (
                <Table head={["প্রশ্ন", "নির্ভুলতা", "চেষ্টা"]}>
                  {data.hardestQuestions.map((h) => (
                    <tr key={h.id}>
                      <td className="max-w-xs px-3 py-2 text-xs">{h.text.slice(0, 80)}</td>
                      <td className="px-3 py-2 font-bold">{h.accuracy}%</td>
                      <td className="px-3 py-2">{h.attempts}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
            <Card>
              <SectionTitle title="🤖 এআই শিক্ষণ পরামর্শ" />
              <ul className="space-y-2 text-sm">
                {data.insights.map((i, idx) => (
                  <li key={idx} className="rounded-xl bg-slate-50 p-3">{i}</li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      ) : null}

      {tab === "feedback" ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={analyse}>🤖 এআই ফিডব্যাক বিশ্লেষণ</Button>
              {summary ? <Badge tone="teal">গড় রেটিং {summary.rating}</Badge> : null}
            </div>
            {summary ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs font-bold text-emerald-800">যা পছন্দ করেছে</p>
                  <ul className="mt-1 list-disc pl-4 text-xs">{summary.liked.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-xs font-bold text-rose-800">যা পছন্দ করেনি</p>
                  <ul className="mt-1 list-disc pl-4 text-xs">{summary.disliked.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800">এআই সুপারিশ</p>
                  <ul className="mt-1 list-disc pl-4 text-xs">{summary.recommendations.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
              </div>
            ) : null}
          </Card>
          {feedback.length === 0 ? (
            <EmptyState icon="💬" title="কোনো ফিডব্যাক নেই" />
          ) : (
            <Card padded={false}>
              <Table head={["শিক্ষার্থী", "সামগ্রিক", "কঠিনতা", "সময়", "মান", "মন্তব্য"]}>
                {feedback.slice(0, 60).map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2">{f.playerName}</td>
                    <td className="px-3 py-2">{"⭐".repeat(f.overall)}</td>
                    <td className="px-3 py-2">{f.difficulty}/5</td>
                    <td className="px-3 py-2">{f.timerRating}/5</td>
                    <td className="px-3 py-2">{f.quality}/5</td>
                    <td className="px-3 py-2 text-xs">{f.comment}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "reports" ? (
        reports.length === 0 ? (
          <EmptyState icon="⚠️" title="কোনো রিপোর্ট নেই" />
        ) : (
          <Card padded={false}>
            <Table head={["প্রশ্ন", "কারণ", "বিস্তারিত", "স্ট্যাটাস", ""]}>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-xs px-3 py-2 text-xs">{r.questionText?.slice(0, 70)}</td>
                  <td className="px-3 py-2"><Badge tone="coral">{r.reason}</Badge></td>
                  <td className="px-3 py-2 text-xs">{r.detail}</td>
                  <td className="px-3 py-2"><Badge tone={r.status === "open" ? "gold" : "green"}>{r.status}</Badge></td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await fetch("/api/feedback", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ op: "resolveReport", id: r.id, status: "resolved" }),
                        });
                        push("সমাধান হিসেবে চিহ্নিত", "success");
                        load();
                      }}
                    >
                      সমাধান
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        )
      ) : null}

      {tab === "scores" ? (
        <div className="space-y-4">
          <Card>
            <SectionTitle title="🥇 কুইজভিত্তিক ফলাফল" subtitle="কোন শিক্ষার্থী কত নম্বর পেল" />
            <div className="flex flex-wrap gap-2">
              <Select value={scoreQuiz} onChange={(e) => setScoreQuiz(e.target.value)} className="max-w-xs">
                <option value="">কুইজ বাছাই করুন…</option>
                {data.quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </Select>
              <Button
                loading={scoreBusy}
                disabled={!scoreQuiz}
                onClick={async () => {
                  setScoreBusy(true);
                  const r = await fetch("/api/leaderboard", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ quizId: Number(scoreQuiz) }),
                  });
                  setScoreBusy(false);
                  if (r.ok) setScores(await r.json());
                  else push("ফলাফল আনা যায়নি", "error");
                }}
              >
                ফলাফল দেখুন
              </Button>
              <a href="/leaderboard">
                <Button variant="outline">🏆 সার্বিক লিডারবোর্ড →</Button>
              </a>
            </div>
          </Card>

          {scores ? (
            scores.rows.length === 0 ? (
              <EmptyState icon="🥇" title="এই কুইজের কোনো ফলাফল নেই" />
            ) : (
              <Card padded={false}>
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <b className="text-sm">{scores.quiz?.title}</b>
                  <Badge tone="teal">{scores.rows.length} জন</Badge>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/api/reports?type=quiz&id=${scoreQuiz}&format=csv`, "_blank")}
                  >
                    ⬇️ CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/certificate/${scoreQuiz}`, "_blank")}
                  >
                    🏅 সার্টিফিকেট
                  </Button>
                </div>
                <Table head={["#", "শিক্ষার্থী", "শ্রেণি", "স্কোর", "সঠিক", "নির্ভুলতা"]}>
                  {scores.rows.map((r) => (
                    <tr key={`${r.rank}-${r.playerName}`}>
                      <td className="px-3 py-2.5">
                        {r.rank <= 3 ? (
                          <span className="text-lg">{["🥇", "🥈", "🥉"][r.rank - 1]}</span>
                        ) : (
                          <span className="tabular-nums text-slate-400">{r.rank}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span>{r.avatar}</span>
                          <span className="truncate font-semibold">{r.playerName}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{r.className}</td>
                      <td className="px-3 py-2.5 font-black tabular-nums text-[var(--pg-deep)]">{r.score}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-500">
                        {r.correctCount}/{r.totalQuestions}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.accuracy}%</td>
                    </tr>
                  ))}
                </Table>
              </Card>
            )
          ) : null}
        </div>
      ) : null}

      {tab === "items" ? (
        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="🔬 আইটেম অ্যানালাইসিস"
              subtitle="প্রতিটি প্রশ্ন আসলে ভালো-দুর্বল শিক্ষার্থী আলাদা করতে পারছে কিনা"
            />
            <div className="flex flex-wrap gap-2">
              <Select value={itemQuiz} onChange={(e) => setItemQuiz(e.target.value)} className="max-w-xs">
                <option value="">কুইজ বাছাই করুন…</option>
                {data.quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </Select>
              <Button
                loading={itemBusy}
                disabled={!itemQuiz}
                onClick={async () => {
                  setItemBusy(true);
                  const r = await fetch(`/api/analytics/items?quizId=${itemQuiz}`);
                  setItemBusy(false);
                  if (r.ok) setItems(await r.json());
                  else push("বিশ্লেষণ করা যায়নি", "error");
                }}
              >
                বিশ্লেষণ করুন
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              <b>p-মান</b> = কত শতাংশ পেরেছে · <b>D</b> = পার্থক্যকরণ ক্ষমতা (উপরের ২৭% বনাম নিচের ২৭%)
            </p>
          </Card>

          {items ? (
            items.items.length === 0 ? (
              <EmptyState icon="🔬" title="এখনো যথেষ্ট উত্তর নেই" description="কিছু শিক্ষার্থী কুইজটি দিলে বিশ্লেষণ দেখা যাবে।" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label="অংশগ্রহণকারী" value={items.learners} icon="👥" />
                  <StatCard label="মোট উত্তর" value={items.totalResponses} icon="✍️" tone="blue" />
                  <StatCard
                    label="নির্ভরযোগ্যতা (α)"
                    value={items.reliability?.alpha ?? 0}
                    sub={items.reliability?.label}
                    icon="🎯"
                    tone="gold"
                  />
                  <StatCard
                    label="সমস্যাযুক্ত প্রশ্ন"
                    value={(items.summary.poor ?? 0) + (items.summary.review ?? 0)}
                    sub="পর্যালোচনা দরকার"
                    icon="⚠️"
                    tone="coral"
                  />
                </div>

                <Card>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {Object.entries(VERDICT_META).map(([k, m]) => (
                      items.summary[k] ? (
                        <Badge key={k} tone={m.tone as "green"}>
                          {m.icon} {m.label}: {items.summary[k]}
                        </Badge>
                      ) : null
                    ))}
                  </div>

                  <div className="space-y-2">
                    {items.items.map((it, idx) => {
                      const m = VERDICT_META[it.verdict];
                      return (
                        <div key={it.questionId} className="rounded-xl border border-[var(--pg-line)] p-3">
                          <div className="flex flex-wrap items-start gap-2">
                            <span className="text-lg">{m.icon}</span>
                            <p className="min-w-0 flex-1 text-sm font-semibold">
                              {idx + 1}. {it.text.slice(0, 90)}{it.text.length > 90 ? "…" : ""}
                            </p>
                            <Badge tone={m.tone as "green"}>{m.label}</Badge>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-slate-50 p-2">
                              <p className="text-lg font-black tabular-nums">
                                {Math.round(it.pValue * 100)}%
                              </p>
                              <p className="text-[10px] text-slate-500">সঠিক (p-মান)</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2">
                              <p
                                className={cx(
                                  "text-lg font-black tabular-nums",
                                  it.discrimination < 0.15 ? "text-rose-600" : it.discrimination >= 0.4 ? "text-emerald-600" : "",
                                )}
                              >
                                {it.discrimination.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-slate-500">পার্থক্যকরণ (D)</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2">
                              <p className="text-lg font-black tabular-nums">{it.attempts}</p>
                              <p className="text-[10px] text-slate-500">উত্তর সংখ্যা</p>
                            </div>
                          </div>

                          {it.options.length && it.distractors.length ? (
                            <div className="mt-2 space-y-1">
                              {it.options.map((opt, oi) => {
                                const d = it.distractors.find((x) => x.choice === oi);
                                const share = d?.share ?? 0;
                                const isCorrect = d?.isCorrect ?? false;
                                return (
                                  <div key={oi} className="flex items-center gap-2 text-xs">
                                    <span className="w-4 font-bold text-slate-400">
                                      {String.fromCharCode(65 + oi)}
                                    </span>
                                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                      <span
                                        className="block h-full rounded-full transition-all"
                                        style={{
                                          width: `${share * 100}%`,
                                          background: isCorrect ? "#10b981" : "#cbd5e1",
                                        }}
                                      />
                                    </span>
                                    <span className="w-24 truncate text-slate-500">{opt}</span>
                                    <span className="w-10 text-right tabular-nums">
                                      {Math.round(share * 100)}%
                                    </span>
                                    {isCorrect ? <span>✅</span> : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{it.advice}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )
          ) : null}
        </div>
      ) : null}

      {tab === "export" ? (
        <div className="space-y-4">
          <Card>
            <SectionTitle title="রিপোর্ট এক্সপোর্ট" subtitle="CSV/Excel ফরম্যাটে ডাউনলোড করুন" />
            <Select value={quizId} onChange={(e) => setQuizId(e.target.value)} className="mb-3">
              <option value="">সব কুইজ</option>
              {data.quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </Select>
            <div className="flex flex-wrap gap-2">
              {[
                ["student", "শিক্ষার্থী রিপোর্ট"],
                ["quiz", "কুইজ রিপোর্ট"],
                ["exam", "পরীক্ষার রিপোর্ট"],
                ["class", "শ্রেণি রিপোর্ট"],
                ["subject", "বিষয় রিপোর্ট"],
                ["teacher", "শিক্ষক রিপোর্ট"],
                ["school", "স্কুল রিপোর্ট"],
              ].map(([t, l]) => (
                <Button key={t} variant="outline" size="sm" onClick={() => download(t)}>⬇️ {l}</Button>
              ))}
            </div>
          </Card>
          <Card>
            <SectionTitle title="🏅 সার্টিফিকেট" subtitle="বিজয়ী, টপ ৩, টপ ১০ ও অংশগ্রহণ সার্টিফিকেট" />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (!quizId) return push("প্রথমে কুইজ নির্বাচন করুন", "error");
                  window.open(`/certificate/${quizId}`, "_blank");
                }}
              >
                সার্টিফিকেট তৈরি করুন
              </Button>
              <Button variant="outline" onClick={() => download("certificate")}>⬇️ তালিকা CSV</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function TeacherAnalytics() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>}>
      <TeacherAnalyticsInner />
    </Suspense>
  );
}
