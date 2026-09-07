"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Select,
  Skeleton,
  Table,
  Tabs,
  cx,
} from "@/components/ui";

type Row = {
  userId: number;
  name: string;
  avatar: string;
  className: string;
  xp: number;
  level: string;
  totalScore: number;
  avgScore: number;
  accuracy: number;
  quizzes: number;
  bestScore: number;
  wins: number;
  podiums: number;
  rank: number;
  value: number;
};

type Board = {
  rows: Row[];
  me: Row | null;
  totalRanked: number;
  classes: { classId: number | null; name: string; students: number; accuracy: number; totalScore: number }[];
};

const METRICS = [
  { id: "score", label: "মোট স্কোর", icon: "🏆", unit: "" },
  { id: "average", label: "গড় স্কোর", icon: "📊", unit: "" },
  { id: "accuracy", label: "নির্ভুলতা", icon: "🎯", unit: "%" },
  { id: "wins", label: "প্রথম স্থান", icon: "🥇", unit: "বার" },
  { id: "xp", label: "XP", icon: "⚡", unit: "" },
  { id: "active", label: "সবচেয়ে সক্রিয়", icon: "🔥", unit: "কুইজ" },
];

const PERIODS = [
  { id: "all", label: "সর্বকালের" },
  { id: "month", label: "এই মাস" },
  { id: "week", label: "এই সপ্তাহ" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [metric, setMetric] = useState("score");
  const [period, setPeriod] = useState("all");
  const [scope, setScope] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/leaderboard?metric=${metric}&period=${period}&scope=${scope}`);
    if (res.ok) setBoard(await res.json());
    setLoading(false);
  }, [metric, period, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const m = METRICS.find((x) => x.id === metric) ?? METRICS[0];
  const top3 = board?.rows.slice(0, 3) ?? [];

  return (
    <div className="space-y-4">
      <SectionTitle
        title="🏆 লিডারবোর্ড"
        subtitle="কে কত পেল — সর্বকালের ও সাম্প্রতিক র‍্যাংকিং"
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto">
              {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
            <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-auto">
              <option value="all">পুরো স্কুল</option>
              <option value="class">আমার শ্রেণি</option>
            </Select>
          </div>
        }
      />

      <Tabs
        tabs={METRICS.map((x) => ({ id: x.id, label: x.label, icon: x.icon }))}
        active={metric}
        onChange={setMetric}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !board?.rows.length ? (
        <EmptyState
          icon="🏆"
          title="এখনো কোনো ফলাফল নেই"
          description="শিক্ষার্থীরা কুইজ বা পরীক্ষা দিলে র‍্যাংকিং এখানে দেখা যাবে।"
        />
      ) : (
        <>
          {/* Podium */}
          {top3.length >= 3 ? (
            <Card className="pg-hero-bg text-white">
              <div className="flex items-end justify-center gap-3 sm:gap-6">
                {[1, 0, 2].map((idx) => {
                  const r = top3[idx];
                  if (!r) return null;
                  const height = idx === 0 ? "h-28" : idx === 1 ? "h-20" : "h-16";
                  return (
                    <div key={r.userId} className="flex flex-1 flex-col items-center">
                      <span className="text-3xl sm:text-4xl">{r.avatar}</span>
                      <p className="mt-1 max-w-[9rem] truncate text-center text-xs font-bold sm:text-sm">
                        {r.name}
                      </p>
                      <p className="text-[10px] text-white/60">{r.className}</p>
                      <div
                        className={cx(
                          "anim-fade mt-2 flex w-full flex-col items-center justify-center rounded-t-xl",
                          height,
                          idx === 0 ? "bg-[var(--pg-gold)] text-[#3b2a06]" : "bg-white/15",
                        )}
                        style={{ animationDelay: `${idx * 120}ms` }}
                      >
                        <span className="text-2xl">{MEDALS[idx]}</span>
                        <span className="text-lg font-black tabular-nums">
                          {r.value}{m.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-xs text-white/60">
                {m.icon} {m.label} অনুযায়ী · {board.totalRanked} জন শিক্ষার্থী
              </p>
            </Card>
          ) : null}

          {/* My position */}
          {board.me ? (
            <Card className="border-teal-300 bg-teal-50">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-2xl">
                  {board.me.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">আপনার অবস্থান</p>
                  <p className="text-xs text-slate-600">
                    {board.me.quizzes}টি কুইজ · নির্ভুলতা {board.me.accuracy}% · ⚡{board.me.xp} XP
                  </p>
                </div>
                <Badge tone="teal">
                  #{board.me.rank} / {board.totalRanked}
                </Badge>
                <span className="text-xl font-black tabular-nums text-[var(--pg-deep)]">
                  {board.me.value}{m.unit}
                </span>
              </div>
            </Card>
          ) : null}

          {/* Full table */}
          <Card padded={false}>
            <Table head={["#", "শিক্ষার্থী", "শ্রেণি", m.label, "কুইজ", "নির্ভুলতা", "🥇"]}>
              {board.rows.map((r) => (
                <tr
                  key={r.userId}
                  className={cx(board.me?.userId === r.userId && "bg-teal-50 font-semibold")}
                >
                  <td className="px-3 py-2.5">
                    {r.rank <= 3 ? (
                      <span className="text-lg">{MEDALS[r.rank - 1]}</span>
                    ) : (
                      <span className="tabular-nums text-slate-400">{r.rank}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{r.avatar}</span>
                      <span className="truncate">{r.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.className}</td>
                  <td className="px-3 py-2.5 font-black tabular-nums text-[var(--pg-deep)]">
                    {r.value}{m.unit}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">{r.quizzes}</td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">{r.accuracy}%</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.wins || "—"}</td>
                </tr>
              ))}
            </Table>
          </Card>

          {/* Class ranking */}
          {board.classes.length ? (
            <Card>
              <SectionTitle title="🏫 সেরা শ্রেণি" subtitle="গড় নির্ভুলতা অনুযায়ী" />
              <div className="space-y-2">
                {board.classes.map((c, i) => (
                  <div
                    key={`${c.classId}-${c.name}`}
                    className="flex items-center gap-3 rounded-xl border border-[var(--pg-line)] px-3 py-2.5"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-sm font-black">
                      {i < 3 ? MEDALS[i] : i + 1}
                    </span>
                    <span className="flex-1 font-semibold">{c.name}</span>
                    <span className="text-xs text-slate-500">{c.students} জন</span>
                    <span className="w-28">
                      <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-[var(--pg-teal)] transition-all duration-700"
                          style={{ width: `${c.accuracy}%` }}
                        />
                      </span>
                    </span>
                    <span className="w-12 text-right font-bold tabular-nums">{c.accuracy}%</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Button
            variant="outline"
            onClick={() => window.open(`/api/reports?type=class&format=csv`, "_blank")}
          >
            ⬇️ শ্রেণি রিপোর্ট CSV
          </Button>
        </>
      )}
    </div>
  );
}
