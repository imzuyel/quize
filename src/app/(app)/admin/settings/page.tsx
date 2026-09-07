"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_FEATURES, FEATURE_LABELS, mergeFeatures, type FeatureFlags } from "@/lib/prefs";
import { DEFAULT_SEO, mergeSeo, type SeoSettings } from "@/lib/seo-config";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from "@/components/ui";

type Branding = {
  schoolName: string;
  schoolNameEn: string;
  logo: string;
  primary: string;
  accent: string;
  footer: string;
  contact: string;
  lockBranding: boolean;
};

type Achievement = { id: number; name: string; nameBn: string | null; description: string | null; icon: string; xp: number; active: boolean };

const DEFAULT_BRANDING: Branding = {
  schoolName: "পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ",
  schoolNameEn: "Panchagarh Government Technical School and College",
  logo: "",
  primary: "#0f7b6c",
  accent: "#f0b429",
  footer: "© পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ",
  contact: "পঞ্চগড় সদর, পঞ্চগড় — ৫০০০",
  lockBranding: true,
};

export default function AdminSettings() {
  const { push } = useToast();
  const [tab, setTab] = useState("branding");
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [draft, setDraft] = useState({ name: "", nameBn: "", description: "", icon: "🏆", xp: 50 });
  const [announcement, setAnnouncement] = useState({ title: "", body: "", audience: "students" });
  const [registration, setRegistration] = useState({ autoApproveStudents: false });
  const [features, setFeatures] = useState<FeatureFlags>(DEFAULT_FEATURES);
  const [seo, setSeo] = useState<SeoSettings>(DEFAULT_SEO);

  const load = useCallback(async () => {
    const s = await fetch("/api/admin?scope=settings");
    if (s.ok) {
      const json = await s.json();
      if (json.branding) setBranding({ ...DEFAULT_BRANDING, ...json.branding });
      if (json.registration) setRegistration({ autoApproveStudents: false, ...json.registration });
      setFeatures(mergeFeatures(json.features));
      setSeo(mergeSeo(json.seo, json.branding));
    }
    const a = await fetch("/api/admin?scope=achievements");
    if (a.ok) setAchievements(await a.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin", {
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

  return (
    <div className="space-y-4">
      <SectionTitle title="🎨 ব্র্যান্ডিং, অর্জন ও ঘোষণা" subtitle="স্কুলের পরিচয় ও গেমিফিকেশন কনফিগার করুন" />
      <Tabs
        tabs={[
          { id: "branding", label: "ব্র্যান্ডিং", icon: "🎨" },
          { id: "achievements", label: "অর্জন", icon: "🏅" },
          { id: "seo", label: "SEO", icon: "🔎" },
          { id: "features", label: "ফিচার", icon: "🧩" },
          { id: "access", label: "নিবন্ধন নীতি", icon: "🔐" },
          { id: "announce", label: "ঘোষণা", icon: "📢" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "branding" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="স্কুলের নাম (বাংলা)"><Input value={branding.schoolName} onChange={(e) => setBranding({ ...branding, schoolName: e.target.value })} /></Field>
              <Field label="School Name (English)"><Input value={branding.schoolNameEn} onChange={(e) => setBranding({ ...branding, schoolNameEn: e.target.value })} /></Field>
              <Field label="লোগো URL"><Input value={branding.logo} onChange={(e) => setBranding({ ...branding, logo: e.target.value })} /></Field>
              <Field label="যোগাযোগ"><Input value={branding.contact} onChange={(e) => setBranding({ ...branding, contact: e.target.value })} /></Field>
              <Field label="প্রাইমারি রঙ">
                <input type="color" value={branding.primary} onChange={(e) => setBranding({ ...branding, primary: e.target.value })} className="h-11 w-full rounded-xl border border-[var(--pg-line)]" />
              </Field>
              <Field label="অ্যাকসেন্ট রঙ">
                <input type="color" value={branding.accent} onChange={(e) => setBranding({ ...branding, accent: e.target.value })} className="h-11 w-full rounded-xl border border-[var(--pg-line)]" />
              </Field>
            </div>
            <Field label="ফুটার"><Textarea value={branding.footer} onChange={(e) => setBranding({ ...branding, footer: e.target.value })} /></Field>
            <div className="mt-3">
              <Toggle
                checked={branding.lockBranding}
                onChange={(v) => setBranding({ ...branding, lockBranding: v })}
                label="স্কুল টেমপ্লেটে অফিসিয়াল ব্র্যান্ডিং লক করুন"
              />
            </div>
            <Button className="mt-4" onClick={async () => { await post({ op: "saveSettings", key: "branding", value: branding }); push("সংরক্ষিত ✅", "success"); }}>
              💾 সংরক্ষণ করুন
            </Button>
          </Card>
          <Card>
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">প্রিভিউ</p>
            <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${branding.primary}, ${branding.accent})` }}>
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/20 font-black">PG</div>
              <p className="mt-3 font-extrabold">{branding.schoolName}</p>
              <p className="text-xs opacity-80">{branding.schoolNameEn}</p>
              <p className="mt-3 text-[11px] opacity-70">{branding.contact}</p>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{branding.footer}</p>
          </Card>
        </div>
      ) : null}

      {tab === "achievements" ? (
        <div className="space-y-4">
          <Card>
            <div className="grid gap-2 sm:grid-cols-5">
              <Input placeholder="নাম" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <Input placeholder="বাংলা নাম" value={draft.nameBn} onChange={(e) => setDraft({ ...draft, nameBn: e.target.value })} />
              <Input placeholder="আইকন" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
              <Input type="number" placeholder="XP" value={draft.xp} onChange={(e) => setDraft({ ...draft, xp: Number(e.target.value) })} />
              <Button onClick={async () => { await post({ op: "saveAchievement", ...draft }); push("যোগ হয়েছে", "success"); }}>+ যোগ</Button>
            </div>
            <Input className="mt-2" placeholder="বিবরণ" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-2xl">{a.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{a.nameBn || a.name}</p>
                    <p className="text-xs text-slate-500">{a.description}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Badge tone="gold">+{a.xp} XP</Badge>
                      <Badge tone={a.active ? "green" : "slate"}>{a.active ? "সক্রিয়" : "বন্ধ"}</Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "saveAchievement", id: a.id, name: a.name, nameBn: a.nameBn, description: a.description, icon: a.icon, xp: a.xp, active: !a.active })}>
                    {a.active ? "বন্ধ করুন" : "চালু করুন"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => post({ op: "deleteAchievement", id: a.id })}>মুছুন</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "seo" ? (
        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="🔎 সার্চ ইঞ্জিন অপটিমাইজেশন"
              subtitle="গুগলে আপনার প্রতিষ্ঠান কীভাবে দেখাবে তা নির্ধারণ করুন"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="সাইটের নাম (বাংলা)">
                <Input value={seo.siteName} onChange={(e) => setSeo({ ...seo, siteName: e.target.value })} />
              </Field>
              <Field label="Site name (English)">
                <Input value={seo.siteNameEn} onChange={(e) => setSeo({ ...seo, siteNameEn: e.target.value })} />
              </Field>
            </div>
            <Field label="ট্যাগলাইন" hint="শেয়ার কার্ডে বড় করে দেখানো হবে">
              <Input value={seo.tagline} onChange={(e) => setSeo({ ...seo, tagline: e.target.value })} />
            </Field>
            <Field
              label="বিবরণ (মেটা ডেসক্রিপশন)"
              hint={`গুগলে শিরোনামের নিচে দেখানো হয় · ${seo.description.length}/160 অক্ষর`}
            >
              <Textarea
                value={seo.description}
                onChange={(e) => setSeo({ ...seo, description: e.target.value })}
                className="min-h-[70px]"
              />
            </Field>
            <Field label="Description (English)">
              <Textarea
                value={seo.descriptionEn}
                onChange={(e) => setSeo({ ...seo, descriptionEn: e.target.value })}
                className="min-h-[60px]"
              />
            </Field>
            <Field label="কীওয়ার্ড" hint="কমা দিয়ে আলাদা করুন">
              <Textarea
                value={seo.keywords}
                onChange={(e) => setSeo({ ...seo, keywords: e.target.value })}
                className="min-h-[60px] text-xs"
              />
            </Field>
          </Card>

          <Card>
            <p className="mb-3 text-sm font-bold">🌐 ঠিকানা ও লোগো</p>
            <Field
              label="সাইটের পূর্ণ URL"
              hint="খালি রাখলে সার্ভার নিজে শনাক্ত করবে · sitemap ও শেয়ার লিংকে ব্যবহৃত হয়"
            >
              <Input
                value={seo.siteUrl}
                onChange={(e) => setSeo({ ...seo, siteUrl: e.target.value })}
                placeholder="https://quiz.pgtsc.edu.bd"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="লোগো URL" hint="JSON-LD ও শেয়ার কার্ডে">
                <Input value={seo.logo} onChange={(e) => setSeo({ ...seo, logo: e.target.value })} placeholder="https://…/logo.png" />
              </Field>
              <Field label="থিম কালার" hint="মোবাইল ব্রাউজারের অ্যাড্রেস বার">
                <input
                  type="color"
                  value={seo.themeColor}
                  onChange={(e) => setSeo({ ...seo, themeColor: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[var(--pg-line)]"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ঠিকানা">
                <Input
                  value={seo.org.address ?? ""}
                  onChange={(e) => setSeo({ ...seo, org: { ...seo.org, address: e.target.value } })}
                />
              </Field>
              <Field label="ইমেইল">
                <Input
                  value={seo.org.email ?? ""}
                  onChange={(e) => setSeo({ ...seo, org: { ...seo.org, email: e.target.value } })}
                />
              </Field>
              <Field label="ফোন">
                <Input
                  value={seo.org.phone ?? ""}
                  onChange={(e) => setSeo({ ...seo, org: { ...seo.org, phone: e.target.value } })}
                />
              </Field>
              <Field label="X / Twitter হ্যান্ডেল">
                <Input
                  value={seo.twitter}
                  onChange={(e) => setSeo({ ...seo, twitter: e.target.value })}
                  placeholder="@pgtsc"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-sm font-bold">✅ সার্চ কনসোল যাচাইকরণ</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Google verification code">
                <Input
                  value={seo.verification.google ?? ""}
                  onChange={(e) => setSeo({ ...seo, verification: { ...seo.verification, google: e.target.value } })}
                  placeholder="google-site-verification মান"
                />
              </Field>
              <Field label="Bing verification code">
                <Input
                  value={seo.verification.bing ?? ""}
                  onChange={(e) => setSeo({ ...seo, verification: { ...seo.verification, bing: e.target.value } })}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Toggle
                checked={seo.noIndex}
                onChange={(v) => setSeo({ ...seo, noIndex: v })}
                label="🚫 সার্চ ইঞ্জিন থেকে সম্পূর্ণ লুকান (লঞ্চের আগে)"
              />
              <p className="mt-1 text-xs text-slate-500">
                চালু করলে robots.txt সব ক্রলার ব্লক করবে এবং sitemap খালি হবে।
              </p>
            </div>
          </Card>

          <Card className="bg-slate-50">
            <p className="mb-2 text-xs font-bold uppercase text-slate-400">গুগলে যেভাবে দেখাবে</p>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs text-emerald-700">{seo.siteUrl || "https://your-domain"} › </p>
              <p className="mt-0.5 text-lg leading-tight text-blue-700">
                {seo.siteName} | {seo.siteNameEn}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {seo.description.slice(0, 160)}
                {seo.description.length > 160 ? "…" : ""}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">sitemap.xml দেখুন ↗</Button>
              </a>
              <a href="/robots.txt" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">robots.txt দেখুন ↗</Button>
              </a>
              <a href="/opengraph-image" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">শেয়ার কার্ড দেখুন ↗</Button>
              </a>
            </div>
          </Card>

          <Button
            onClick={async () => {
              await post({ op: "saveSettings", key: "seo", value: seo });
              push("SEO সেটিংস সংরক্ষিত ✅", "success");
            }}
          >
            💾 SEO সংরক্ষণ করুন
          </Button>
        </div>
      ) : null}

      {tab === "features" ? (
        <Card>
          <SectionTitle
            title="প্ল্যাটফর্ম ফিচার"
            subtitle="যে ফিচারগুলো আপনার প্রতিষ্ঠানে দরকার নেই সেগুলো বন্ধ রাখুন"
          />
          <div className="space-y-2">
            {FEATURE_LABELS.map((f) => (
              <div key={f.key}>
                <Toggle
                  checked={features[f.key]}
                  onChange={(v) => setFeatures({ ...features, [f.key]: v })}
                  label={`${f.icon} ${f.label}`}
                />
                <p className="mt-0.5 pl-1 text-[11px] text-slate-400">{f.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                await post({ op: "saveSettings", key: "features", value: features });
                push("সংরক্ষিত ✅ — সাথে সাথে কার্যকর", "success");
              }}
            >
              💾 সংরক্ষণ করুন
            </Button>
            <Button variant="ghost" onClick={() => setFeatures({ ...DEFAULT_FEATURES })}>
              সব চালু করুন
            </Button>
          </div>
          <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500">
            ⚠️ কোনো ফিচার বন্ধ করলে সংশ্লিষ্ট API-ও বন্ধ হয়ে যায় — শুধু মেনু লুকানো নয়।
          </p>
        </Card>
      ) : null}

      {tab === "access" ? (
        <Card>
          <SectionTitle
            title="নতুন অ্যাকাউন্ট অনুমোদন"
            subtitle="কারা নিজে নিবন্ধন করলে সরাসরি ঢুকতে পারবে তা ঠিক করুন"
          />
          <div className="rounded-xl border border-[var(--pg-line)] p-3">
            <p className="text-sm font-bold">👩‍🏫 শিক্ষক</p>
            <p className="mt-0.5 text-xs text-slate-500">
              সর্বদা অ্যাডমিন অনুমোদন প্রয়োজন — নিরাপত্তার কারণে এটি বন্ধ করা যায় না।
            </p>
            <Badge tone="teal" className="mt-2">অনুমোদন আবশ্যক</Badge>
          </div>
          <div className="mt-3">
            <Toggle
              checked={registration.autoApproveStudents}
              onChange={(v) => setRegistration({ autoApproveStudents: v })}
              label="🎒 শিক্ষার্থী ও অভিভাবক অনুমোদন ছাড়াই ঢুকতে পারবে"
            />
            <p className="mt-1 text-xs text-slate-500">
              বন্ধ থাকলে (সুপারিশকৃত) সব নতুন অ্যাকাউন্ট অনুমোদনের অপেক্ষায় থাকবে।
            </p>
          </div>
          <Button
            className="mt-4"
            onClick={async () => {
              await post({ op: "saveSettings", key: "registration", value: registration });
              push("সংরক্ষিত ✅", "success");
            }}
          >
            💾 সংরক্ষণ করুন
          </Button>
        </Card>
      ) : null}

      {tab === "announce" ? (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="শিরোনাম"><Input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} /></Field>
            <Field label="প্রাপক">
              <Select value={announcement.audience} onChange={(e) => setAnnouncement({ ...announcement, audience: e.target.value })}>
                <option value="students">শিক্ষার্থী</option>
                <option value="teachers">শিক্ষক</option>
                <option value="parents">অভিভাবক</option>
                <option value="all">সবাই</option>
              </Select>
            </Field>
          </div>
          <Field label="বার্তা"><Textarea value={announcement.body} onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })} /></Field>
          <Button
            className="mt-3"
            onClick={async () => {
              const res = await fetch("/api/notifications", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ op: "broadcast", ...announcement }),
              });
              const data = await res.json();
              if (res.ok) push(`${data.sent} জনকে পাঠানো হয়েছে`, "success");
              else push(data.error ?? "ব্যর্থ", "error");
            }}
          >
            📢 ঘোষণা পাঠান
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
