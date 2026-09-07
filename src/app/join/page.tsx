"use client";
// NOTE: metadata lives in the sibling layout because this is a client page.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Field, Input, useToast } from "@/components/ui";

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { push } = useToast();
  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [nickname, setNickname] = useState("");
  const [studentRef, setStudentRef] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pg_nickname");
    if (saved) setNickname(saved);
  }, []);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "join", pin: pin.trim(), nickname: nickname.trim(), studentRef }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "যোগ দেওয়া যায়নি");
      localStorage.setItem("pg_nickname", nickname.trim());
      localStorage.setItem(`pg_player_${pin.trim()}`, String(data.playerId));
      router.push(`/play/${pin.trim()}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "সমস্যা হয়েছে", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pg-hero-bg grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-4 flex items-center justify-center gap-2 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--pg-teal)] font-black">
            PG
          </span>
          <span className="font-extrabold">কুইজে যোগ দিন</span>
        </Link>
        <Card className="anim-zoom">
          <form onSubmit={join} className="space-y-4">
            <Field label="গেম পিন" required>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="৬ ডিজিটের পিন"
                className="text-center text-3xl font-black tracking-[0.35em]"
                required
              />
            </Field>
            <Field label="আপনার নাম / নিকনেম" required>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 28))}
                placeholder="যেমন: সাদিয়া"
                required
              />
            </Field>
            <Field label="স্টুডেন্ট আইডি / রোল (ঐচ্ছিক)">
              <Input value={studentRef} onChange={(e) => setStudentRef(e.target.value)} placeholder="PG-2025100" />
            </Field>
            <Button type="submit" block size="lg" loading={loading}>
              যোগ দিন →
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            শিক্ষক বা শিক্ষার্থী ড্যাশবোর্ড দরকার?{" "}
            <Link href="/" className="font-bold text-[var(--pg-teal)]">
              হোমে ফিরে যান
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="pg-hero-bg min-h-screen" />}>
      <JoinInner />
    </Suspense>
  );
}
