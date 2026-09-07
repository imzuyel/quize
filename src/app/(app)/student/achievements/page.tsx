"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Progress, SectionTitle, StatCard, cx } from "@/components/ui";

type Data = {
  achievements: { id: number; name: string; nameBn: string | null; icon: string; earnedAt: string }[];
  allAchievements: { id: number; name: string; nameBn: string | null; icon: string; description: string | null; xp: number }[];
  xp: number;
  rank: number;
};

const LEVELS = [
  { bn: "শিক্ষানবিশ", min: 0 },
  { bn: "শিক্ষার্থী", min: 300 },
  { bn: "দক্ষ", min: 800 },
  { bn: "বিশেষজ্ঞ", min: 1600 },
  { bn: "মাস্টার", min: 3000 },
];

export default function AchievementsPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/analytics?scope=student").then(async (r) => r.ok && setData(await r.json()));
  }, []);

  if (!data) return <p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>;

  const earnedIds = new Set(data.achievements.map((a) => a.id));
  const level = [...LEVELS].reverse().find((l) => data.xp >= l.min) ?? LEVELS[0];
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  const progress = next ? ((data.xp - level.min) / (next.min - level.min)) * 100 : 100;

  return (
    <div className="space-y-4">
      <SectionTitle title="🏅 আমার অর্জন" subtitle="ব্যাজ, XP ও লেভেল" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="অর্জিত ব্যাজ" value={data.achievements.length} icon="🏆" />
        <StatCard label="মোট XP" value={data.xp} icon="⚡" tone="gold" />
        <StatCard label="লেভেল" value={level.bn} icon="🎖️" tone="blue" />
        <StatCard label="র‍্যাংক" value={`#${data.rank}`} icon="📈" tone="coral" />
      </div>

      <Card>
        <p className="mb-2 text-sm font-bold">
          পরবর্তী লেভেল: {next ? next.bn : "সর্বোচ্চ অর্জিত!"} {next ? `(${next.min} XP)` : ""}
        </p>
        <Progress value={progress} tone="gold" />
        <p className="mt-1 text-xs text-slate-500">
          XP শুধুমাত্র অনুপ্রেরণার জন্য — এটি কখনোই ফরমাল পরীক্ষার নম্বরে প্রভাব ফেলে না।
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.allAchievements.map((a) => {
          const earned = earnedIds.has(a.id);
          return (
            <Card key={a.id} className={cx(!earned && "opacity-60", earned && "anim-pop border-amber-300")}>
              <div className="flex items-start gap-3">
                <div className={cx("grid h-12 w-12 place-items-center rounded-xl text-2xl", earned ? "bg-amber-100" : "bg-slate-100 grayscale")}>
                  {a.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{a.nameBn || a.name}</p>
                  <p className="text-xs text-slate-500">{a.description}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge tone={earned ? "green" : "slate"}>{earned ? "✅ অর্জিত" : "🔒 লক"}</Badge>
                    <Badge tone="gold">+{a.xp} XP</Badge>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
