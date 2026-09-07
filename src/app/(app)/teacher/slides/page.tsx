"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  Skeleton,
  Textarea,
  useToast,
  cx,
} from "@/components/ui";
import { SlideView } from "@/components/slide-view";
import { SLIDE_THEMES, newSlide, type Slide } from "@/lib/slides";

type Deck = {
  id: number;
  title: string;
  description: string | null;
  theme: string;
  slides: Slide[];
  updatedAt: string;
};

export default function SlidesPage() {
  const router = useRouter();
  const { push } = useToast();
  const [rows, setRows] = useState<Deck[] | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(8);
  const [lang, setLang] = useState("bn");
  const [theme, setTheme] = useState("aurora");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/presentations");
    if (res.ok) setRows((await res.json()).rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/presentations", {
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

  const createBlank = async () => {
    const d = await post({
      op: "create",
      title: "নতুন উপস্থাপনা",
      theme,
      slides: [newSlide("title"), newSlide("bullets")],
    });
    if (d?.id) router.push(`/teacher/slides/${d.id}`);
  };

  const createAI = async () => {
    if (!topic.trim()) return push("বিষয় লিখুন", "error");
    setBusy(true);
    const d = await post({ op: "aiOutline", topic, audience, count, language: lang, theme });
    setBusy(false);
    if (d?.id) {
      push("উপস্থাপনা তৈরি হয়েছে ✅", "success");
      router.push(`/teacher/slides/${d.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="🎞️ প্রেজেন্টেশন স্টুডিও"
        subtitle="এআই দিয়ে স্লাইড বানান, সুন্দর থিম দিন, ক্লাসে দেখান বা PPTX ডাউনলোড করুন"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={createBlank}>+ খালি</Button>
            <Button variant="gold" onClick={() => setAiOpen(true)}>✨ এআই দিয়ে তৈরি</Button>
          </div>
        }
      />

      {!rows ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🎞️"
          title="কোনো উপস্থাপনা নেই"
          description="একটি বিষয় লিখে দিন — এআই পুরো স্লাইড আউটলাইন বানিয়ে দেবে।"
          action={<Button className="mt-3" variant="gold" onClick={() => setAiOpen(true)}>✨ এআই দিয়ে তৈরি করুন</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <Card key={d.id} padded={false} className="overflow-hidden">
              <Link href={`/teacher/slides/${d.id}`}>
                <div className="aspect-video w-full overflow-hidden">
                  {d.slides?.[0] ? (
                    <SlideView slide={d.slides[0]} themeId={d.theme} scale={0.34} animate={false} />
                  ) : (
                    <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-400">খালি</div>
                  )}
                </div>
              </Link>
              <div className="p-3">
                <p className="truncate font-bold">{d.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone="blue">{d.slides?.length ?? 0} স্লাইড</Badge>
                  <Badge tone="slate">{SLIDE_THEMES.find((t) => t.id === d.theme)?.name ?? d.theme}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Link href={`/teacher/slides/${d.id}`}>
                    <Button size="sm">সম্পাদনা</Button>
                  </Link>
                  <Link href={`/present/${d.id}`} target="_blank">
                    <Button size="sm" variant="outline">▶ দেখান</Button>
                  </Link>
                  <Button size="sm" variant="ghost"
                    onClick={() => window.open(`/api/presentations/export?id=${d.id}`, "_blank")}>
                    ⬇ PPTX
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "duplicate", id: d.id })}>কপি</Button>
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "delete", id: d.id })}>মুছুন</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title="✨ এআই দিয়ে উপস্থাপনা তৈরি"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setAiOpen(false)}>বাতিল</Button>
            <Button loading={busy} onClick={createAI} disabled={!topic.trim()}>
              {count} স্লাইড তৈরি করুন
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="বিষয়" required hint="যেমন: কম্পিউটার নেটওয়ার্ক · সালোকসংশ্লেষণ · ডিজিটাল বাংলাদেশ">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="উপস্থাপনার বিষয়" autoFocus />
          </Field>
          <Field label="কাদের জন্য? (ঐচ্ছিক)">
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="ক্লাস ৯ · শিক্ষক প্রশিক্ষণ · সেমিনার" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="স্লাইড সংখ্যা">
              <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="ভাষা">
              <Select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
                <option value="mixed">মিশ্র</option>
              </Select>
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">থিম</p>
            <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pg-scroll sm:grid-cols-5">
              {SLIDE_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cx(
                    "overflow-hidden rounded-xl border-2 text-left",
                    theme === t.id ? "border-[var(--pg-teal)]" : "border-[var(--pg-line)]",
                  )}
                >
                  <span className="block h-10" style={{ background: t.bg }} />
                  <span className="block truncate px-1.5 py-1 text-[10px] font-bold">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
          <Textarea readOnly className="text-xs text-slate-500"
            value="এআই স্লাইডের শিরোনাম, বুলেট, আইকন ও স্পিকার নোট তৈরি করবে। তৈরির পর সব সম্পাদনা করতে পারবেন।" />
        </div>
      </Modal>
    </div>
  );
}
