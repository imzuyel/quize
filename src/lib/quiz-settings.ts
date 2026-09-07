/** Pure quiz configuration + scoring helpers — safe to import from client code. */

export type QuizSettings = {
  scoring: "standard" | "speed" | "difficulty" | "custom";
  basePoints: number;
  speedBonus: number;
  streakBonus: boolean;
  streakStep: number;
  powerUps: Record<string, boolean>;
  reactions: boolean;
  leaderboard: boolean;
  leaderboardSize: number;
  cinematicIntro: boolean;
  showExplanation: boolean;
  revealAnswer: boolean;
  autoAdvance: boolean;
  timerMode: "global" | "per_question" | "per_round";
  globalTimer: number;
  /** Extra seconds added on top of the summed question timers in exam mode. */
  examBufferSeconds: number;
  timerStyle: "circular" | "linear" | "digital" | "flip" | "pulse" | "minimal";
  motion: "low" | "medium" | "high";
  sound: boolean;
  teamMode: boolean;
  teamCount: number;
  nicknameMode: boolean;
  guestJoin: boolean;
  negativeMarking: number;
  passMark: number;
  randomQuestions: boolean;
  randomOptions: boolean;
  feedbackEnabled: boolean;
  feedbackRequired: boolean;
  templateId?: number | null;
};

export const DEFAULT_SETTINGS: QuizSettings = {
  scoring: "speed",
  basePoints: 1000,
  speedBonus: 500,
  streakBonus: true,
  streakStep: 3,
  powerUps: {
    double_points: false,
    shield: false,
    extra_time: false,
    fifty_fifty: false,
    streak_multiplier: false,
    accuracy_bonus: false,
  },
  reactions: true,
  leaderboard: true,
  leaderboardSize: 10,
  cinematicIntro: true,
  showExplanation: true,
  revealAnswer: true,
  autoAdvance: false,
  timerMode: "per_question",
  globalTimer: 30,
  examBufferSeconds: 60,
  timerStyle: "circular",
  motion: "medium",
  sound: true,
  teamMode: false,
  teamCount: 4,
  nicknameMode: true,
  guestJoin: true,
  negativeMarking: 0,
  passMark: 33,
  randomQuestions: false,
  randomOptions: false,
  feedbackEnabled: true,
  feedbackRequired: false,
  templateId: null,
};

export const EXAM_SETTINGS: QuizSettings = {
  ...DEFAULT_SETTINGS,
  scoring: "standard",
  speedBonus: 0,
  streakBonus: false,
  powerUps: {
    double_points: false,
    shield: false,
    extra_time: false,
    fifty_fifty: false,
    streak_multiplier: false,
    accuracy_bonus: false,
  },
  reactions: false,
  leaderboard: false,
  cinematicIntro: false,
  revealAnswer: false,
  showExplanation: false,
  motion: "low",
  sound: false,
  randomQuestions: true,
  randomOptions: true,
  // Exams also follow each question's own timer; total time is the sum.
  timerMode: "per_question",
};

export function mergeSettings(raw: unknown): QuizSettings {
  return { ...DEFAULT_SETTINGS, ...((raw as Partial<QuizSettings>) ?? {}) };
}

export type LiveQuestion = {
  id: number;
  index: number;
  text: string;
  type: string;
  options: string[];
  marks: number;
  timer: number;
  difficulty: string;
  subjectId: number | null;
  media: unknown;
  hint: string | null;
  explanation: string | null;
  correct: (string | number)[];
};

export type Snapshot = {
  session: {
    id: number;
    pin: string;
    state: string;
    currentIndex: number;
    total: number;
    lobbyLocked: boolean;
    showLeaderboard: boolean;
    teamMode: boolean;
    endsAt: string | null;
    startedAt: string | null;
    paused: boolean;
    version: number;
  };
  quiz: { id: number; title: string; description: string | null; settings: QuizSettings };
  theme: unknown;
  question:
    | (Omit<LiveQuestion, "correct"> & { correct?: (string | number)[]; revealed: boolean })
    | null;
  players: {
    id: number;
    nickname: string;
    score: number;
    streak: number;
    correctCount: number;
    answeredCount: number;
    teamId: number | null;
    connected: boolean;
  }[];
  teams: { id: number; name: string; color: string; icon: string; score: number }[];
  /** Per-option pick counts for the current question (host tally, revealed only). */
  tally: number[];
  answeredCount: number;
  /** Player IDs who have submitted — safe to show before the reveal. */
  answeredBy: number[];
  /** Each player's outcome on the current question — drives reveal animations. */
  outcomes: Record<number, { correct: boolean; points: number; answer: (string | number)[] }>;
};

export function isAnswerCorrect(q: LiveQuestion, answer: unknown): boolean {
  const correct = q.correct ?? [];
  if (!correct.length) return false;
  const norm = (v: unknown) => String(v).trim().toLowerCase();
  switch (q.type) {
    case "categorize":
    case "multi_select":
    case "matching":
    case "ordering":
    case "ranking": {
      const arr = Array.isArray(answer) ? answer.map(norm) : [];
      const exp = correct.map(norm);
      if (q.type === "ordering" || q.type === "ranking" || q.type === "categorize")
        return arr.length === exp.length && arr.every((v, i) => v === exp[i]);
      return arr.length === exp.length && exp.every((v) => arr.includes(v));
    }
    case "short_answer":
    case "fill_blank":
    case "word_cloud":
    case "word_jumble":
    case "crossword":
    case "riddle": {
      const a = norm(Array.isArray(answer) ? answer[0] : answer);
      return correct.some((c) => norm(c) === a || a.includes(norm(c)));
    }
    case "slider": {
      const a = Number(Array.isArray(answer) ? answer[0] : answer);
      return Math.abs(a - Number(correct[0])) <= 5;
    }
    case "poll":
      return true;
    default: {
      const a = norm(Array.isArray(answer) ? answer[0] : answer);
      return correct.some((c) => norm(c) === a);
    }
  }
}

export function computePoints(opts: {
  settings: QuizSettings;
  question: LiveQuestion;
  correct: boolean;
  responseMs: number;
  streak: number;
  doublePoints?: boolean;
}): number {
  const { settings, question, correct, responseMs, streak } = opts;
  if (!correct) return 0;
  const timerMs = Math.max(1, question.timer * 1000);
  const ratio = Math.max(0, Math.min(1, 1 - responseMs / timerMs));
  let points = 0;
  switch (settings.scoring) {
    case "standard":
      points = settings.basePoints;
      break;
    case "speed":
      points = settings.basePoints + Math.round(settings.speedBonus * ratio);
      break;
    case "difficulty":
      points =
        settings.basePoints *
        (question.difficulty === "hard" ? 2 : question.difficulty === "medium" ? 1.5 : 1);
      break;
    default:
      points = settings.basePoints * question.marks;
  }
  if (settings.streakBonus && streak > 0 && streak % settings.streakStep === 0)
    points = Math.round(points * 1.25);
  if (opts.doublePoints) points *= 2;
  return Math.round(points);
}

/**
 * Total exam time = sum of every question's own timer (+ a small buffer for
 * reading and navigation). There is no fixed overall duration any more, so a
 * longer paper automatically gets proportionally more time.
 */
export function computeExamSeconds(
  questions: { timer: number }[],
  settings: QuizSettings,
): number {
  if (!questions.length) return 60;
  const sum = questions.reduce(
    (total, q) => total + Math.max(5, Math.min(300, Number(q.timer) || settings.globalTimer || 30)),
    0,
  );
  const buffer = Math.max(0, Number(settings.examBufferSeconds) || 0);
  return Math.max(60, sum + buffer);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m && s) return `${m} মিনিট ${s} সেকেন্ড`;
  if (m) return `${m} মিনিট`;
  return `${s} সেকেন্ড`;
}

export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
