/**
 * Classical Test Theory item analysis.
 *
 * These are the standard measures examination boards use to judge whether a
 * question is actually doing its job:
 *
 *  • p-value (difficulty index) — fraction who answered correctly.
 *      >0.90 = too easy, <0.30 = too hard, 0.40-0.80 = healthy.
 *  • Discrimination index (D) — do strong students outperform weak ones on
 *      this item? Computed from the top vs bottom 27% of scorers.
 *      >0.40 excellent, 0.20-0.39 acceptable, <0.10 or negative = broken.
 *  • Point-biserial (rpb) — correlation between item score and total score.
 *  • Distractor analysis — which wrong options actually attract anyone.
 *
 * Pure functions so they can run on the server or be unit-tested.
 */

export type Response = {
  playerId: number;
  questionId: number;
  correct: boolean;
  /** Chosen option index, when the type has options. */
  choice?: number | null;
};

export type ItemStat = {
  questionId: number;
  attempts: number;
  correct: number;
  /** 0-1 difficulty index. Higher = easier. */
  pValue: number;
  /** -1..1 discrimination. Higher = better at separating strong/weak. */
  discrimination: number;
  /** Point-biserial correlation, -1..1. */
  pointBiserial: number;
  verdict: "excellent" | "good" | "review" | "poor" | "insufficient";
  advice: string;
  distractors: { choice: number; count: number; share: number; isCorrect: boolean }[];
};

const MIN_SAMPLE = 5;

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdDev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/**
 * @param responses every answer row for the quiz/session being analysed
 * @param correctChoice map of questionId → correct option index (for distractors)
 */
export function analyseItems(
  responses: Response[],
  correctChoice: Map<number, number[]> = new Map(),
): ItemStat[] {
  if (!responses.length) return [];

  // Total score per learner, used to rank them.
  const byPlayer = new Map<number, { correct: number; total: number }>();
  for (const r of responses) {
    const cur = byPlayer.get(r.playerId) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (r.correct) cur.correct += 1;
    byPlayer.set(r.playerId, cur);
  }

  const ranked = [...byPlayer.entries()]
    .map(([playerId, v]) => ({ playerId, score: v.total ? v.correct / v.total : 0 }))
    .sort((a, b) => b.score - a.score);

  // Classic 27% upper/lower split; fall back to halves for tiny cohorts.
  const groupSize = Math.max(1, Math.round(ranked.length * 0.27));
  const upper = new Set(ranked.slice(0, groupSize).map((r) => r.playerId));
  const lower = new Set(ranked.slice(-groupSize).map((r) => r.playerId));
  const scoreOf = new Map(ranked.map((r) => [r.playerId, r.score]));

  const byQuestion = new Map<number, Response[]>();
  for (const r of responses) {
    const list = byQuestion.get(r.questionId) ?? [];
    list.push(r);
    byQuestion.set(r.questionId, list);
  }

  const stats: ItemStat[] = [];

  for (const [questionId, rows] of byQuestion) {
    const attempts = rows.length;
    const correct = rows.filter((r) => r.correct).length;
    const pValue = attempts ? correct / attempts : 0;

    const upperRows = rows.filter((r) => upper.has(r.playerId));
    const lowerRows = rows.filter((r) => lower.has(r.playerId));
    const pUpper = upperRows.length ? upperRows.filter((r) => r.correct).length / upperRows.length : 0;
    const pLower = lowerRows.length ? lowerRows.filter((r) => r.correct).length / lowerRows.length : 0;
    const discrimination = Number((pUpper - pLower).toFixed(3));

    // Point-biserial: how total score differs between right and wrong answerers.
    const rightScores = rows.filter((r) => r.correct).map((r) => scoreOf.get(r.playerId) ?? 0);
    const wrongScores = rows.filter((r) => !r.correct).map((r) => scoreOf.get(r.playerId) ?? 0);
    const allScores = rows.map((r) => scoreOf.get(r.playerId) ?? 0);
    const sd = stdDev(allScores);
    const p = pValue;
    const pointBiserial =
      sd > 0 && rightScores.length && wrongScores.length
        ? Number((((mean(rightScores) - mean(wrongScores)) / sd) * Math.sqrt(p * (1 - p))).toFixed(3))
        : 0;

    // Distractor spread — a wrong option nobody picks is dead weight.
    const correctIdx = correctChoice.get(questionId) ?? [];
    const counts = new Map<number, number>();
    for (const r of rows) {
      if (r.choice === null || r.choice === undefined) continue;
      counts.set(r.choice, (counts.get(r.choice) ?? 0) + 1);
    }
    const distractors = [...counts.entries()]
      .map(([choice, count]) => ({
        choice,
        count,
        share: attempts ? Number((count / attempts).toFixed(3)) : 0,
        isCorrect: correctIdx.includes(choice),
      }))
      .sort((a, b) => a.choice - b.choice);

    let verdict: ItemStat["verdict"];
    let advice: string;

    if (attempts < MIN_SAMPLE) {
      verdict = "insufficient";
      advice = `আরও ${MIN_SAMPLE - attempts} জন উত্তর দিলে বিশ্লেষণ নির্ভরযোগ্য হবে।`;
    } else if (discrimination < 0) {
      verdict = "poor";
      advice = "⚠️ দুর্বল শিক্ষার্থীরা বেশি সঠিক উত্তর দিয়েছে — সঠিক উত্তর বা প্রশ্নটি ভুল হতে পারে।";
    } else if (pValue > 0.92) {
      verdict = "review";
      advice = "প্রায় সবাই পেরেছে — খুব সহজ। কঠিন করুন বা অনুশীলনে সরান।";
    } else if (pValue < 0.25) {
      verdict = "review";
      advice = "খুব কম শিক্ষার্থী পেরেছে — প্রশ্নটি অস্পষ্ট বা বিষয়টি পড়ানো হয়নি।";
    } else if (discrimination < 0.15) {
      verdict = "poor";
      advice = "ভালো ও দুর্বল শিক্ষার্থী একই রকম ফল করেছে — প্রশ্নটি আলাদা করতে পারছে না।";
    } else if (discrimination >= 0.4 && pValue >= 0.35 && pValue <= 0.85) {
      verdict = "excellent";
      advice = "✅ চমৎকার প্রশ্ন — কঠিনতা ও পার্থক্যকরণ দুটোই আদর্শ।";
    } else {
      verdict = "good";
      advice = "গ্রহণযোগ্য প্রশ্ন। চাইলে অপশনগুলো আরও শক্তিশালী করতে পারেন।";
    }

    // Flag dead distractors on otherwise fine items.
    const dead = distractors.filter((d) => !d.isCorrect && d.count === 0);
    if (dead.length && attempts >= MIN_SAMPLE && verdict !== "poor") {
      advice += ` ${dead.length}টি অপশন কেউ বাছেনি — সেগুলো আরও বিশ্বাসযোগ্য করুন।`;
    }

    stats.push({
      questionId,
      attempts,
      correct,
      pValue: Number(pValue.toFixed(3)),
      discrimination,
      pointBiserial,
      verdict,
      advice,
      distractors,
    });
  }

  return stats.sort((a, b) => a.discrimination - b.discrimination);
}

/** Cronbach's alpha — how internally consistent the whole paper is. */
export function reliability(responses: Response[]): { alpha: number; label: string } {
  const items = [...new Set(responses.map((r) => r.questionId))];
  const players = [...new Set(responses.map((r) => r.playerId))];
  if (items.length < 2 || players.length < 3) return { alpha: 0, label: "অপর্যাপ্ত ডেটা" };

  const key = (p: number, q: number) => `${p}:${q}`;
  const lookup = new Map(responses.map((r) => [key(r.playerId, r.questionId), r.correct ? 1 : 0]));

  const itemVariances = items.map((q) => {
    const xs = players.map((p) => lookup.get(key(p, q)) ?? 0);
    return stdDev(xs) ** 2;
  });
  const totals = players.map((p) => items.reduce((s, q) => s + (lookup.get(key(p, q)) ?? 0), 0));
  const totalVariance = stdDev(totals) ** 2;
  if (totalVariance === 0) return { alpha: 0, label: "অপর্যাপ্ত বৈচিত্র্য" };

  const k = items.length;
  const alpha = (k / (k - 1)) * (1 - itemVariances.reduce((a, b) => a + b, 0) / totalVariance);
  const rounded = Number(Math.max(0, Math.min(1, alpha)).toFixed(3));

  const label =
    rounded >= 0.9 ? "চমৎকার" :
    rounded >= 0.8 ? "খুব ভালো" :
    rounded >= 0.7 ? "গ্রহণযোগ্য" :
    rounded >= 0.6 ? "দুর্বল" : "অগ্রহণযোগ্য";

  return { alpha: rounded, label };
}

export const VERDICT_META: Record<ItemStat["verdict"], { label: string; tone: string; icon: string }> = {
  excellent: { label: "চমৎকার", tone: "green", icon: "🌟" },
  good: { label: "ভালো", tone: "teal", icon: "✅" },
  review: { label: "পর্যালোচনা", tone: "gold", icon: "⚠️" },
  poor: { label: "সমস্যাযুক্ত", tone: "coral", icon: "🔴" },
  insufficient: { label: "ডেটা কম", tone: "slate", icon: "📊" },
};
