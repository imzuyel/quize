"use client";

import { useEffect, useState } from "react";
import { BarChart, Badge, Button, Card, EmptyState, SectionTitle, Sparkline, StatCard, Table } from "@/components/ui";

type Data = {
  results: { id: number; title: string; score: number; accuracy: number; rank: number; createdAt: string }[];
  subjectPerformance: { label: string; value: number }[];
  trend: number[];
  rank: number;
  xp: number;
};

export default function ResultsPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/analytics?scope=student").then(async (r) => r.ok && setData(await r.json()));
  }, []);

  if (!data) return <p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>;

  const avg = data.results.length
    ? Math.round(data.results.reduce((s, r) => s + r.accuracy, 0) / data.results.length)
    : 0;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="📊 আমার ফলাফল"
        subtitle="সব কুইজ ও পরীক্ষার ফলাফল"
        action={
          <Button variant="outline" size="sm" onClick={() => window.open("/api/reports?type=student&format=csv", "_blank")}>
            ⬇️ CSV এক্সপোর্ট
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট ফলাফল" value={data.results.length} icon="📄" />
        <StatCard label="গড় নির্ভুলতা" value={`${avg}%`} icon="🎯" tone="gold" />
        <StatCard label="আমার র‍্যাংক" value={`#${data.rank}`} icon="🏅" tone="blue" />
        <StatCard label="মোট XP" value={data.xp} icon="⚡" tone="coral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="বিষয়ভিত্তিক স্কোর" />
          <BarChart data={data.subjectPerformance} />
        </Card>
        <Card>
          <SectionTitle title="অগ্রগতি ট্রেন্ড" />
          <Sparkline points={data.trend} />
          <p className="mt-2 text-xs text-slate-500">সাম্প্রতিক {data.trend.length}টি ফলাফলের নির্ভুলতা</p>
        </Card>
      </div>

      {data.results.length === 0 ? (
        <EmptyState icon="📊" title="এখনো কোনো ফলাফল নেই" description="একটি কুইজ বা পরীক্ষা দিন।" />
      ) : (
        <Card padded={false}>
          <Table head={["কুইজ", "স্কোর", "নির্ভুলতা", "র‍্যাংক", "তারিখ"]}>
            {data.results.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2.5 font-semibold">{r.title}</td>
                <td className="px-3 py-2.5 tabular-nums font-bold">{Math.round(r.score)}</td>
                <td className="px-3 py-2.5">{Math.round(r.accuracy)}%</td>
                <td className="px-3 py-2.5">{r.rank ? <Badge tone="gold">#{r.rank}</Badge> : "—"}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString("bn-BD")}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
