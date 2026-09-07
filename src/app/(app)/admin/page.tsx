"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart, Button, Card, SectionTitle, Skeleton, StatCard } from "@/components/ui";

type Data = {
  totals: { quizzes: number; exams: number; teachers: number; students: number; questions: number; sessions: number; averageScore: number };
  popularSubjects: { label: string; value: number }[];
  topClasses: { label: string; value: number }[];
  activeTeachers: { label: string; value: number }[];
};

export default function AdminDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/analytics?scope=admin").then(async (r) => r.ok && setData(await r.json()));
    fetch("/api/admin?scope=users").then(async (r) => r.ok && setPendingCount((await r.json()).pendingCount ?? 0));
  }, []);

  if (!data)
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="pg-hero-bg pg-shadow relative overflow-hidden rounded-2xl p-5 text-white">
        <div className="pg-grid-lines absolute inset-0 opacity-40" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest text-white/60">অ্যাডমিন কন্ট্রোল</p>
          <h1 className="mt-1 text-2xl font-extrabold">পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/structure"><Button variant="gold">একাডেমিক কাঠামো</Button></Link>
            <Link href="/admin/users"><Button variant="outline">ইউজার ম্যানেজমেন্ট</Button></Link>
            <Link href="/admin/settings"><Button variant="outline">ব্র্যান্ডিং</Button></Link>
          </div>
        </div>
      </div>

      {pendingCount > 0 ? (
        <Card className="border-amber-300 bg-amber-50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{pendingCount}টি নতুন অ্যাকাউন্ট অনুমোদনের অপেক্ষায়</p>
              <p className="text-xs text-slate-600">শিক্ষক ও শিক্ষার্থীরা অনুমোদন ছাড়া লগইন করতে পারবেন না।</p>
            </div>
            <Link href="/admin/users?tab=pending"><Button>এখনই দেখুন →</Button></Link>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট কুইজ" value={data.totals.quizzes} icon="📚" />
        <StatCard label="মোট পরীক্ষা" value={data.totals.exams} icon="📝" tone="blue" />
        <StatCard label="সক্রিয় শিক্ষক" value={data.totals.teachers} icon="👩‍🏫" tone="gold" />
        <StatCard label="সক্রিয় শিক্ষার্থী" value={data.totals.students} icon="🎒" tone="coral" />
        <StatCard label="প্রশ্ন ব্যাংক" value={data.totals.questions} icon="🗃️" />
        <StatCard label="লাইভ সেশন" value={data.totals.sessions} icon="📡" tone="blue" />
        <StatCard label="গড় পারফরম্যান্স" value={data.totals.averageScore} icon="📈" tone="gold" />
        <StatCard label="স্কুল" value="PGTSC" icon="🏫" tone="coral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle title="জনপ্রিয় বিষয়" />
          <BarChart data={data.popularSubjects} max={Math.max(...data.popularSubjects.map((s) => s.value), 10)} />
        </Card>
        <Card>
          <SectionTitle title="সেরা শ্রেণি" />
          <BarChart data={data.topClasses} />
        </Card>
        <Card>
          <SectionTitle title="সবচেয়ে সক্রিয় শিক্ষক" />
          <BarChart data={data.activeTeachers} max={Math.max(...data.activeTeachers.map((s) => s.value), 10)} />
        </Card>
      </div>

      <Card>
        <SectionTitle title="স্কুল রিপোর্ট এক্সপোর্ট" />
        <div className="flex flex-wrap gap-2">
          {[["school", "স্কুল রিপোর্ট"], ["class", "শ্রেণি রিপোর্ট"], ["subject", "বিষয় রিপোর্ট"], ["teacher", "শিক্ষক রিপোর্ট"]].map(([t, l]) => (
            <Button key={t} size="sm" variant="outline" onClick={() => window.open(`/api/reports?type=${t}&format=csv`, "_blank")}>
              ⬇️ {l}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
