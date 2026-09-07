"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Modal, Textarea, useToast, cx } from "@/components/ui";
import { Leaderboard, QuizTimer, REACTIONS, StreakBanner } from "@/components/quiz";
import { Celebration, ThemeStage, ThemedCard } from "@/components/theme-stage";
import { QuestionInput } from "@/components/interactive";
import { AnswerFeedback, ScorePop, type RevealKind } from "@/components/reveal";
import { mergeTemplate } from "@/lib/theme";
import { liveAction, useLiveSession } from "@/lib/useLive";

const SINGLE_CHOICE = ["mcq", "true_false", "image_choice", "scenario", "case_based", "hotspot", "audio", "video", "odd_one_out", "analogy"];
function isSingleChoice(type: string) {
  return SINGLE_CHOICE.includes(type);
}

export default function PlayPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params);
  const { snapshot, status, reactions } = useLiveSession(pin);
  const { push } = useToast();
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [answerValue, setAnswerValue] = useState<(string | number)[]>([]);
  const [submittedIndex, setSubmittedIndex] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [revealKind, setRevealKind] = useState<RevealKind>(null);
  const [revealPoints, setRevealPoints] = useState(0);
  const [scorePop, setScorePop] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem(`pg_player_${pin}`);
    if (id) setPlayerId(Number(id));
  }, [pin]);

  useEffect(() => {
    if (!playerId) return;
    const id = setInterval(() => {
      liveAction({ action: "heartbeat", pin, playerId }).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [playerId, pin]);

  const q = snapshot?.question;
  const settings = snapshot?.quiz.settings;
  const me = snapshot?.players.find((p) => p.id === playerId);
  const state = snapshot?.session.state ?? "lobby";

  useEffect(() => {
    setAnswerValue([]);
    setHidden([]);
  }, [snapshot?.session.currentIndex]);

  const answered = submittedIndex === snapshot?.session.currentIndex;
  const outcome = playerId ? snapshot?.outcomes?.[playerId] : undefined;
  const revealedIndex = q?.revealed ? snapshot?.session.currentIndex : undefined;

  // Fire the celebration/shake exactly once per revealed question.
  useEffect(() => {
    if (revealedIndex === undefined || !playerId) return;
    const key = `rv_${pin}_${revealedIndex}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    if (!outcome) {
      setRevealKind("timeout");
      return;
    }
    setRevealKind(outcome.correct ? "correct" : "wrong");
    setRevealPoints(outcome.points);
    if (outcome.points > 0) {
      setScorePop(outcome.points);
      setTimeout(() => setScorePop(0), 1600);
    }
  }, [revealedIndex, outcome, playerId, pin]);

  const submit = async () => {
    if (!playerId || !q) return;
    const answer = answerValue;
    if (!answer.length || (typeof answer[0] === "string" && !String(answer[0]).trim()))
      return push("একটি উত্তর দিন", "error");
    try {
      await liveAction({ action: "answer", pin, playerId, answer });
      setSubmittedIndex(snapshot!.session.currentIndex);
      push("উত্তর জমা হয়েছে ✅", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    }
  };

  const usePower = async (kind: string) => {
    try {
      const res = (await liveAction({ action: "powerup", pin, playerId, kind })) as { hidden?: number[] };
      if (res.hidden?.length) setHidden(res.hidden);
      push("পাওয়ার-আপ ব্যবহৃত!", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    }
  };

  const availablePowerUps = useMemo(
    () => Object.entries(settings?.powerUps ?? {}).filter(([, v]) => v).map(([k]) => k),
    [settings],
  );

  if (!playerId)
    return (
      <div className="pg-hero-bg grid min-h-screen place-items-center p-6 text-center text-white">
        <div>
          <p className="text-lg font-bold">আপনি এখনো এই সেশনে যোগ দেননি</p>
          <Link href={`/join?pin=${pin}`}>
            <Button className="mt-4" size="lg">
              যোগ দিন
            </Button>
          </Link>
        </div>
      </div>
    );

  const theme = mergeTemplate(snapshot?.theme);

  return (
    <ThemeStage config={theme} className="relative min-h-screen text-white">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-3 pb-24 sm:p-5">
        <header className="flex items-center gap-2 text-xs">
          <Badge tone={status === "connected" ? "green" : "coral"}>
            {status === "connected" ? "● সংযুক্ত" : status === "reconnecting" ? "◌ পুনঃসংযোগ…" : "○ অফলাইন"}
          </Badge>
          <span className="rounded-lg bg-white/10 px-2 py-1 font-bold">PIN {pin}</span>
          <div className="flex-1" />
          <span className="relative rounded-lg bg-white/10 px-2 py-1 font-bold">
            {me?.nickname} · {Math.round(me?.score ?? 0)} পয়েন্ট
            {scorePop ? <ScorePop points={scorePop} /> : null}
          </span>
        </header>

        {state === "lobby" || state === "countdown" ? (
          <Card className="anim-zoom bg-white/95 text-center text-slate-900">
            <div className="text-5xl">{state === "countdown" ? "🚀" : "⏳"}</div>
            <h1 className="mt-3 text-xl font-extrabold">
              {state === "countdown" ? "শুরু হচ্ছে…" : "শিক্ষকের অপেক্ষায়"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {snapshot?.quiz.title} · {snapshot?.session.total} প্রশ্ন
            </p>
            <p className="mt-3 text-sm">
              অংশগ্রহণকারী: <b>{snapshot?.players.length ?? 0}</b>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {snapshot?.players.slice(0, 24).map((p) => (
                <span
                  key={p.id}
                  className={cx(
                    "anim-pop rounded-full px-2.5 py-1 text-xs font-semibold",
                    p.id === playerId ? "bg-[var(--pg-teal)] text-white" : "bg-slate-100",
                  )}
                >
                  {p.nickname}
                </span>
              ))}
            </div>
          </Card>
        ) : null}

        {["question_active", "answer_locked", "answer_reveal", "score_update"].includes(state) && q ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white/60">
                  প্রশ্ন {snapshot!.session.currentIndex + 1} / {snapshot!.session.total}
                </p>
                <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full transition-all"
                    style={{
                      background: theme.accent,
                      width: `${((snapshot!.session.currentIndex + 1) / Math.max(1, snapshot!.session.total)) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <QuizTimer
                endsAt={snapshot!.session.endsAt}
                total={q.timer}
                style={theme.timerStyle}
                color={theme.accent}
                paused={snapshot!.session.paused}
                size={78}
              />
            </div>

            <ThemedCard config={theme} animate animKey={q.id} className="p-4">
              <p className="text-lg font-bold leading-snug">{q.text}</p>
              {q.hint ? (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer font-semibold">💡 হিন্ট দেখুন</summary>
                  <p className="mt-1">{q.hint}</p>
                </details>
              ) : null}
            </ThemedCard>

            {answered && state === "question_active" ? (
              <Card className="anim-pop bg-emerald-500 text-center text-white">
                <p className="text-2xl">✅</p>
                <p className="mt-1 font-extrabold">উত্তর জমা হয়েছে</p>
                <p className="text-xs opacity-80">অন্যদের অপেক্ষায়…</p>
              </Card>
            ) : (
              <QuestionInput
                config={theme}
                type={q.type}
                text={q.text}
                options={q.options}
                value={answerValue}
                hidden={hidden}
                reveal={q.revealed}
                correct={q.correct}
                disabled={state !== "question_active"}
                onChange={setAnswerValue}
                onSubmit={state === "question_active" ? submit : undefined}
              />
            )}

            {!answered &&
            state === "question_active" &&
            answerValue.length > 0 &&
            isSingleChoice(q.type) ? (
              <Button block size="lg" onClick={submit}>নিশ্চিত করুন</Button>
            ) : null}

            {q.revealed ? (
              <Card
                className={cx(
                  "anim-pop text-center",
                  outcome?.correct
                    ? "border-emerald-400 bg-emerald-500 text-white"
                    : outcome
                      ? "border-rose-400 bg-rose-500 text-white"
                      : "border-slate-300 bg-slate-600 text-white",
                )}
              >
                <div className={cx("text-5xl", outcome?.correct ? "reveal-badge" : "anim-shake")}>
                  {outcome?.correct ? "🎉" : outcome ? "💡" : "⏱️"}
                </div>
                <p className="mt-2 text-2xl font-extrabold">
                  {outcome?.correct ? "সঠিক উত্তর!" : outcome ? "ভুল হয়েছে" : "সময় শেষ"}
                </p>
                {outcome?.correct ? (
                  <p className="mt-1 text-lg font-black">+{Math.round(outcome.points)} পয়েন্ট</p>
                ) : (
                  <p className="mt-1 text-sm opacity-90">
                    {outcome ? "সঠিক উত্তরটি সবুজ রঙে দেখানো হয়েছে" : "এই প্রশ্নে উত্তর দেওয়া হয়নি"}
                  </p>
                )}
                {me && me.streak >= 3 && outcome?.correct ? (
                  <p className="mt-1 text-sm font-bold">🔥 টানা {me.streak}টি সঠিক!</p>
                ) : null}
              </Card>
            ) : null}

            {q.revealed && q.explanation ? (
              <Card
                className={cx(
                  "reveal-banner text-slate-900",
                  outcome?.correct ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50",
                )}
              >
                <p className="text-xs font-bold uppercase text-amber-700">
                  {outcome?.correct ? "✅ কেন সঠিক" : "💡 ব্যাখ্যা"}
                </p>
                <p className="mt-1 text-sm">{q.explanation}</p>
              </Card>
            ) : null}

            {me && me.streak >= 3 ? <StreakBanner streak={me.streak} /> : null}

            {availablePowerUps.length ? (
              <div className="flex flex-wrap gap-2">
                {availablePowerUps.map((p) => (
                  <button
                    key={p}
                    onClick={() => usePower(p)}
                    className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold"
                  >
                    {p === "double_points"
                      ? "✖️2 ডাবল পয়েন্ট"
                      : p === "shield"
                        ? "🛡️ শিল্ড"
                        : p === "extra_time"
                          ? "⏱️ +১০ সেকেন্ড"
                          : p === "fifty_fifty"
                            ? "✂️ একটি অপশন বাদ"
                            : p}
                  </button>
                ))}
              </div>
            ) : null}

            {q.revealed ? (
              <div className="anim-fade rounded-2xl bg-white/10 px-4 py-3 text-center text-sm">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-white/70"
                        style={{ animation: `pg-twinkle 1.2s ease-in-out ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </span>
                  শিক্ষকের পরবর্তী প্রশ্নের অপেক্ষায়…
                </span>
                <p className="mt-1 text-xs text-white/60">
                  {snapshot!.session.currentIndex + 1} / {snapshot!.session.total} সম্পন্ন
                </p>
              </div>
            ) : null}

            <button
              onClick={() => setReportOpen(true)}
              className="mx-auto text-xs font-semibold text-white/60 underline"
            >
              ⚠️ এই প্রশ্নে সমস্যা রিপোর্ট করুন
            </button>
          </>
        ) : null}

        {state === "leaderboard" ? (
          <Card className="anim-zoom bg-white/95 text-slate-900">
            <h2 className="mb-3 text-center text-lg font-extrabold">🏆 লিডারবোর্ড</h2>
            <Leaderboard rows={snapshot!.players} limit={settings?.leaderboardSize ?? 10} highlightId={playerId} />
          </Card>
        ) : null}

        {state === "quiz_complete" ? (
          <>
            <Celebration config={theme} />
            <Card className="anim-zoom bg-white/95 text-center text-slate-900">
              <div className="text-5xl">🏆</div>
              <h2 className="mt-2 text-xl font-extrabold">কুইজ সম্পন্ন!</h2>
              <p className="mt-1 text-sm text-slate-500">
                আপনার স্কোর <b>{Math.round(me?.score ?? 0)}</b> · নির্ভুলতা{" "}
                {me?.answeredCount ? Math.round((me.correctCount / me.answeredCount) * 100) : 0}%
              </p>
              <div className="mt-4">
                <Leaderboard rows={snapshot!.players} limit={10} highlightId={playerId} />
              </div>
              {settings?.feedbackEnabled ? (
                <Button className="mt-4" block onClick={() => setFeedbackOpen(true)}>
                  ফিডব্যাক দিন
                </Button>
              ) : null}
              <Link href="/student">
                <Button variant="outline" className="mt-2" block>
                  ড্যাশবোর্ডে যান
                </Button>
              </Link>
            </Card>
          </>
        ) : null}
      </div>

      {settings?.reactions && state !== "quiz_complete" ? (
        <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center gap-1.5 border-t border-white/10 bg-black/30 p-2 backdrop-blur">
          {REACTIONS.map((r) => (
            <button
              key={r}
              onClick={() => liveAction({ action: "react", pin, playerId, emoji: r }).catch(() => {})}
              className="rounded-xl px-3 py-2 text-xl active:scale-90"
              aria-label={`reaction ${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {reactions.map((r) => (
          <span
            key={r.id}
            className="anim-float absolute text-3xl"
            style={{ left: `${10 + (r.id * 7) % 80}%`, bottom: 60 }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      <AnswerFeedback
        kind={revealKind}
        points={revealPoints}
        streak={me?.streak}
        onDone={() => setRevealKind(null)}
      />

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        quizId={snapshot?.quiz.id ?? 0}
        sessionId={snapshot?.session.id ?? 0}
        playerName={me?.nickname ?? "Guest"}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        questionId={q?.id ?? 0}
        quizId={snapshot?.quiz.id ?? 0}
        playerName={me?.nickname ?? "Guest"}
      />
    </ThemeStage>
  );
}

function FeedbackModal({
  open,
  onClose,
  quizId,
  sessionId,
  playerName,
}: {
  open: boolean;
  onClose: () => void;
  quizId: number;
  sessionId: number;
  playerName: string;
}) {
  const { push } = useToast();
  const [values, setValues] = useState({ overall: 5, difficulty: 3, timerRating: 3, quality: 5, engagement: 5 });
  const [comment, setComment] = useState("");
  const rows: { key: keyof typeof values; label: string; icons: string[] }[] = [
    { key: "overall", label: "সামগ্রিক অভিজ্ঞতা", icons: ["😞", "😐", "🙂", "😃", "🤩"] },
    { key: "difficulty", label: "কঠিনতা", icons: ["🟢", "🟡", "🟠", "🔴", "⚫"] },
    { key: "timerRating", label: "সময় যথেষ্ট ছিল?", icons: ["⏱️", "⏱️", "⏱️", "⏱️", "⏱️"] },
    { key: "quality", label: "প্রশ্নের মান", icons: ["⭐", "⭐", "⭐", "⭐", "⭐"] },
    { key: "engagement", label: "আকর্ষণীয়তা", icons: ["💤", "🙂", "😊", "🔥", "🚀"] },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="আপনার মতামত"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            পরে
          </Button>
          <Button
            onClick={async () => {
              await fetch("/api/feedback", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ op: "feedback", quizId, sessionId, playerName, ...values, comment }),
              });
              push("ধন্যবাদ! ফিডব্যাক জমা হয়েছে", "success");
              onClose();
            }}
          >
            জমা দিন
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.key}>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">{r.label}</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setValues((v) => ({ ...v, [r.key]: n }))}
                  className={cx(
                    "flex-1 rounded-xl border py-2 text-lg transition",
                    values[r.key] === n
                      ? "border-[var(--pg-teal)] bg-teal-50 scale-105"
                      : "border-[var(--pg-line)]",
                  )}
                  aria-label={`${r.label} ${n}`}
                >
                  {r.icons[n - 1]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="লিখিত মতামত (ঐচ্ছিক)"
        />
      </div>
    </Modal>
  );
}

function ReportModal({
  open,
  onClose,
  questionId,
  quizId,
  playerName,
}: {
  open: boolean;
  onClose: () => void;
  questionId: number;
  quizId: number;
  playerName: string;
}) {
  const { push } = useToast();
  const [reason, setReason] = useState("wrong_answer");
  const [detail, setDetail] = useState("");
  const reasons = [
    ["wrong_answer", "ভুল উত্তর"],
    ["ambiguous", "অস্পষ্ট প্রশ্ন"],
    ["typo", "বানান ভুল"],
    ["technical", "কারিগরি সমস্যা"],
    ["multiple_correct", "একাধিক সঠিক উত্তর"],
    ["other", "অন্যান্য"],
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="প্রশ্ন রিপোর্ট"
      footer={
        <Button
          onClick={async () => {
            await fetch("/api/feedback", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ op: "report", questionId, quizId, reason, detail, playerName }),
            });
            push("রিপোর্ট পাঠানো হয়েছে", "success");
            onClose();
          }}
        >
          পাঠান
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {reasons.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setReason(v)}
            className={cx(
              "rounded-xl border px-3 py-2 text-sm font-semibold",
              reason === v ? "border-[var(--pg-teal)] bg-teal-50" : "border-[var(--pg-line)]",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <Textarea
        className="mt-3"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="বিস্তারিত (ঐচ্ছিক)"
      />
    </Modal>
  );
}
