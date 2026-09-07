"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input, Select, useToast } from "@/components/ui";

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [pendingMsg, setPendingMsg] = useState("");

  const go = (r: string) =>
    router.push(
      r === "teacher"
        ? "/teacher"
        : r === "admin" || r === "super_admin"
          ? "/admin"
          : r === "parent"
            ? "/parent"
            : "/student",
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { action: "login", identifier, password }
            : { action: "register", email: identifier, password, name, role },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "লগইন ব্যর্থ");
      if (data.pending) {
        setPendingMsg(data.message ?? "আবেদন জমা হয়েছে — অনুমোদনের অপেক্ষায়।");
        setMode("login");
        setPassword("");
        push("আবেদন জমা হয়েছে ✅", "success");
        return;
      }
      push("স্বাগতম!", "success");
      go(data.role);
      router.refresh();
    } catch (err) {
      push(err instanceof Error ? err.message : "সমস্যা হয়েছে", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="anim-zoom">
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold ${
              mode === m ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            {m === "login" ? "লগইন" : "নিবন্ধন"}
          </button>
        ))}
      </div>

      {pendingMsg ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-bold">⏳ অনুমোদনের অপেক্ষায়</p>
          <p className="mt-1 text-xs">{pendingMsg}</p>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-3">
        {mode === "register" ? (
          <>
            <Field label="পূর্ণ নাম" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field
              label="ভূমিকা"
              hint="শিক্ষক হিসেবে নিবন্ধন করলে অ্যাডমিন অনুমোদনের পর অ্যাকাউন্ট সক্রিয় হবে"
            >
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="student">শিক্ষার্থী</option>
                <option value="teacher">শিক্ষক</option>
                <option value="parent">অভিভাবক</option>
              </Select>
            </Field>
          </>
        ) : null}
        <Field label={mode === "login" ? "ইমেইল অথবা স্টুডেন্ট আইডি" : "ইমেইল"} required>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@pgtsc.edu.bd / PG-2025100"
            autoComplete="username"
            required
          />
        </Field>
        <Field label="পাসওয়ার্ড" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </Field>
        <Button type="submit" block size="lg" loading={loading}>
          {mode === "login" ? "লগইন করুন" : "অ্যাকাউন্ট তৈরি করুন"}
        </Button>
      </form>

      {demoMode ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-2.5 text-center text-xs text-amber-800">
          ⚠️ ডেমো মোড চালু — যে কেউ লগইন ছাড়াই প্রবেশ করতে পারে।
          <br />
          লাইভ করার আগে <code className="font-bold">DEMO_MODE=false</code> সেট করুন।
        </p>
      ) : null}

      <p className="mt-4 text-center text-xs text-slate-500">
        অ্যাকাউন্ট ছাড়াই লাইভ কুইজে যোগ দিতে চান?{" "}
        <Link href="/join" className="font-bold text-[var(--pg-teal)]">
          গেম পিন দিন
        </Link>
      </p>
    </Card>
  );
}
