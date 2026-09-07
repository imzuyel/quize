import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSeo } from "@/lib/seo";
import { LandingPreviews } from "@/components/landing-previews";
import { DemoEntry, RoleGrid } from "@/components/demo-entry";
import { AUTHOR, DeveloperCard, SocialRing } from "@/components/credit";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "✨", title: "এআই প্রশ্ন জেনারেটর", body: "ক্লাস, ট্রেড, বিষয়, অধ্যায় ও টপিক বেছে ১০ থেকে ১০০০+ প্রশ্ন তৈরি করুন — ব্যাখ্যা, হিন্ট ও কোয়ালিটি চেকসহ।", href: "/demo?next=/teacher/ai" },
  { icon: "📘", title: "বই থেকে প্রশ্ন", body: "সম্পূর্ণ বইয়ের PDF আপলোড করে অধ্যায় বা পেজ রেঞ্জ বেছে প্রশ্ন, শর্ট প্রশ্ন ও পাজল তৈরি করুন।", href: "/demo?next=/teacher/ai%3Ftab%3Ddocument" },
  { icon: "📡", title: "লাইভ ক্লাসরুম কুইজ", body: "গেম পিন ও QR কোডে শিক্ষার্থীরা যোগ দেয়। সার্ভার-অথরিটেটিভ ইঞ্জিন সবাইকে সিঙ্ক রাখে।", href: "/demo?next=/teacher/live" },
  { icon: "📝", title: "ফরমাল অনলাইন পরীক্ষা", body: "প্রশ্ন প্যালেট, মার্ক ফর রিভিউ, অটো-সেভ, নেগেটিভ মার্কিং ও অটো-সাবমিট।", href: "/demo?next=/student/quizzes" },
  { icon: "🎨", title: "টেমপ্লেট স্টুডিও", body: "১৬টি অ্যানিমেটেড থিম — রঙ, পার্টিকেল, টাইমার স্টাইল ও উদযাপন কাস্টমাইজ করুন।", href: "/demo?next=/teacher/templates" },
  { icon: "📈", title: "অ্যানালিটিক্স ও রিপোর্ট", body: "বিষয়ভিত্তিক পারফরম্যান্স, কঠিন প্রশ্ন, এআই শিক্ষণ পরামর্শ ও CSV এক্সপোর্ট।", href: "/demo?next=/teacher/analytics" },
];

const QUICK_LINKS = [
  { icon: "✨", label: "এআই প্রশ্ন জেনারেটর", href: "/demo?next=/teacher/ai" },
  { icon: "📘", label: "বইয়ের PDF থেকে প্রশ্ন", href: "/demo?next=/teacher/ai%3Ftab%3Ddocument" },
  { icon: "🎛️", label: "কুইজ স্টুডিও", href: "/demo?next=/teacher/quizzes" },
  { icon: "🎨", label: "থিম স্টুডিও", href: "/demo?next=/teacher/templates" },
  { icon: "📡", label: "লাইভ কুইজ", href: "/demo?next=/teacher/live" },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const seo = await getSeo();
  const unavailable = sp.demo === "unavailable";
  const user = await getCurrentUser();
  const demoMode = process.env.DEMO_MODE !== "false";
  const home =
    user?.role === "teacher"
      ? "/teacher"
      : user?.role === "admin" || user?.role === "super_admin"
        ? "/admin"
        : user?.role === "parent"
          ? "/parent"
          : "/student";

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071726]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--pg-teal)] font-black text-white">
            PG
          </span>
          <div className="leading-tight text-white">
            <p className="text-sm font-extrabold">{seo.siteName}</p>
            <p className="hidden text-[10px] text-white/60 sm:block">{seo.siteNameEn}</p>
          </div>
          <div className="flex-1" />
          {demoMode ? (
            <a
              href="/demo?next=/teacher/ai"
              className="hidden rounded-xl bg-[var(--pg-teal)] px-4 py-2 text-sm font-bold text-white sm:block"
            >
              ✨ এআই জেনারেটর
            </a>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl bg-[var(--pg-teal)] px-4 py-2 text-sm font-bold text-white sm:block"
            >
              লগইন
            </Link>
          )}
          <Link
            href="/join"
            className="rounded-xl border border-white/25 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            কুইজে যোগ দিন
          </Link>
          <Link
            href={user ? home : demoMode ? "#roles" : "/login"}
            className="rounded-xl bg-[var(--pg-gold)] px-4 py-2 text-sm font-bold text-[#3b2a06]"
          >
            {user ? "ড্যাশবোর্ড" : "শুরু করুন"}
          </Link>
        </div>
      </header>

      {unavailable ? (
        <div className="bg-amber-100 px-4 py-2.5 text-center text-sm font-semibold text-amber-900">
          ⚠️ ডেমো ডেটা এখনো প্রস্তুত হয়নি। কয়েক সেকেন্ড পর আবার চেষ্টা করুন —{" "}
          <a href="/demo?next=/teacher/ai" className="underline">আবার চেষ্টা করুন</a>
        </div>
      ) : null}

      <section className="pg-hero-bg relative overflow-hidden">
        <div className="pg-grid-lines absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div className="text-white">
            <span className="anim-fade inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              🇧🇩 বাংলা-ফার্স্ট · কারিগরি শিক্ষার জন্য তৈরি
            </span>
            <h1 className="anim-fade mt-5 text-3xl font-black leading-tight sm:text-5xl">
              প্রতিটি ক্লাসকে বানান <span className="text-[var(--pg-gold)]">ইন্টারেক্টিভ</span> শেখার
              অভিজ্ঞতা
            </h1>
            <p className="anim-fade mt-4 max-w-xl text-base text-white/80 sm:text-lg">
              এআই-চালিত কুইজ, লাইভ প্রতিযোগিতা, স্মার্ট পরীক্ষা ও ব্যক্তিগত শেখা—সব এক প্ল্যাটফর্মে।
            </p>
            <p className="anim-fade mt-2 text-sm text-white/60">
              Turn every class into an interactive learning experience.
            </p>
            <div className="mt-7">
              <DemoEntry signedIn={Boolean(user)} home={home} />
            </div>

            {demoMode ? (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
                সরাসরি ফিচারে যান
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_LINKS.map((q) => (
                  <a
                    key={q.href}
                    href={q.href}
                    className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                  >
                    {q.icon} {q.label}
                  </a>
                ))}
              </div>
            </div>
            ) : null}

            <dl className="mt-9 grid max-w-md grid-cols-3 gap-3 text-center">
              {[
                { k: "১০০০+", v: "প্রশ্ন এক জেনারেশনে" },
                { k: "৫০০০+", v: "একযোগে অংশগ্রহণকারী*" },
                { k: "১৭", v: "প্রশ্নের ধরন" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-white/15 bg-white/5 p-3">
                  <dt className="text-xl font-black text-[var(--pg-gold)]">{s.k}</dt>
                  <dd className="mt-0.5 text-[11px] text-white/70">{s.v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[10px] text-white/40">*ডিপ্লয়মেন্ট অবকাঠামোর উপর নির্ভরশীল</p>
          </div>

          <LandingPreviews />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl font-extrabold sm:text-3xl">
          শিক্ষক যা কল্পনা করেন, কোড ছাড়াই তা তৈরি করুন
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-500">
          প্রশ্ন ব্যাংক, কুইজ স্টুডিও, লাইভ ইঞ্জিন, পরীক্ষা মোড, অনুশীলন, টেমপ্লেট, অ্যানালিটিক্স ও
          অর্জন — সবকিছু একসাথে।
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <a
              key={f.title}
              href={demoMode ? f.href : "/login"}
              className="pg-surface pg-shadow group block p-5 transition hover:-translate-y-0.5 hover:border-[var(--pg-teal)]"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--pg-mist)] text-xl">
                {f.icon}
              </div>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.body}</p>
              <span className="mt-2 inline-block text-xs font-bold text-[var(--pg-teal)] opacity-0 transition group-hover:opacity-100">
                এখনই দেখুন →
              </span>
            </a>
          ))}
        </div>
      </section>

      {demoMode ? (
        <section id="roles" className="scroll-mt-20 border-y border-[var(--pg-line)] bg-white py-12">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-xl font-extrabold">সবার জন্য আলাদা অভিজ্ঞতা</h2>
            <p className="mx-auto mt-1 max-w-md text-center text-sm text-slate-500">
              ভূমিকায় ক্লিক করলেই সরাসরি সেই ড্যাশবোর্ডে প্রবেশ করবেন।
            </p>
            <RoleGrid />
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="mb-1 text-center text-xl font-extrabold">যিনি তৈরি করেছেন</h2>
        <p className="mb-6 text-center text-sm text-slate-500">
          শিক্ষকদের জন্য, একজন শিক্ষকের হাতে তৈরি
        </p>
        <DeveloperCard />
      </section>

      <footer className="bg-[#071726] py-10 text-white/70">
        <div className="mx-auto max-w-6xl px-4 text-sm">
          <p className="font-bold text-white">পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ</p>
          <p className="mt-1 text-xs">পঞ্চগড় সদর, পঞ্চগড় — ৫০০০ | info@pgtsc.edu.bd</p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">ডেভেলপার</p>
              <p className="mt-0.5 text-sm font-bold text-white/90">{AUTHOR.name}</p>
              <p className="text-[11px] text-white/50">{AUTHOR.title}</p>
            </div>
            <SocialRing tone="dark" size={20} />
          </div>
          <p className="mt-4 text-xs text-white/40">
            © পিজিটিএসসি কুইজ অ্যারেনা — কারিগরি শিক্ষা অধিদপ্তর
          </p>
        </div>
      </footer>
    </div>
  );
}
