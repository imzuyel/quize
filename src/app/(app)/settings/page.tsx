"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Tabs,
  Toggle,
  useToast,
  cx,
} from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_TEACHER,
  NOTIFICATION_LABELS,
  type NotificationPrefs,
  type TeacherDefaults,
} from "@/lib/prefs";

type Profile = {
  id: number;
  name: string;
  nameBn: string | null;
  email: string;
  studentId: string | null;
  roll: string | null;
  role: string;
  avatar: string | null;
  locale: string;
  motionLevel: string;
  xp: number;
  level: string;
  createdAt: string;
  notifications: NotificationPrefs;
  teacherDefaults: TeacherDefaults;
};

const AVATARS = ["🙂", "😎", "🦉", "🐬", "🦊", "🐼", "🦁", "🐧", "🌟", "🚀", "📚", "🎯", "⚡", "🌿", "🎓", "🧑‍🏫"];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "সুপার অ্যাডমিন",
  admin: "অ্যাডমিন",
  teacher: "শিক্ষক",
  student: "শিক্ষার্থী",
  parent: "অভিভাবক",
};

export default function SettingsPage() {
  const router = useRouter();
  const { push } = useToast();
  const { locale, setLocale, motion, setMotion, highContrast, setHighContrast } = useI18n();

  const [tab, setTab] = useState("profile");
  const [p, setP] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState("");

  const [notif, setNotif] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS);
  const [tDef, setTDef] = useState<TeacherDefaults>(DEFAULT_TEACHER);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.ok) {
      const d: Profile = await res.json();
      setP(d);
      setName(d.name ?? "");
      setNameBn(d.nameBn ?? "");
      setAvatar(d.avatar ?? "");
      setNotif(d.notifications ?? DEFAULT_NOTIFICATIONS);
      setTDef(d.teacherDefaults ?? DEFAULT_TEACHER);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/profile", {
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

  const saveProfile = async () => {
    setBusy("profile");
    const d = await post({ op: "profile", name, nameBn, avatar });
    setBusy("");
    if (d) {
      push("প্রোফাইল সংরক্ষিত ✅", "success");
      load();
      router.refresh();
    }
  };

  const savePassword = async () => {
    if (newPw !== confirmPw) return push("নতুন পাসওয়ার্ড দুটি মিলছে না", "error");
    setBusy("pw");
    const d = await post({ op: "password", current: curPw, next: newPw });
    setBusy("");
    if (d) {
      push("পাসওয়ার্ড বদলানো হয়েছে ✅", "success");
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    }
  };

  // Display preferences live in the browser; also persisted to the account.
  const applyLocale = async (v: "bn" | "en") => {
    setLocale(v);
    await post({ op: "profile", locale: v });
  };
  const applyMotion = async (v: "low" | "medium" | "high") => {
    setMotion(v);
    await post({ op: "profile", motionLevel: v });
  };

  const saveNotif = async (next: NotificationPrefs) => {
    setNotif(next);
    await post({ op: "prefs", notifications: next });
  };

  const saveTeacher = async () => {
    setBusy("teacher");
    const d = await post({ op: "prefs", teacher: tDef });
    setBusy("");
    if (d) push("ডিফল্ট সংরক্ষিত ✅", "success");
  };

  const logout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/");
    router.refresh();
  };

  if (!p)
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );

  const isAdmin = p.role === "admin" || p.role === "super_admin";
  const isTeacher = p.role === "teacher" || isAdmin;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionTitle title="⚙️ সেটিংস" subtitle="প্রোফাইল, নিরাপত্তা ও প্রদর্শন পছন্দ" />

      <Card className="pg-hero-bg text-white">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-3xl">
            {p.avatar || "🙂"}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-extrabold">{p.nameBn || p.name}</p>
            <p className="text-xs text-white/70">{p.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="teal">{ROLE_LABEL[p.role] ?? p.role}</Badge>
              {p.studentId ? <Badge tone="blue">{p.studentId}</Badge> : null}
              {p.role === "student" ? <Badge tone="gold">⚡ {p.xp} XP · {p.level}</Badge> : null}
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: "profile", label: "প্রোফাইল", icon: "👤" },
          { id: "display", label: "প্রদর্শন", icon: "🎨" },
          { id: "notify", label: "নোটিফিকেশন", icon: "🔔" },
          ...(isTeacher ? [{ id: "defaults", label: "ডিফল্ট", icon: "🎛️" }] : []),
          { id: "security", label: "নিরাপত্তা", icon: "🔒" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "profile" ? (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="নাম (English)">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="নাম (বাংলা)">
              <Input value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder="ঐচ্ছিক" />
            </Field>
          </div>

          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold text-slate-600">অ্যাভাটার</p>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={cx(
                    "grid h-11 w-11 place-items-center rounded-xl border-2 text-xl transition",
                    avatar === a ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="ইমেইল" hint="পরিবর্তনের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন">
              <Input value={p.email} disabled />
            </Field>
            {p.studentId ? (
              <Field label="স্টুডেন্ট আইডি" hint="অ্যাডমিন নির্ধারণ করেন">
                <Input value={p.studentId} disabled />
              </Field>
            ) : null}
          </div>

          <Button className="mt-4" loading={busy === "profile"} onClick={saveProfile}>
            💾 সংরক্ষণ করুন
          </Button>
        </Card>
      ) : null}

      {tab === "display" ? (
        <div className="space-y-3">
          <Card>
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">ভাষা</p>
            <div className="flex gap-2">
              {([["bn", "বাংলা"], ["en", "English"]] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => applyLocale(v)}
                  className={cx(
                    "flex-1 rounded-xl border-2 px-4 py-3 font-bold transition",
                    locale === v ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-1 text-xs font-bold uppercase text-slate-400">অ্যানিমেশন</p>
            <p className="mb-2 text-xs text-slate-500">
              পুরোনো বা ধীরগতির ফোনে &quot;কম&quot; বেছে নিলে অ্যাপ দ্রুত চলবে।
            </p>
            <div className="flex gap-2">
              {([["low", "কম"], ["medium", "মাঝারি"], ["high", "বেশি"]] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => applyMotion(v)}
                  className={cx(
                    "flex-1 rounded-xl border-2 px-3 py-3 font-bold transition",
                    motion === v ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <Toggle
              checked={highContrast}
              onChange={setHighContrast}
              label="হাই কনট্রাস্ট মোড (স্পষ্ট বর্ডার ও রঙ)"
            />
            <p className="mt-2 text-xs text-slate-500">
              আপনার ডিভাইসে &quot;reduced motion&quot; চালু থাকলে অ্যানিমেশন এমনিতেই বন্ধ থাকবে।
            </p>
          </Card>
        </div>
      ) : null}

      {tab === "notify" ? (
        <Card>
          <p className="mb-1 text-sm font-bold">কোন নোটিফিকেশন পেতে চান?</p>
          <p className="mb-3 text-xs text-slate-500">
            বন্ধ করা ধরনগুলো আর আপনার তালিকায় দেখাবে না।
          </p>
          <div className="space-y-2">
            {NOTIFICATION_LABELS.filter((n) => n.key !== "approval" || isAdmin).map((n) => (
              <div key={n.key}>
                <Toggle
                  checked={notif[n.key]}
                  onChange={(v) => saveNotif({ ...notif, [n.key]: v })}
                  label={n.label}
                />
                <p className="mt-0.5 pl-1 text-[11px] text-slate-400">{n.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveNotif({ ...DEFAULT_NOTIFICATIONS })}
            >
              সব চালু
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                saveNotif(
                  Object.fromEntries(
                    Object.keys(notif).map((k) => [k, false]),
                  ) as unknown as NotificationPrefs,
                )
              }
            >
              সব বন্ধ
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === "defaults" && isTeacher ? (
        <Card>
          <p className="mb-1 text-sm font-bold">নতুন কুইজ ও প্রশ্নের ডিফল্ট</p>
          <p className="mb-3 text-xs text-slate-500">
            প্রতিবার একই সেটিংস বেছে নেওয়ার দরকার নেই — এখানে একবার ঠিক করে রাখুন।
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="প্রতি প্রশ্নে সময় (সেকেন্ড)">
              <Select
                value={tDef.timer}
                onChange={(e) => setTDef({ ...tDef, timer: Number(e.target.value) })}
              >
                {[10, 15, 20, 30, 45, 60, 90, 120].map((t) => (
                  <option key={t} value={t}>{t} সেকেন্ড</option>
                ))}
              </Select>
            </Field>
            <Field label="প্রতি প্রশ্নে মার্কস">
              <Input
                type="number" min={0.5} step={0.5}
                value={tDef.marks}
                onChange={(e) => setTDef({ ...tDef, marks: Number(e.target.value) })}
              />
            </Field>
            <Field label="ভাষা">
              <Select
                value={tDef.language}
                onChange={(e) => setTDef({ ...tDef, language: e.target.value as "bn" })}
              >
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
                <option value="mixed">মিশ্র</option>
              </Select>
            </Field>
            <Field label="ডিফিকাল্টি">
              <Select
                value={tDef.difficulty}
                onChange={(e) => setTDef({ ...tDef, difficulty: e.target.value as "medium" })}
              >
                <option value="easy">সহজ</option>
                <option value="medium">মাঝারি</option>
                <option value="hard">কঠিন</option>
              </Select>
            </Field>
            <Field label="এআই-তে ডিফল্ট প্রশ্ন সংখ্যা">
              <Select
                value={tDef.questionCount}
                onChange={(e) => setTDef({ ...tDef, questionCount: Number(e.target.value) })}
              >
                {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Toggle
              checked={tDef.withExplanation}
              onChange={(v) => setTDef({ ...tDef, withExplanation: v })}
              label="ব্যাখ্যা যোগ করুন"
            />
            <Toggle
              checked={tDef.withHint}
              onChange={(v) => setTDef({ ...tDef, withHint: v })}
              label="হিন্ট যোগ করুন"
            />
          </div>
          <Button className="mt-4" loading={busy === "teacher"} onClick={saveTeacher}>
            💾 ডিফল্ট সংরক্ষণ
          </Button>
        </Card>
      ) : null}

      {tab === "security" ? (
        <div className="space-y-3">
          <Card>
            <p className="mb-3 text-sm font-bold">পাসওয়ার্ড পরিবর্তন</p>
            <div className="space-y-3">
              <Field label="বর্তমান পাসওয়ার্ড" required>
                <Input
                  type="password"
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <Field label="নতুন পাসওয়ার্ড" required hint="কমপক্ষে ৮ অক্ষর">
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </Field>
              <Field label="নতুন পাসওয়ার্ড আবার লিখুন" required>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              {newPw && confirmPw && newPw !== confirmPw ? (
                <p className="text-xs font-semibold text-rose-600">⚠️ দুটি পাসওয়ার্ড মিলছে না</p>
              ) : null}
              <Button
                loading={busy === "pw"}
                disabled={!curPw || newPw.length < 8 || newPw !== confirmPw}
                onClick={savePassword}
              >
                🔒 পাসওয়ার্ড বদলান
              </Button>
            </div>
          </Card>

          <Card>
            <p className="mb-2 text-sm font-bold">সেশন</p>
            <p className="text-xs text-slate-500">
              অন্য কারো ডিভাইসে লগইন করে থাকলে সেখান থেকে লগআউট করে নিন।
            </p>
            <Button className="mt-3" variant="danger" onClick={logout}>
              লগআউট করুন
            </Button>
          </Card>

          {isAdmin ? (
            <Card className="border-teal-200 bg-teal-50">
              <p className="text-sm font-bold">🛠️ অ্যাডমিন সেটিংস</p>
              <p className="mt-0.5 text-xs text-slate-600">
                স্কুলের ব্র্যান্ডিং, ইউজার, এআই কী ও একাডেমিক কাঠামো আলাদা পেজে।
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link href="/admin/settings"><Button size="sm" variant="outline">🎨 ব্র্যান্ডিং</Button></Link>
                <Link href="/admin/users"><Button size="sm" variant="outline">👥 ইউজার</Button></Link>
                <Link href="/admin/ai"><Button size="sm" variant="outline">🔑 এআই কী</Button></Link>
                <Link href="/admin/structure"><Button size="sm" variant="outline">🏫 কাঠামো</Button></Link>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
