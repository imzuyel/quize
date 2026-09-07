/**
 * Paste-to-quiz parser.
 * Accepts the formats teachers actually have lying around:
 *   • Kahoot / Excel style CSV, TSV or pipe rows
 *   • Numbered blocks with A) B) C) D) and an "Answer:" line
 *   • Options marked with a leading * or ✔
 *   • True/False and short-answer pairs
 * Everything is pure so it can run on the server or in the browser preview.
 */

export type ParsedQuestion = {
  text: string;
  type: string;
  options: string[];
  correct: (string | number)[];
  explanation: string;
  hint: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  timer: number;
  language: string;
};

export type ParseDefaults = {
  difficulty?: "easy" | "medium" | "hard";
  marks?: number;
  timer?: number;
  language?: string;
};

export type ParseReport = {
  questions: ParsedQuestion[];
  skipped: number;
  format: "csv" | "block" | "mixed" | "none";
  warnings: string[];
};

const ANSWER_KEYS = /^(answer|ans|correct|solution|সঠিক\s*উত্তর|উত্তর)\s*[:：\-–]\s*/i;
const EXPLAIN_KEYS = /^(explanation|explain|reason|rationale|ব্যাখ্যা|কারণ)\s*[:：\-–]\s*/i;
const HINT_KEYS = /^(hint|clue|হিন্ট|ইঙ্গিত|সূত্র)\s*[:：\-–]\s*/i;
const QUESTION_KEYS = /^(q(uestion)?\s*\d*|প্রশ্ন\s*[০-৯\d]*)\s*[:：.)\-–]\s*/i;
const OPTION_LINE = /^\s*(?:[*✔✓]\s*)?(?:\(?([a-হA-F১-৬0-9])\)|([a-fA-F১-৬0-9])[.)])\s+(.+)$/;
const LEADING_NUM = /^\s*[(\[]?([0-9০-৯]{1,3})[).\]।]\s*/;
const TRUE_WORDS = /^(true|t|সত্য|হ্যাঁ|ঠিক)$/i;
const FALSE_WORDS = /^(false|f|মিথ্যা|না|ভুল)$/i;

function stripStar(s: string) {
  return s.replace(/^[\s*✔✓]+/, "").trim();
}

function isStarred(s: string) {
  return /^[\s]*[*✔✓]/.test(s);
}

/** Convert "B", "2", "খ" etc. into a zero-based option index. */
function answerToIndex(token: string, options: string[]): number {
  const t = token.trim().replace(/[.)\]]$/, "");
  if (!t) return -1;
  const bn = "কখগঘঙচ".indexOf(t);
  if (bn >= 0) return bn;
  if (/^[a-fA-F]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 65;
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  const norm = t.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
  if (/^\d+$/.test(norm)) {
    const n = parseInt(norm, 10);
    if (n >= 1 && n <= options.length) return n - 1;
    if (n === 0 && options.length) return 0;
  }
  const exact = options.findIndex((o) => o.trim().toLowerCase() === t.toLowerCase());
  return exact;
}

function detectDelimiter(lines: string[]): string | null {
  const candidates = ["\t", "|", ";", ","];
  for (const d of candidates) {
    const counts = lines.slice(0, 12).map((l) => l.split(d).length);
    const good = counts.filter((c) => c >= 3).length;
    if (good >= Math.max(1, Math.floor(lines.slice(0, 12).length * 0.6))) return d;
  }
  return null;
}

function splitCsvLine(line: string, delim: string): string[] {
  if (delim !== ",") return line.split(delim).map((c) => c.trim());
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function finish(q: Partial<ParsedQuestion>, d: ParseDefaults): ParsedQuestion | null {
  const text = (q.text ?? "").trim();
  if (text.length < 3) return null;
  let options = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
  let correct = q.correct ?? [];
  let type = q.type ?? "mcq";

  // True/False shorthand
  if (!options.length && correct.length === 1 && typeof correct[0] === "string") {
    const c = String(correct[0]);
    if (TRUE_WORDS.test(c) || FALSE_WORDS.test(c)) {
      options = ["True", "False"];
      correct = [TRUE_WORDS.test(c) ? 0 : 1];
      type = "true_false";
    }
  }
  if (options.length === 2 && options.every((o) => TRUE_WORDS.test(o) || FALSE_WORDS.test(o)))
    type = "true_false";
  if (!options.length) type = "short_answer";
  else if (correct.length > 1) type = "multi_select";

  if (options.length && !correct.length) correct = [0];

  return {
    text,
    type,
    options,
    correct,
    explanation: (q.explanation ?? "").trim(),
    hint: (q.hint ?? "").trim(),
    difficulty: q.difficulty ?? d.difficulty ?? "medium",
    marks: q.marks ?? d.marks ?? 1,
    timer: Math.min(300, Math.max(5, q.timer ?? d.timer ?? 30)),
    language: q.language ?? d.language ?? "bn",
  };
}

/* ------------------------------- CSV path ------------------------------- */

function parseCsv(lines: string[], delim: string, d: ParseDefaults): ParseReport {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];
  let skipped = 0;

  const first = splitCsvLine(lines[0], delim).map((c) => c.toLowerCase());
  const hasHeader = first.some((c) => /question|প্রশ্ন/.test(c));
  const idx = {
    question: -1,
    answer: -1,
    time: -1,
    explanation: -1,
    hint: -1,
    options: [] as number[],
  };

  if (hasHeader) {
    first.forEach((c, i) => {
      if (/question|প্রশ্ন/.test(c)) idx.question = i;
      else if (/correct|answer|সঠিক|উত্তর/.test(c)) idx.answer = i;
      else if (/time|second|সময়|টাইমার/.test(c)) idx.time = i;
      else if (/explan|ব্যাখ্যা/.test(c)) idx.explanation = i;
      else if (/hint|হিন্ট/.test(c)) idx.hint = i;
      else if (/option|answer\s*\d|choice|বিকল্প|অপশন/.test(c)) idx.options.push(i);
    });
    if (idx.question < 0) idx.question = 0;
  }

  for (let li = hasHeader ? 1 : 0; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li], delim).filter((c, i, a) => !(i === a.length - 1 && c === ""));
    if (cells.length < 2) {
      if (lines[li].trim()) skipped++;
      continue;
    }

    let text: string;
    let options: string[];
    let answerCell = "";
    let timer = d.timer ?? 30;
    let explanation = "";
    let hint = "";

    if (hasHeader) {
      text = cells[idx.question] ?? "";
      options = (idx.options.length ? idx.options : cells.map((_, i) => i).filter((i) => i !== idx.question && i !== idx.answer && i !== idx.time && i !== idx.explanation && i !== idx.hint))
        .map((i) => cells[i] ?? "")
        .filter(Boolean);
      answerCell = idx.answer >= 0 ? cells[idx.answer] ?? "" : "";
      if (idx.time >= 0 && cells[idx.time]) timer = Number(cells[idx.time]) || timer;
      explanation = idx.explanation >= 0 ? cells[idx.explanation] ?? "" : "";
      hint = idx.hint >= 0 ? cells[idx.hint] ?? "" : "";
    } else {
      text = cells[0];
      const rest = cells.slice(1);
      // A trailing pure number is a time limit.
      if (rest.length > 2 && /^\d{1,3}$/.test(rest[rest.length - 1]) && Number(rest[rest.length - 1]) <= 300) {
        timer = Number(rest.pop());
      }
      // A short trailing token that names an answer.
      const last = rest[rest.length - 1] ?? "";
      if (rest.length > 2 && last.length <= 24 && /^([a-fA-F1-6১-৬কখগঘ]|true|false|সত্য|মিথ্যা)([,\s/]+[a-fA-F1-6১-৬])*$/i.test(last.trim())) {
        answerCell = String(rest.pop());
      }
      options = rest.filter(Boolean);
    }

    // Options may carry a * to mark the correct one.
    const starred: number[] = [];
    options = options.map((o, i) => {
      if (isStarred(o)) starred.push(i);
      return stripStar(o);
    });

    let correct: (string | number)[] = starred;
    if (!correct.length && answerCell) {
      correct = answerCell
        .split(/[,;/]+|\s{2,}/)
        .map((tok) => answerToIndex(tok, options))
        .filter((n) => n >= 0);
      if (!correct.length) correct = [answerCell.trim()];
    }

    const q = finish({ text, options, correct, timer, explanation, hint }, d);
    if (q) questions.push(q);
    else skipped++;
  }

  if (!hasHeader && questions.length)
    warnings.push("হেডার সারি পাওয়া যায়নি — প্রথম কলামকে প্রশ্ন ধরা হয়েছে।");
  return { questions, skipped, format: "csv", warnings };
}

/* ------------------------------ Block path ------------------------------ */

function parseBlocks(raw: string, d: ParseDefaults): ParseReport {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];
  let skipped = 0;

  const lines = raw.split(/\r?\n/);
  type Draft = Partial<ParsedQuestion> & { options: string[]; correct: (string | number)[] };
  let cur: Draft | null = null;
  let answered = false;
  const starred: number[] = [];

  const flush = () => {
    if (!cur) return;
    if (starred.length) cur.correct = [...starred];
    const q = finish(cur, d);
    if (q) questions.push(q);
    else if ((cur.text ?? "").trim()) skipped++;
    cur = null;
    answered = false;
    starred.length = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const optMatch = OPTION_LINE.exec(line);
    // "2. Question text" also matches the option pattern, so a numeric marker
    // only counts as an option while it continues the current question's list.
    const numeric = LEADING_NUM.exec(line);
    const numericValue = numeric
      ? parseInt(numeric[1].replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))), 10)
      : NaN;
    const continuesOptionList =
      Boolean(numeric) && Boolean(cur) && numericValue === (cur as Draft).options.length + 1;
    const looksNumberedQuestion = Boolean(numeric) && !continuesOptionList;

    if (ANSWER_KEYS.test(line)) {
      if (!cur) continue;
      const val = line.replace(ANSWER_KEYS, "").trim();
      const parts = val.split(/[,;/]+/).map((p) => p.trim()).filter(Boolean);
      const idxs = parts.map((p) => answerToIndex(p, cur!.options)).filter((n) => n >= 0);
      cur.correct = idxs.length ? idxs : [val];
      answered = true;
      continue;
    }
    if (EXPLAIN_KEYS.test(line)) {
      if (cur) cur.explanation = line.replace(EXPLAIN_KEYS, "").trim();
      continue;
    }
    if (HINT_KEYS.test(line)) {
      if (cur) cur.hint = line.replace(HINT_KEYS, "").trim();
      continue;
    }

    if (optMatch && cur && !looksNumberedQuestion) {
      const body = optMatch[3];
      if (isStarred(line)) starred.push(cur.options.length);
      cur.options.push(stripStar(body));
      continue;
    }

    // A new question starts here: explicit marker, numbering, nothing open yet,
    // or the previous question already received its answer line.
    if (QUESTION_KEYS.test(line) || looksNumberedQuestion || !cur || answered) {
      flush();
      answered = false;
      const text = line.replace(QUESTION_KEYS, "").replace(LEADING_NUM, "").trim();
      cur = { text, options: [], correct: [] };
      continue;
    }

    // Continuation of the current question text (only before options appear).
    if (cur && !cur.options.length) cur.text = `${cur.text} ${line}`.trim();
    else {
      if (isStarred(line)) starred.push(cur!.options.length);
      cur!.options.push(stripStar(line));
    }
  }
  flush();

  const noAnswer = questions.filter((q) => q.options.length && q.correct.length === 1 && q.correct[0] === 0).length;
  if (noAnswer > questions.length / 2 && questions.length > 1)
    warnings.push('অনেক প্রশ্নে সঠিক উত্তর পাওয়া যায়নি — প্রথম অপশনকে সঠিক ধরা হয়েছে। "Answer: B" লাইন বা * চিহ্ন যোগ করুন।');

  return { questions, skipped, format: "block", warnings };
}

/* -------------------------------- Public -------------------------------- */

export function parseQuestions(raw: string, defaults: ParseDefaults = {}): ParseReport {
  const text = (raw ?? "").replace(/\u00a0/g, " ").trim();
  if (!text) return { questions: [], skipped: 0, format: "none", warnings: [] };

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const delim = detectDelimiter(lines);

  if (delim) {
    const csv = parseCsv(lines, delim, defaults);
    if (csv.questions.length) return csv;
  }
  const blocks = parseBlocks(text, defaults);
  if (blocks.questions.length) return blocks;
  return {
    questions: [],
    skipped: lines.length,
    format: "none",
    warnings: ["কোনো প্রশ্ন শনাক্ত করা যায়নি — নিচের উদাহরণ ফরম্যাট অনুসরণ করুন।"],
  };
}

export const PASTE_EXAMPLE = `১. বাংলাদেশের রাজধানী কোনটি?
A) চট্টগ্রাম
B) ঢাকা
C) খুলনা
D) রাজশাহী
Answer: B
ব্যাখ্যা: ঢাকা বাংলাদেশের রাজধানী ও বৃহত্তম শহর।

2. HTML ফর্মে ইনপুট নিতে কোন ট্যাগ ব্যবহৃত হয়?
A) <input>
B) <entry>
C) <field>
Answer: A`;

export const PASTE_EXAMPLE_CSV = `Question,Option1,Option2,Option3,Option4,Answer,Time
বাংলাদেশের রাজধানী কোনটি?,চট্টগ্রাম,ঢাকা,খুলনা,রাজশাহী,B,30
পানির রাসায়নিক সংকেত কী?,H2O,CO2,O2,NaCl,1,20`;
