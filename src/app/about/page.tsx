import Link from "next/link";
import { DeveloperCard } from "@/components/credit";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "প্ল্যাটফর্ম সম্পর্কে",
  description:
    "পিজিটিএসসি কুইজ অ্যারেনা কে বানিয়েছেন, কী কী ফিচার আছে এবং কীভাবে যোগাযোগ করবেন।",
  alternates: { canonical: "/about" },
};

const FEATURES = [
  { icon: "✨", t: "এআই প্রশ্ন জেনারেটর", d: "বিষয় লিখলেই ১০ থেকে ১০০০+ প্রশ্ন, ব্যাখ্যা ও হিন্টসহ" },
  { icon: "📋", t: "প্রশ্ন পেস্ট করুন", d: "Word, Excel বা অন্য অ্যাপ থেকে কপি করে সরাসরি আমদানি" },
  { icon: "📘", t: "বই থেকে প্রশ্ন", d: "PDF আপলোড করে অধ্যায় বা পেজ রেঞ্জ বেছে প্রশ্ন তৈরি" },
  { icon: "🧩", t: "২৩ ধরনের প্রশ্ন", d: "MCQ, পাজল, শব্দ সাজানো, মিলকরণ, শ্রেণিবিন্যাস ও আরও" },
  { icon: "📡", t: "লাইভ কুইজ", d: "গেম পিন ও QR কোডে যোগদান, সার্ভার-সিঙ্ক্রোনাইজড খেলা" },
  { icon: "🎨", t: "১৬টি অ্যানিমেটেড থিম", d: "রঙ, পার্টিকেল, ট্রানজিশন ও উদযাপন কাস্টমাইজেবল" },
  { icon: "📝", t: "ফরমাল পরীক্ষা", d: "প্রশ্ন প্যালেট, অটো-সেভ, নেগেটিভ মার্কিং ও অটো-সাবমিট" },
  { icon: "📈", t: "অ্যানালিটিক্স", d: "বিষয়ভিত্তিক ফল, কঠিন প্রশ্ন, এআই পরামর্শ ও রিপোর্ট" },
];

export default async function AboutPage() {
  const user = await getCurrentUser();
  const home =
    user?.role === "teacher"
      ? "/teacher"
      : user?.role === "admin" || user?.role === "super_admin"
        ? "/admin"
        : user?.role === "parent"
          ? "/parent"
          : user
            ? "/student"
            : "/";

  return (
    <div className="min-h-screen bg-[var(--pg-mist)] px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={home}>
            <span className="rounded-xl border border-[var(--pg-line)] bg-white px-3 py-2 text-sm font-bold">
              ← ফিরে যান
            </span>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">ℹ️ প্ল্যাটফর্ম সম্পর্কে</h1>
            <p className="text-sm text-slate-500">
              পিজিটিএসসি কুইজ অ্যারেনা — এআই-চালিত ইন্টারেক্টিভ লার্নিং প্ল্যাটফর্ম
            </p>
          </div>
        </div>

      <DeveloperCard />

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.t} className="pg-surface p-4">
            <div className="text-xl">{f.icon}</div>
            <p className="mt-1.5 font-bold">{f.t}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{f.d}</p>
          </div>
        ))}
      </div>

      <div className="pg-surface p-5">
        <p className="text-sm font-bold">🙏 কৃতজ্ঞতা</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          এই প্ল্যাটফর্মটি শিক্ষকদের দৈনন্দিন প্রয়োজন থেকে তৈরি — যাতে প্রশ্ন তৈরি, পরীক্ষা নেওয়া
          ও শেখার মূল্যায়ন সহজ ও আনন্দদায়ক হয়। মতামত বা পরামর্শ থাকলে উপরের যেকোনো
          মাধ্যমে যোগাযোগ করুন।
        </p>
      </div>
      </div>
    </div>
  );
}
