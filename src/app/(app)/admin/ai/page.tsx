"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
  Skeleton,
  useToast,
  cx,
} from "@/components/ui";

type KeyRow = { id: string; masked: string; source: "admin" | "env" | "none" };
type Info = {
  configured: boolean;
  provider: string;
  model: string;
  note: string;
  chain: { id: string; model: string; label: string }[];
};

const META: Record<string, { label: string; hint: string; url: string; free: boolean }> = {
  gemini: {
    label: "Google Gemini",
    hint: "স্থায়ী ফ্রি টিয়ার · কার্ড লাগে না · বাংলা ভালো বোঝে",
    url: "https://aistudio.google.com/apikey",
    free: true,
  },
  groq: {
    label: "Groq",
    hint: "ফ্রি টিয়ার · খুব দ্রুত",
    url: "https://console.groq.com/keys",
    free: true,
  },
  openai: {
    label: "OpenAI",
    hint: "পেইড — ক্রেডিট লাগে",
    url: "https://platform.openai.com/api-keys",
    free: false,
  },
  anthropic: {
    label: "Anthropic Claude",
    hint: "পেইড — ক্রেডিট লাগে",
    url: "https://console.anthropic.com/settings/keys",
    free: false,
  },
};

export default function AiSettingsPage() {
  const { push } = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [preferred, setPreferred] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<Record<string, { ok: boolean; message: string; models?: string[] }>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ai");
    if (res.ok) {
      const d = await res.json();
      setInfo(d.provider);
      setKeys(d.keys);
      setPreferred(d.preferred ?? "");
      setModel(d.model ?? "");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      push(data.error ?? "ব্যর্থ", "error");
      return null;
    }
    return data;
  };

  const verify = async (id: string) => {
    setBusy(`v-${id}`);
    const d = await post({ op: "verify", provider: id, key: drafts[id] ?? "" });
    setBusy("");
    if (d) {
      setResult((r) => ({ ...r, [id]: d }));
      push(d.ok ? `✅ ${META[id].label} কাজ করছে` : `❌ ${d.message}`, d.ok ? "success" : "error");
    }
  };

  const saveKey = async (id: string) => {
    setBusy(`s-${id}`);
    const d = await post({ op: "save", [id]: drafts[id] ?? "" });
    setBusy("");
    if (d) {
      push(drafts[id] ? "কী সংরক্ষিত ✅" : "কী মুছে ফেলা হয়েছে", "success");
      setDrafts((x) => ({ ...x, [id]: "" }));
      setResult((r) => ({ ...r, [id]: { ok: true, message: "সংরক্ষিত" } }));
      load();
    }
  };

  if (!info)
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );

  return (
    <div className="space-y-4">
      <SectionTitle
        title="🔑 এআই কী ম্যানেজমেন্ট"
        subtitle="কী বদলান, যাচাই করুন — সার্ভার বা কোড না ছুঁয়ে"
      />

      <Card className={info.configured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={info.configured ? "green" : "gold"}>
            {info.configured ? "✨ সক্রিয়" : "কোনো কী নেই"}
          </Badge>
          {info.chain?.length ? (
            info.chain.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1.5">
                {i > 0 ? <span className="text-slate-400">→</span> : null}
                <span
                  className={cx(
                    "rounded-lg px-2 py-1 text-xs font-bold",
                    i === 0 ? "bg-emerald-600 text-white" : "bg-white text-slate-600",
                  )}
                >
                  {c.label}
                </span>
              </span>
            ))
          ) : null}
        </div>
        <p className="mt-1.5 text-xs text-slate-600">{info.note}</p>
        {info.configured ? (
          <p className="mt-1 text-xs text-slate-500">
            বর্তমান মডেল: <b>{info.model}</b>
          </p>
        ) : null}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {keys.map((k) => {
          const m = META[k.id];
          const r = result[k.id];
          return (
            <Card key={k.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{m.label}</p>
                {m.free ? <Badge tone="green">ফ্রি</Badge> : <Badge tone="slate">পেইড</Badge>}
                <div className="flex-1" />
                <Badge tone={k.source === "admin" ? "teal" : k.source === "env" ? "blue" : "coral"}>
                  {k.source === "admin" ? "এখানে সেট করা" : k.source === "env" ? "সার্ভার env" : "সেট করা নেই"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{m.hint}</p>

              {k.masked ? (
                <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs">
                  {k.masked}
                </p>
              ) : null}

              <Field label={k.masked ? "নতুন কী দিয়ে বদলান" : "কী বসান"}>
                <Input
                  type="password"
                  value={drafts[k.id] ?? ""}
                  onChange={(e) => setDrafts((x) => ({ ...x, [k.id]: e.target.value }))}
                  placeholder={k.id === "gemini" ? "AIza… বা AQ.…" : "কী পেস্ট করুন"}
                  autoComplete="off"
                />
              </Field>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  loading={busy === `s-${k.id}`}
                  disabled={!drafts[k.id]}
                  onClick={() => saveKey(k.id)}
                >
                  💾 সংরক্ষণ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === `v-${k.id}`}
                  onClick={() => verify(k.id)}
                >
                  🔍 যাচাই করুন
                </Button>
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost">কী নিন ↗</Button>
                </a>
                {k.source === "admin" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setDrafts((x) => ({ ...x, [k.id]: "" })); saveKey(k.id); }}
                  >
                    মুছুন
                  </Button>
                ) : null}
              </div>

              {r ? (
                <p
                  className={cx(
                    "mt-2 rounded-lg p-2 text-xs",
                    r.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800",
                  )}
                >
                  {r.ok ? "✅" : "❌"} {r.message}
                  {r.models?.length ? (
                    <span className="mt-1 block text-[11px] text-slate-500">
                      উপলব্ধ: {r.models.slice(0, 6).join(", ")}
                      {r.models.length > 6 ? " …" : ""}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card>
        <SectionTitle title="উন্নত সেটিংস" subtitle="সাধারণত বদলানোর দরকার নেই" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="কোন প্রোভাইডার আগে চেষ্টা হবে">
            <Select value={preferred} onChange={(e) => setPreferred(e.target.value)}>
              <option value="">স্বয়ংক্রিয় (Gemini → Groq → OpenAI)</option>
              {keys.map((k) => <option key={k.id} value={k.id}>{META[k.id].label}</option>)}
            </Select>
          </Field>
          <Field label="নির্দিষ্ট মডেল (ঐচ্ছিক)" hint="খালি রাখলে যাচাই করা ডিফল্ট ব্যবহার হবে">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-3.5-flash" />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            loading={busy === "adv"}
            onClick={async () => {
              setBusy("adv");
              const d = await post({ op: "save", preferred, model });
              setBusy("");
              if (d) { push("সংরক্ষিত ✅", "success"); load(); }
            }}
          >
            💾 সংরক্ষণ
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              if (!confirm("সব কী মুছে ফেলবেন? সার্ভারের env কী থাকলে সেটি আবার ব্যবহার হবে।")) return;
              await post({ op: "clear" });
              push("সব ওভাররাইড মুছে ফেলা হয়েছে", "success");
              load();
            }}
          >
            সব রিসেট
          </Button>
        </div>
      </Card>

      <Card className="bg-slate-50">
        <p className="text-xs font-bold uppercase text-slate-400">কীভাবে কাজ করে</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          <li>• এখানে সেট করা কী <b>সার্ভারের env কী-এর চেয়ে অগ্রাধিকার</b> পায়।</li>
          <li>• একাধিক কী দিলে একটি ব্যর্থ হলে পরেরটি স্বয়ংক্রিয়ভাবে ব্যবহার হয়।</li>
          <li>• সব ব্যর্থ হলে বিল্ট-ইন জেনারেটর চলে — প্ল্যাটফর্ম কখনো থামে না।</li>
          <li>• কী কখনো ব্রাউজারে ফেরত পাঠানো হয় না, শুধু মাস্ক করা প্রিভিউ দেখানো হয়।</li>
        </ul>
      </Card>
    </div>
  );
}
