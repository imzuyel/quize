"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Select,
  Table,
  Textarea,
  useToast,
} from "@/components/ui";

type Quiz = {
  id: number;
  title: string;
  mode: string;
  status: string;
  questionCount: number;
  durationMinutes: number | null;
  createdAt: string;
};

function QuizzesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { push } = useToast();
  const [rows, setRows] = useState<Quiz[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(params.get("mode") ?? "live");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/quizzes?mine=1");
    if (res.ok) setRows((await res.json()).rows);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/structure").then(async (r) => r.ok && setClasses((await r.json()).classes));
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/quizzes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      push(data.error ?? "ব্যর্থ", "error");
      return null;
    }
    load();
    return data;
  };

  const create = async () => {
    const data = await post({
      op: "create",
      data: { title: title || "নতুন কুইজ", description, mode, durationMinutes: duration, classId: classId ? Number(classId) : null },
    });
    if (data?.id) router.push(`/teacher/quizzes/${data.id}`);
  };

  const startLive = async (quizId: number) => {
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", quizId }),
    });
    const data = await res.json();
    if (!res.ok) return push(data.error ?? "ব্যর্থ", "error");
    router.push(`/host/${data.pin}`);
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="🎛️ কুইজ স্টুডিও"
        subtitle="কুইজ, পরীক্ষা ও অনুশীলন সেট তৈরি ও পরিচালনা করুন"
        action={
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              id="quiz-import"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const bundle = JSON.parse(await f.text());
                  const d = await post({ op: "import", bundle });
                  if (d?.id) {
                    push(`${d.imported}টি প্রশ্নসহ আমদানি হয়েছে ✅`, "success");
                    router.push(`/teacher/quizzes/${d.id}`);
                  }
                } catch {
                  push("ফাইলটি পড়া যায়নি — বৈধ JSON দিন", "error");
                }
              }}
            />
            <Button variant="outline" onClick={() => document.getElementById("quiz-import")?.click()}>
              📥 আমদানি
            </Button>
            <Button onClick={() => setOpen(true)}>+ নতুন তৈরি করুন</Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="🎛️"
          title="কোনো কুইজ নেই"
          description="নতুন কুইজ তৈরি করুন অথবা এআই জেনারেটর দিয়ে প্রশ্ন বানিয়ে শুরু করুন।"
          action={<Button className="mt-3" onClick={() => setOpen(true)}>+ নতুন কুইজ</Button>}
        />
      ) : (
        <Card padded={false}>
          <Table head={["শিরোনাম", "ধরন", "প্রশ্ন", "স্ট্যাটাস", "অ্যাকশন"]}>
            {rows.map((q) => (
              <tr key={q.id}>
                <td className="px-3 py-2.5 font-semibold">{q.title}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={q.mode === "exam" ? "blue" : q.mode === "practice" ? "gold" : "teal"}>{q.mode}</Badge>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{q.questionCount}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={q.status === "published" ? "green" : "slate"}>{q.status}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <Link href={`/teacher/quizzes/${q.id}`}>
                      <Button size="sm" variant="outline">সম্পাদনা</Button>
                    </Link>
                    {q.mode === "live" ? (
                      <Button size="sm" onClick={() => startLive(q.id)}>লাইভ</Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const d = await post({ op: "export", id: q.id });
                        if (!d) return;
                        const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `${q.title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "quiz"}.json`;
                        a.click();
                        push("ফাইল ডাউনলোড হয়েছে", "success");
                      }}
                    >
                      ⬇ এক্সপোর্ট
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => post({ op: "duplicate", id: q.id })}>কপি</Button>
                    <Button size="sm" variant="ghost" onClick={() => post({ op: "delete", id: q.id })}>মুছুন</Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="নতুন কুইজ / পরীক্ষা"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={create}>তৈরি করুন</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="শিরোনাম" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: ক্লাস ১০ কম্পিউটার কুইজ" />
          </Field>
          <Field label="বিবরণ">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="ধরন">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="live">লাইভ কুইজ (গেম মোড)</option>
              <option value="exam">ফরমাল পরীক্ষা</option>
              <option value="practice">অনুশীলন সেট</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="সময়কাল (মিনিট)">
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </Field>
            <Field label="শ্রেণি">
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function QuizzesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">লোড হচ্ছে…</p>}>
      <QuizzesInner />
    </Suspense>
  );
}
