"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart, Badge, Button, Card, EmptyState, SectionTitle, Select, StatCard, Table } from "@/components/ui";

type Child = { id: number; name: string; xp: number; level: string };
type Result = { id: number; title: string; score: number; accuracy: number; rank: number; createdAt: string; breakdown: Record<string, number> };

export default function ParentPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  const load = useCallback(async (id?: number) => {
    const res = await fetch(`/api/analytics?scope=parent${id ? `&studentId=${id}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      setChildren(data.children ?? []);
      setChildId(data.childId ?? null);
      setResults(data.results ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.accuracy, 0) / results.length) : 0;
  const subjectTotals: Record<string, { sum: number; n: number }> = {};
  for (const r of results)
    for (const [k, v] of Object.entries(r.breakdown ?? {})) {
      subjectTotals[k] = subjectTotals[k] ?? { sum: 0, n: 0 };
      subjectTotals[k].sum += Number(v);
      subjectTotals[k].n += 1;
    }
  const subjectData = Object.entries(subjectTotals).map(([k, v]) => ({ label: k, value: Math.round(v.sum / v.n) }));
  const child = children.find((c) => c.id === childId);

  return (
    <div className="space-y-4">
      <SectionTitle
        title="👨‍👩‍👧 সন্তানের অগ্রগতি"
        subtitle="ফলাফল, নির্ভুলতা ও বিষয়ভিত্তিক পারফরম্যান্স"
        action={
          children.length > 1 ? (
            <Select value={childId ?? ""} onChange={(e) => load(Number(e.target.value))} className="w-auto">
              {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          ) : null
        }
      />

      {children.length === 0 ? (
        <EmptyState
          icon="👨‍👩‍👧"
          title="কোনো সন্তান যুক্ত নেই"
          description="অ্যাডমিনের সাথে যোগাযোগ করে আপনার সন্তানের অ্যাকাউন্ট যুক্ত করুন।"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="শিক্ষার্থী" value={child?.name ?? "—"} icon="🎒" />
            <StatCard label="গড় নির্ভুলতা" value={`${avg}%`} icon="🎯" tone="gold" />
            <StatCard label="মোট ফলাফল" value={results.length} icon="📄" tone="blue" />
            <StatCard label="XP / লেভেল" value={`${child?.xp ?? 0}`} sub={child?.level} icon="⚡" tone="coral" />
          </div>

          <Card>
            <SectionTitle title="বিষয়ভিত্তিক পারফরম্যান্স" />
            {subjectData.length ? <BarChart data={subjectData} /> : <p className="text-sm text-slate-400">ডেটা নেই</p>}
          </Card>

          <Card padded={false}>
            <Table head={["কুইজ", "স্কোর", "নির্ভুলতা", "র‍্যাংক", "তারিখ"]}>
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 font-semibold">{r.title}</td>
                  <td className="px-3 py-2.5 font-bold tabular-nums">{Math.round(r.score)}</td>
                  <td className="px-3 py-2.5">{Math.round(r.accuracy)}%</td>
                  <td className="px-3 py-2.5">{r.rank ? <Badge tone="gold">#{r.rank}</Badge> : "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString("bn-BD")}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Button variant="outline" onClick={() => window.open(`/api/reports?type=student&format=csv&id=${childId}`, "_blank")}>
            ⬇️ রিপোর্ট ডাউনলোড
          </Button>
        </>
      )}
    </div>
  );
}
