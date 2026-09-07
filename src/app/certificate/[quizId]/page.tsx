"use client";

import { use, useEffect, useState } from "react";
import { Button, Select } from "@/components/ui";

type Row = { student: string; score: number; rank: number; accuracy: number; date: string; quiz: string };

export default function CertificatePage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = use(params);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("top3");

  useEffect(() => {
    fetch(`/api/reports?type=certificate&id=${quizId}`).then(async (r) => {
      if (r.ok) setRows((await r.json()).rows);
    });
  }, [quizId]);

  const list =
    filter === "winner" ? rows.slice(0, 1) : filter === "top3" ? rows.slice(0, 3) : filter === "top10" ? rows.slice(0, 10) : rows;

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center gap-2 print:hidden">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto">
          <option value="winner">বিজয়ী</option>
          <option value="top3">টপ ৩</option>
          <option value="top10">টপ ১০</option>
          <option value="all">অংশগ্রহণকারী সবাই</option>
        </Select>
        <Button onClick={() => window.print()}>🖨️ প্রিন্ট / PDF সংরক্ষণ</Button>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        {list.map((r, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-3xl border-8 border-double border-[var(--pg-gold)] bg-white p-10 text-center shadow-lg"
            style={{ breakInside: "avoid", pageBreakAfter: "always" }}
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--pg-deep)] text-xl font-black text-white">
              PG
            </div>
            <h1 className="mt-3 text-xl font-extrabold">পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Certificate of Achievement</p>
            <p className="mt-6 text-sm text-slate-600">এই মর্মে প্রত্যয়ন করা যাচ্ছে যে</p>
            <p className="mt-2 text-3xl font-black text-[var(--pg-deep)]">{r.student}</p>
            <p className="mt-3 text-sm text-slate-600">
              <b>{r.quiz}</b> কুইজে অংশগ্রহণ করে <b>{Math.round(r.score)}</b> স্কোর ও{" "}
              <b>{Math.round(r.accuracy)}%</b> নির্ভুলতা অর্জন করেছে এবং{" "}
              <b>{r.rank || i + 1}</b> নম্বর স্থান লাভ করেছে।
            </p>
            <p className="mt-2 text-4xl">{i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎖️"}</p>
            <div className="mt-10 flex justify-between text-xs text-slate-500">
              <div>
                <div className="w-40 border-t border-slate-400 pt-1">তারিখ</div>
                <p>{new Date(r.date).toLocaleDateString("bn-BD")}</p>
              </div>
              <div>
                <div className="w-40 border-t border-slate-400 pt-1">অধ্যক্ষ / শিক্ষক স্বাক্ষর</div>
              </div>
            </div>
          </div>
        ))}
        {!list.length ? (
          <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">
            এই কুইজের কোনো ফলাফল পাওয়া যায়নি।
          </p>
        ) : null}
      </div>
    </div>
  );
}
