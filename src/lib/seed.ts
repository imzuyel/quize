import { db } from "@/db";
import {
  achievements,
  chapters,
  classes,
  feedback,
  notifications,
  parentLinks,
  questions,
  quizQuestions,
  quizResults,
  quizTemplates,
  quizzes,
  sections,
  settings,
  studentAchievements,
  subjects,
  topics,
  trades,
  users,
} from "@/db/schema";
import { hashPassword } from "./auth";
import { DEFAULT_SETTINGS, EXAM_SETTINGS } from "./live";
import { THEME_PRESETS, mergeTemplate } from "./theme";
import { eq, sql } from "drizzle-orm";

/** Demo accounts share this password. Override in any shared environment. */
const PASSWORD = process.env.DEMO_PASSWORD || "demo123";

const TRADES = [
  { name: "General Electronics", nameBn: "জেনারেল ইলেকট্রনিক্স", code: "GEL" },
  { name: "IT Support & IoT Basics", nameBn: "আইটি সাপোর্ট ও আইওটি বেসিকস", code: "ITI" },
  { name: "General Electrical", nameBn: "জেনারেল ইলেকট্রিক্যাল", code: "GEE" },
  { name: "Apparel Manufacturing Basics", nameBn: "অ্যাপারেল ম্যানুফ্যাকচারিং বেসিকস", code: "AMB" },
];

const SUBJECTS = [
  { name: "Computer", nameBn: "কম্পিউটার", color: "#2f80ed" },
  { name: "Mathematics", nameBn: "গণিত", color: "#0f7b6c" },
  { name: "Electronics", nameBn: "ইলেকট্রনিক্স", color: "#8b5cf6" },
  { name: "Electrical", nameBn: "ইলেকট্রিক্যাল", color: "#f0b429" },
  { name: "English", nameBn: "ইংরেজি", color: "#e2574c" },
  { name: "Bangla", nameBn: "বাংলা", color: "#0891b2" },
  { name: "Physics", nameBn: "পদার্থবিজ্ঞান", color: "#16a34a" },
  { name: "IoT Basics", nameBn: "আইওটি বেসিকস", color: "#db2777" },
];

const CHAPTER_MAP: Record<string, { name: string; nameBn: string; topics: string[] }[]> = {
  Computer: [
    { name: "HTML Fundamentals", nameBn: "এইচটিএমএল মৌলিক", topics: ["HTML Forms", "HTML Tables", "Semantic Tags"] },
    { name: "Computer Networks", nameBn: "কম্পিউটার নেটওয়ার্ক", topics: ["IP Addressing", "LAN & WAN", "Network Devices"] },
    { name: "Operating Systems", nameBn: "অপারেটিং সিস্টেম", topics: ["Process", "File System"] },
  ],
  Mathematics: [
    { name: "Algebra", nameBn: "বীজগণিত", topics: ["Quadratic Equations", "Sets"] },
    { name: "Geometry", nameBn: "জ্যামিতি", topics: ["Triangles", "Circles"] },
  ],
  Electronics: [
    { name: "Semiconductors", nameBn: "অর্ধপরিবাহী", topics: ["Diode", "Transistor"] },
    { name: "Digital Logic", nameBn: "ডিজিটাল লজিক", topics: ["Logic Gates", "Number Systems"] },
  ],
  Electrical: [
    { name: "DC Circuits", nameBn: "ডিসি সার্কিট", topics: ["Ohm's Law", "Series & Parallel"] },
    { name: "Wiring", nameBn: "ওয়্যারিং", topics: ["House Wiring", "Safety"] },
  ],
  English: [{ name: "Grammar", nameBn: "ব্যাকরণ", topics: ["Tense", "Preposition"] }],
  Bangla: [{ name: "ব্যাকরণ", nameBn: "ব্যাকরণ", topics: ["সন্ধি", "সমাস"] }],
  Physics: [{ name: "Motion", nameBn: "গতি", topics: ["Newton's Laws"] }],
  "IoT Basics": [
    { name: "Sensors", nameBn: "সেন্সর", topics: ["Temperature Sensor", "Motion Sensor"] },
    { name: "Microcontrollers", nameBn: "মাইক্রোকন্ট্রোলার", topics: ["Arduino Basics", "GPIO"] },
  ],
};

const ACHIEVEMENTS = [
  { code: "quiz_champion", name: "Quiz Champion", nameBn: "কুইজ চ্যাম্পিয়ন", icon: "🏆", xp: 200, description: "লাইভ কুইজে প্রথম স্থান" },
  { code: "streak_10", name: "10 Streak", nameBn: "১০ স্ট্রিক", icon: "🔥", xp: 120, description: "একটানা ১০টি সঠিক উত্তর" },
  { code: "speed_master", name: "Speed Master", nameBn: "স্পিড মাস্টার", icon: "⚡", xp: 100, description: "দ্রুততম গড় উত্তর সময়" },
  { code: "accuracy_100", name: "100% Accuracy", nameBn: "১০০% নির্ভুলতা", icon: "🎯", xp: 150, description: "একটি কুইজে সব উত্তর সঠিক" },
  { code: "quizzes_50", name: "50 Quizzes Completed", nameBn: "৫০ কুইজ সম্পন্ন", icon: "📚", xp: 250, description: "৫০টি কুইজ শেষ করা" },
  { code: "most_improved", name: "Most Improved", nameBn: "সর্বাধিক উন্নতি", icon: "📈", xp: 180, description: "সর্বোচ্চ উন্নতি" },
  { code: "tournament_winner", name: "Tournament Winner", nameBn: "টুর্নামেন্ট বিজয়ী", icon: "👑", xp: 400, description: "স্কুল টুর্নামেন্ট জয়" },
];

const STUDENT_NAMES = [
  "আরিফুল ইসলাম", "সাদিয়া আক্তার", "রিফাত হোসেন", "নুসরাত জাহান", "মেহেদী হাসান",
  "তাসনিম রহমান", "সাব্বির আহমেদ", "ফারজানা ইয়াসমিন", "রাকিব হাসান", "জান্নাতুল ফেরদৌস",
  "শাকিল আহমেদ", "মারিয়া খাতুন", "তানভীর আলম", "সুমাইয়া আক্তার", "ইমরান খান",
  "আফসানা মিমি", "নাহিদ হাসান", "রুবাইয়া ইসলাম", "সিয়াম শেখ", "লামিয়া আক্তার",
  "হাসিবুল হক", "তানজিলা পারভীন", "মাহবুব রহমান", "সাদিয়া নূর",
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

/** Templates are versioned separately so new built-in themes appear on upgrade. */
export async function seedTemplates(ownerId: number | null) {
  const existing = await db.select({ c: sql<number>`count(*)::int` }).from(quizTemplates);
  if ((existing[0]?.c ?? 0) > 0) return 0;
  await db.insert(quizTemplates).values(
    THEME_PRESETS.map((preset, i) => ({
      name: preset.name,
      category: preset.category,
      official: i < 3,
      visibility: "school",
      ownerId: i > 11 ? ownerId : null,
      rating: Number((4 + ((i * 3) % 10) / 10).toFixed(1)),
      uses: 12 + i * 9,
      config: mergeTemplate(preset) as object,
    })),
  );
  return THEME_PRESETS.length;
}

/** True when demo content (fake students, quizzes, results) may be created. */
export function demoSeedAllowed() {
  return process.env.DEMO_MODE !== "false";
}

/**
 * Production bootstrap: academic structure, official themes, achievements and
 * a single super admin — no fake students, quizzes or results.
 */
export async function bootstrapProduction(email: string, password: string) {
  const existing = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  if ((existing[0]?.c ?? 0) > 0) return { created: false as const };

  const admin = (
    await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name: "Super Admin",
        nameBn: "সুপার অ্যাডমিন",
        role: "super_admin",
        passwordHash: hashPassword(password),
      })
      .returning()
  )[0];

  const classRows = await db
    .insert(classes)
    .values([6, 7, 8, 9, 10, 11, 12].map((n) => ({ name: `Class ${n}`, nameBn: `${n}ম শ্রেণি`, level: n })))
    .returning();
  await db
    .insert(sections)
    .values(classRows.flatMap((c) => ["A", "B"].map((x) => ({ classId: c.id, name: x }))));
  await db.insert(trades).values(TRADES);
  await db.insert(achievements).values(ACHIEVEMENTS);
  await seedTemplates(null);
  await db.insert(settings).values([
    {
      key: "branding",
      value: {
        schoolName: "পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ",
        schoolNameEn: "Panchagarh Government Technical School and College",
        logo: "",
        primary: "#0f7b6c",
        accent: "#f0b429",
        footer: "© পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ",
        contact: "পঞ্চগড় সদর, পঞ্চগড় — ৫০০০",
        lockBranding: true,
      },
    },
  ]);
  return { created: true as const, adminId: admin.id };
}

export async function seedDatabase() {
  const existing = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  if ((existing[0]?.c ?? 0) > 0) {
    // Users already exist — still backfill newly shipped built-in themes.
    const teacherRow = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "teacher"))
      .limit(1);
    const added = await seedTemplates(teacherRow[0]?.id ?? null);
    return { seeded: false, templatesAdded: added };
  }

  const pw = hashPassword(PASSWORD);

  /* Academic structure */
  const classRows = await db
    .insert(classes)
    .values(
      [6, 7, 8, 9, 10, 11, 12].map((n) => ({
        name: `Class ${n}`,
        nameBn: `${n}ম শ্রেণি`,
        level: n,
      })),
    )
    .returning();

  const sectionRows = await db
    .insert(sections)
    .values(classRows.flatMap((c) => ["A", "B"].map((s) => ({ classId: c.id, name: s }))))
    .returning();

  const tradeRows = await db.insert(trades).values(TRADES).returning();

  const subjectRows = await db
    .insert(subjects)
    .values(
      SUBJECTS.map((s, i) => ({
        name: s.name,
        nameBn: s.nameBn,
        color: s.color,
        classId: classRows[Math.min(4, i % classRows.length)].id,
        tradeId: tradeRows[i % tradeRows.length].id,
      })),
    )
    .returning();

  const chapterValues: { subjectId: number; name: string; nameBn: string; orderIndex: number }[] = [];
  for (const s of subjectRows) {
    const list = CHAPTER_MAP[s.name] ?? [];
    list.forEach((c, idx) =>
      chapterValues.push({ subjectId: s.id, name: c.name, nameBn: c.nameBn, orderIndex: idx }),
    );
  }
  const chapterRows = await db.insert(chapters).values(chapterValues).returning();

  const topicValues: { chapterId: number; name: string; nameBn: string }[] = [];
  for (const ch of chapterRows) {
    const subject = subjectRows.find((s) => s.id === ch.subjectId);
    const def = (CHAPTER_MAP[subject?.name ?? ""] ?? []).find((c) => c.name === ch.name);
    (def?.topics ?? []).forEach((t) => topicValues.push({ chapterId: ch.id, name: t, nameBn: t }));
  }
  const topicRows = await db.insert(topics).values(topicValues).returning();

  /* Users */
  const staff = await db
    .insert(users)
    .values([
      { email: "superadmin@pgtsc.edu.bd", name: "Super Admin", nameBn: "সুপার অ্যাডমিন", role: "super_admin", passwordHash: pw },
      { email: "admin@pgtsc.edu.bd", name: "Md. Rezaul Karim", nameBn: "মোঃ রেজাউল করিম", role: "admin", passwordHash: pw },
      { email: "teacher@pgtsc.edu.bd", name: "Engr. Shahidul Islam", nameBn: "ইঞ্জি. শহিদুল ইসলাম", role: "teacher", passwordHash: pw },
      { email: "teacher2@pgtsc.edu.bd", name: "Nasrin Sultana", nameBn: "নাসরিন সুলতানা", role: "teacher", passwordHash: pw },
      { email: "teacher3@pgtsc.edu.bd", name: "Abdul Mannan", nameBn: "আব্দুল মান্নান", role: "teacher", passwordHash: pw },
    ])
    .returning();
  const teacher = staff[2];

  const studentRows = await db
    .insert(users)
    .values(
      STUDENT_NAMES.map((name, i) => {
        const cls = classRows[i % classRows.length];
        return {
          email: `student${i + 1}@pgtsc.edu.bd`,
          studentId: `PG-${2025}${String(100 + i)}`,
          name,
          nameBn: name,
          role: "student",
          passwordHash: pw,
          classId: cls.id,
          sectionId: sectionRows.find((s) => s.classId === cls.id)?.id ?? null,
          tradeId: tradeRows[i % tradeRows.length].id,
          roll: String(i + 1),
          xp: 120 + i * 37,
          level: i % 5 === 0 ? "expert" : i % 3 === 0 ? "skilled" : "learner",
        };
      }),
    )
    .returning();

  const parents = await db
    .insert(users)
    .values([
      { email: "parent@pgtsc.edu.bd", name: "Abdul Halim (Parent)", nameBn: "আব্দুল হালিম", role: "parent", passwordHash: pw },
      { email: "parent2@pgtsc.edu.bd", name: "Rahima Begum (Parent)", nameBn: "রহিমা বেগম", role: "parent", passwordHash: pw },
    ])
    .returning();

  await db.insert(parentLinks).values([
    { parentId: parents[0].id, studentId: studentRows[0].id },
    { parentId: parents[0].id, studentId: studentRows[1].id },
    { parentId: parents[1].id, studentId: studentRows[2].id },
  ]);

  await seedTemplates(teacher.id);

  /* Achievements */
  const achievementRows = await db.insert(achievements).values(ACHIEVEMENTS).returning();

  /* Questions — realistic bank */
  const QUESTION_SEEDS: Record<string, { q: string; opts: string[]; a: number; ex: string }[]> = {
    Computer: [
      { q: "HTML ফর্মে ব্যবহারকারীর ইনপুট গ্রহণ করার জন্য কোন ট্যাগটি ব্যবহৃত হয়?", opts: ["<input>", "<form-data>", "<entry>", "<field>"], a: 0, ex: "<input> ট্যাগ দিয়ে টেক্সট, পাসওয়ার্ড, চেকবক্সসহ নানা ইনপুট নেওয়া যায়।" },
      { q: "HTML ফর্মের ডেটা সার্ভারে পাঠানোর নিরাপদ পদ্ধতি কোনটি?", opts: ["POST", "GET", "PUT অপশন", "LINK"], a: 0, ex: "POST মেথডে ডেটা URL-এ প্রকাশ পায় না, তাই তুলনামূলক নিরাপদ।" },
      { q: "কোন অ্যাট্রিবিউট দিয়ে ফর্ম সাবমিটের গন্তব্য ঠিক করা হয়?", opts: ["action", "target", "src", "method"], a: 0, ex: "action অ্যাট্রিবিউট ফর্ম ডেটা কোথায় যাবে তা নির্ধারণ করে।" },
      { q: "IPv4 ঠিকানা কত বিটের?", opts: ["৩২ বিট", "৬৪ বিট", "১৬ বিট", "১২৮ বিট"], a: 0, ex: "IPv4 ৩২ বিট এবং IPv6 ১২৮ বিটের।" },
      { q: "LAN-এর পূর্ণরূপ কী?", opts: ["Local Area Network", "Long Area Network", "Linked Access Node", "Local Access Number"], a: 0, ex: "LAN = Local Area Network, ছোট ভৌগোলিক এলাকায় ব্যবহৃত।" },
    ],
    Mathematics: [
      { q: "x² - 5x + 6 = 0 সমীকরণের মূলদ্বয় কত?", opts: ["2 এবং 3", "1 এবং 6", "-2 এবং -3", "0 এবং 5"], a: 0, ex: "(x-2)(x-3)=0 তাই x = 2, 3।" },
      { q: "একটি ত্রিভুজের তিন কোণের সমষ্টি কত?", opts: ["১৮০°", "৩৬০°", "৯০°", "২৭০°"], a: 0, ex: "ইউক্লিডীয় জ্যামিতিতে ত্রিভুজের কোণসমষ্টি ১৮০°।" },
      { q: "বৃত্তের পরিধির সূত্র কোনটি?", opts: ["2πr", "πr²", "πd²", "2r"], a: 0, ex: "পরিধি = 2πr, ক্ষেত্রফল = πr²।" },
    ],
    Electronics: [
      { q: "ডায়োড প্রধানত কোন কাজে ব্যবহৃত হয়?", opts: ["একমুখী তড়িৎ প্রবাহ নিশ্চিত করতে", "ভোল্টেজ বাড়াতে", "রেজিস্ট্যান্স বাড়াতে", "শব্দ তৈরি করতে"], a: 0, ex: "ডায়োড কেবল এক দিকে কারেন্ট প্রবাহিত হতে দেয়।" },
      { q: "AND গেটের আউটপুট 1 হবে কখন?", opts: ["সব ইনপুট 1 হলে", "যেকোনো একটি ইনপুট 1 হলে", "সব ইনপুট 0 হলে", "কখনোই নয়"], a: 0, ex: "AND গেটে সব ইনপুট 1 হলেই আউটপুট 1।" },
      { q: "বাইনারি সংখ্যা 1011 এর দশমিক মান কত?", opts: ["11", "13", "9", "15"], a: 0, ex: "8+0+2+1 = 11।" },
    ],
    Electrical: [
      { q: "ওহমের সূত্র অনুযায়ী V = ?", opts: ["I × R", "I / R", "R / I", "I + R"], a: 0, ex: "ভোল্টেজ = কারেন্ট × রেজিস্ট্যান্স।" },
      { q: "সিরিজ সার্কিটে কারেন্টের বৈশিষ্ট্য কী?", opts: ["সব উপাদানে সমান", "প্রতিটিতে ভিন্ন", "শূন্য", "দ্বিগুণ হয়"], a: 0, ex: "সিরিজ সংযোগে কারেন্ট সর্বত্র সমান থাকে।" },
      { q: "হাউস ওয়্যারিং-এ আর্থিং কেন প্রয়োজন?", opts: ["বিদ্যুৎস্পৃষ্ট হওয়া প্রতিরোধ করতে", "বিল কমাতে", "আলো বাড়াতে", "তার সাশ্রয় করতে"], a: 0, ex: "আর্থিং লিকেজ কারেন্ট মাটিতে পাঠিয়ে নিরাপত্তা দেয়।" },
    ],
    English: [
      { q: "Choose the correct sentence.", opts: ["He has been working since morning.", "He has been work since morning.", "He have been working since morning.", "He is been working since morning."], a: 0, ex: "Present perfect continuous: has been + verb-ing." },
      { q: "Fill in the blank: She is good ___ mathematics.", opts: ["at", "in", "on", "for"], a: 0, ex: "'Good at' is the correct collocation." },
    ],
    Bangla: [
      { q: "'বিদ্যালয়' শব্দটির সন্ধি বিচ্ছেদ কোনটি?", opts: ["বিদ্যা + আলয়", "বিদ্য + আলয়", "বিদ্যা + লয়", "বিদ + আলয়"], a: 0, ex: "বিদ্যা + আলয় = বিদ্যালয় (আ + আ = আ)।" },
      { q: "কোনটি তৎপুরুষ সমাসের উদাহরণ?", opts: ["রাজপুত্র", "নীলকমল", "দশানন", "চৌরাস্তা"], a: 0, ex: "রাজপুত্র = রাজার পুত্র, তৎপুরুষ সমাস।" },
    ],
    Physics: [
      { q: "নিউটনের দ্বিতীয় সূত্র অনুযায়ী F = ?", opts: ["ma", "mv", "m/a", "a/m"], a: 0, ex: "বল = ভর × ত্বরণ।" },
    ],
    "IoT Basics": [
      { q: "Arduino Uno-তে ডিজিটাল পিন কতটি?", opts: ["১৪টি", "৮টি", "২০টি", "৬টি"], a: 0, ex: "Arduino Uno-তে ১৪টি ডিজিটাল I/O পিন থাকে।" },
      { q: "তাপমাত্রা মাপার জন্য সাধারণ IoT সেন্সর কোনটি?", opts: ["DHT11", "HC-SR04", "LDR", "IR LED"], a: 0, ex: "DHT11 তাপমাত্রা ও আর্দ্রতা মাপে।" },
    ],
  };

  const questionValues: (typeof questions.$inferInsert)[] = [];
  let counter = 0;
  for (const subject of subjectRows) {
    const seeds = QUESTION_SEEDS[subject.name] ?? [];
    const subjChapters = chapterRows.filter((c) => c.subjectId === subject.id);
    for (let rep = 0; rep < 3; rep++) {
      seeds.forEach((s, idx) => {
        const ch = subjChapters[idx % Math.max(1, subjChapters.length)];
        const tp = topicRows.find((t) => t.chapterId === ch?.id);
        const difficulty = rep === 0 ? "easy" : rep === 1 ? "medium" : "hard";
        questionValues.push({
          text: rep === 0 ? s.q : `${s.q}${rep === 2 ? " (বিশ্লেষণমূলক)" : ""}`,
          type: idx % 7 === 3 ? "true_false" : idx % 5 === 4 ? "multi_select" : "mcq",
          options: idx % 7 === 3 ? ["সত্য", "মিথ্যা"] : s.opts,
          correct: idx % 7 === 3 ? [0] : idx % 5 === 4 ? [s.a, (s.a + 1) % s.opts.length] : [s.a],
          explanation: s.ex,
          hint: "মূল সংজ্ঞা ও ব্যবহারিক প্রয়োগ মনে করুন।",
          objective: `${subject.name} — ${ch?.name ?? ""} বিষয়ে ধারণা যাচাই`,
          difficulty,
          marks: difficulty === "hard" ? 2 : 1,
          timer: difficulty === "hard" ? 45 : difficulty === "medium" ? 30 : 20,
          language: "bn",
          classId: subject.classId,
          tradeId: subject.tradeId,
          subjectId: subject.id,
          chapterId: ch?.id ?? null,
          topicId: tp?.id ?? null,
          createdBy: staff[2 + (counter % 3)].id,
          source: counter % 3 === 0 ? "ai" : "manual",
          status: "published",
          usedCount: counter % 4,
        });
        counter++;
      });
    }
  }
  const questionRows = await db.insert(questions).values(questionValues).returning({ id: questions.id, subjectId: questions.subjectId });

  /* Quizzes */
  const computer = subjectRows.find((s) => s.name === "Computer")!;
  const quizDefs = [
    { title: "ক্লাস ১০ কম্পিউটার — HTML ফর্ম লাইভ কুইজ", mode: "live", settings: DEFAULT_SETTINGS, duration: 15 },
    { title: "মাল্টি-সাবজেক্ট চ্যাম্পিয়নশিপ রাউন্ড", mode: "live", settings: { ...DEFAULT_SETTINGS, scoring: "difficulty", teamMode: true }, duration: 25 },
    { title: "প্রথম সাময়িক পরীক্ষা — ইলেকট্রনিক্স", mode: "exam", settings: EXAM_SETTINGS, duration: 45 },
    { title: "গণিত অনুশীলন সেট", mode: "practice", settings: { ...DEFAULT_SETTINGS, leaderboard: false }, duration: 20 },
    { title: "ইলেকট্রিক্যাল সেফটি কুইজ", mode: "live", settings: DEFAULT_SETTINGS, duration: 12 },
  ];
  const quizRows = await db
    .insert(quizzes)
    .values(
      quizDefs.map((q, i) => ({
        title: q.title,
        description: "পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজের ডেমো কনটেন্ট",
        mode: q.mode,
        classId: classRows[4].id,
        tradeId: tradeRows[i % tradeRows.length].id,
        settings: q.settings,
        status: "published",
        createdBy: staff[2 + (i % 3)].id,
        durationMinutes: q.duration,
        scheduledAt: new Date(Date.now() + (i - 1) * 86400000),
      })),
    )
    .returning();

  const qqValues: (typeof quizQuestions.$inferInsert)[] = [];
  quizRows.forEach((quiz, qi) => {
    const pool =
      qi === 1
        ? questionRows
        : questionRows.filter((q) => q.subjectId === (qi === 2 ? subjectRows.find((s) => s.name === "Electronics")!.id : qi === 3 ? subjectRows.find((s) => s.name === "Mathematics")!.id : qi === 4 ? subjectRows.find((s) => s.name === "Electrical")!.id : computer.id));
    const chosen = (pool.length ? pool : questionRows).slice(0, qi === 1 ? 20 : 10);
    chosen.forEach((q, idx) => qqValues.push({ quizId: quiz.id, questionId: q.id, orderIndex: idx }));
  });
  await db.insert(quizQuestions).values(qqValues);

  /* Results + feedback */
  const resultValues: (typeof quizResults.$inferInsert)[] = [];
  studentRows.slice(0, 18).forEach((st, i) => {
    quizRows.slice(0, 3).forEach((quiz, qi) => {
      const score = 45 + ((i * 7 + qi * 13) % 55);
      resultValues.push({
        quizId: quiz.id,
        userId: st.id,
        playerName: st.name,
        score,
        accuracy: score,
        rank: (i % 10) + 1,
        totalQuestions: 10,
        correctCount: Math.round(score / 10),
        subjectBreakdown: { Computer: 88, Mathematics: 81, Electronics: 76, Electrical: 84, English: 90 },
      });
    });
  });
  await db.insert(quizResults).values(resultValues);

  await db.insert(feedback).values(
    studentRows.slice(0, 12).map((st, i) => ({
      quizId: quizRows[i % 3].id,
      userId: st.id,
      playerName: st.name,
      overall: 3 + (i % 3),
      difficulty: 2 + (i % 4),
      timerRating: 2 + (i % 3),
      quality: 3 + (i % 3),
      engagement: 3 + (i % 3),
      comment: pick(
        [
          "প্রশ্নগুলো খুব ভালো ছিল, আরও সময় দিলে ভালো হতো।",
          "লাইভ কুইজ খুব মজার ছিল!",
          "কিছু প্রশ্ন একটু কঠিন লেগেছে।",
          "ব্যাখ্যাগুলো শিখতে সাহায্য করেছে।",
        ],
        i,
      ),
    })),
  );

  await db.insert(studentAchievements).values(
    studentRows.slice(0, 10).map((st, i) => ({
      userId: st.id,
      achievementId: achievementRows[i % achievementRows.length].id,
    })),
  );

  await db.insert(notifications).values([
    { userId: teacher.id, title: "নতুন ফিডব্যাক এসেছে", body: "HTML ফর্ম কুইজে ১২টি নতুন ফিডব্যাক", kind: "info", link: "/teacher/reports" },
    { userId: teacher.id, title: "আসন্ন পরীক্ষা", body: "প্রথম সাময়িক পরীক্ষা — ইলেকট্রনিক্স আগামীকাল", kind: "exam", link: "/teacher/quizzes" },
    { userId: studentRows[0].id, title: "নতুন কুইজ প্রকাশিত", body: "ক্লাস ১০ কম্পিউটার — HTML ফর্ম", kind: "quiz", link: "/student/quizzes" },
    { userId: studentRows[0].id, title: "অর্জন আনলক!", body: "আপনি '১০ স্ট্রিক' ব্যাজ পেয়েছেন", kind: "achievement", link: "/student/achievements" },
  ]);

  await db.insert(settings).values([
    {
      key: "branding",
      value: {
        schoolName: "পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ",
        schoolNameEn: "Panchagarh Government Technical School and College",
        logo: "",
        primary: "#0f7b6c",
        accent: "#f0b429",
        footer: "© পঞ্চগড় সরকারি কারিগরি স্কুল ও কলেজ | কারিগরি শিক্ষা অধিদপ্তর",
        contact: "পঞ্চগড় সদর, পঞ্চগড় — ৫০০০ | info@pgtsc.edu.bd",
        lockBranding: true,
      },
    },
    { key: "features", value: { guestJoin: true, xpEnabled: true, reactions: true } },
  ]);

  return { seeded: true, users: studentRows.length + staff.length + parents.length };
}
