"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Modal, useToast, cx } from "@/components/ui";
import { CinematicIntro, Leaderboard, QuizTimer } from "@/components/quiz";
import { Celebration, ThemeStage, ThemedAnswers } from "@/components/theme-stage";
import { AnswerDistribution } from "@/components/reveal";
import { mergeTemplate } from "@/lib/theme";
import { liveAction, useLiveSession } from "@/lib/useLive";

export default function HostPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params);
  const { snapshot, status, reactions } = useLiveSession(pin);
  const { push } = useToast();
  const [intro, setIntro] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [busy, setBusy] = useState("");

  const state = snapshot?.session.state ?? "lobby";
  const settings = snapshot?.quiz.settings;
  const q = snapshot?.question;
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join?pin=${pin}` : "";

  useEffect(() => {
    if (state === "countdown" && settings?.cinematicIntro) setIntro(true);
  }, [state, settings]);

  const control = async (command: string, extra: Record<string, unknown> = {}) => {
    setBusy(command);
    try {
      await liveAction({ action: "control", pin, command, ...extra });
    } catch (err) {
      push(err instanceof Error ? err.message : "ব্যর্থ", "error");
    } finally {
      setBusy("");
    }
  };

  const answeredCount = snapshot?.answeredCount ?? 0;
  const totalPlayers = snapshot?.players.length ?? 0;
  const answerPct = totalPlayers ? Math.round((answeredCount / totalPlayers) * 100) : 0;
  const outcomes = snapshot?.outcomes ?? {};
  const answeredBy = new Set(snapshot?.answeredBy ?? []);
  const correctCount = Object.values(outcomes).filter((o) => o.correct).length;
  const wrongCount = Object.values(outcomes).length - correctCount;
  const notAnswered = Math.max(0, totalPlayers - Object.values(outcomes).length);
  const everyoneAnswered = totalPlayers > 0 && answeredCount >= totalPlayers;

  const theme = mergeTemplate(snapshot?.theme);

  return (
    <ThemeStage config={theme} className="min-h-screen text-white">
      {intro && snapshot ? (
        <CinematicIntro
          title={snapshot.quiz.title}
          questions={snapshot.session.total}
          players={snapshot.players.length}
          onDone={() => setIntro(false)}
        />
      ) : null}

      <div className="mx-auto max-w-6xl p-3 sm:p-5">
        <header className="mb-4 flex flex-wrap items-center gap-2">
          <Link href="/teacher/live" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">
            ← সেশন তালিকা
          </Link>
          <Badge tone={status === "connected" ? "green" : "coral"}>
            {status === "connected" ? "● লাইভ" : "◌ পুনঃসংযোগ"}
          </Badge>
          <div className="flex-1" />
          <span className="rounded-xl bg-white px-4 py-2 text-lg font-black tracking-[0.2em] text-[var(--pg-deep)]">
            {pin}
          </span>
          <Button variant="outline" size="sm" onClick={() => setShowQr(true)}>
            QR কোড
          </Button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card className="bg-white/95 text-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">{stateLabel(state)}</p>
                  <h1 className="text-lg font-extrabold">{snapshot?.quiz.title ?? "লোড হচ্ছে…"}</h1>
                  <p className="text-xs text-slate-500">
                    প্রশ্ন {(snapshot?.session.currentIndex ?? 0) + 1}/{snapshot?.session.total ?? 0} ·{" "}
                    {totalPlayers} জন অংশগ্রহণকারী
                  </p>
                  {state === "question_active" && everyoneAnswered ? (
                    <p className="anim-pop mt-1 text-xs font-bold text-emerald-600">
                      ✅ সবাই উত্তর দিয়েছে — উত্তর দেখানো হচ্ছে…
                    </p>
                  ) : null}
                  {state === "question_active" || state === "answer_locked" ? (
                    <div className="mt-1.5 w-48">
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>উত্তর জমা</span>
                        <span className="tabular-nums">{answeredCount}/{totalPlayers}</span>
                      </div>
                      <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${answerPct}%`, background: theme.primary }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                {q && state !== "lobby" ? (
                  <QuizTimer
                    endsAt={snapshot!.session.endsAt}
                    total={q.timer}
                    style={theme.timerStyle}
                    color={theme.accent}
                    paused={snapshot!.session.paused}
                    size={84}
                  />
                ) : null}
              </div>

              {state === "lobby" ? (
                <div className="mt-4 rounded-2xl border border-dashed border-[var(--pg-line)] p-4 text-center">
                  <p className="text-sm text-slate-500">
                    শিক্ষার্থীরা <b>{joinUrl}</b> এ গিয়ে পিন <b>{pin}</b> দিয়ে যোগ দিতে পারবে।
                  </p>
                  <Button className="mt-3" size="lg" onClick={() => control("start")} loading={busy === "start"}>
                    🚀 কুইজ শুরু করুন
                  </Button>
                </div>
              ) : null}

              {q && state !== "lobby" && state !== "quiz_complete" ? (
                <div className="mt-4">
                  <p className="text-lg font-bold">{q.text}</p>
                  <div className="mt-3">
                    {q.revealed && snapshot?.tally?.length ? (
                      <>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                          <span>উত্তরের বিশ্লেষণ</span>
                          <span>{snapshot.answeredCount} জন উত্তর দিয়েছে</span>
                        </div>
                        <AnswerDistribution
                          options={q.options}
                          counts={snapshot.tally}
                          correct={q.correct ?? []}
                          palette={theme.answerPalette}
                        />
                      </>
                    ) : (
                      <ThemedAnswers
                        config={theme}
                        options={q.options}
                        type={q.type}
                        selected={[]}
                        reveal={q.revealed}
                        correct={q.correct}
                        disabled
                        onSelect={() => {}}
                      />
                    )}
                  </div>
                  {q.revealed ? (
                    <div className="anim-fade mt-3 grid grid-cols-3 gap-2">
                      {[
                        { n: correctCount, l: "সঠিক", c: "bg-emerald-50 text-emerald-800 border-emerald-200", i: "✅" },
                        { n: wrongCount, l: "ভুল", c: "bg-rose-50 text-rose-800 border-rose-200", i: "❌" },
                        { n: notAnswered, l: "উত্তর দেয়নি", c: "bg-slate-50 text-slate-600 border-slate-200", i: "⏱️" },
                      ].map((x) => (
                        <div key={x.l} className={cx("rounded-xl border p-2.5 text-center", x.c)}>
                          <p className="text-xl">{x.i}</p>
                          <p className="text-2xl font-black tabular-nums">{x.n}</p>
                          <p className="text-[11px] font-semibold">{x.l}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {q.revealed && q.explanation ? (
                    <div className="anim-fade mt-3 rounded-xl bg-amber-50 p-3 text-sm">
                      <b>ব্যাখ্যা:</b> {q.explanation}
                    </div>
                  ) : null}

                  {q.revealed ? (
                    <Button
                      className="mt-3 anim-pop"
                      size="lg"
                      block
                      onClick={() => control("next")}
                      loading={busy === "next"}
                    >
                      {snapshot!.session.currentIndex + 1 >= snapshot!.session.total
                        ? "🏁 ফলাফল দেখান"
                        : `➡️ পরবর্তী প্রশ্ন (${snapshot!.session.currentIndex + 2}/${snapshot!.session.total})`}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {state === "quiz_complete" ? (
                <>
                  <Celebration config={theme} />
                  <div className="mt-4 text-center">
                    <p className="text-4xl">🏆</p>
                    <p className="mt-2 font-extrabold">কুইজ সম্পন্ন হয়েছে</p>
                    <Leaderboard rows={snapshot!.players} limit={10} />
                    <div className="mt-3 flex justify-center gap-2">
                      <Link href={`/teacher/reports?quizId=${snapshot?.quiz.id}`}>
                        <Button variant="outline">রিপোর্ট দেখুন</Button>
                      </Link>
                      <Link href="/teacher/live">
                        <Button>নতুন সেশন</Button>
                      </Link>
                    </div>
                  </div>
                </>
              ) : null}
            </Card>

            <Card className="bg-white/95 text-slate-900">
              <p className="mb-2 text-xs font-bold uppercase text-slate-400">কন্ট্রোল সেন্টার</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" onClick={() => control("prev")}>⏮ আগের</Button>
                <Button variant="outline" onClick={() => control(snapshot?.session.paused ? "resume" : "pause")}>
                  {snapshot?.session.paused ? "▶️ চালু" : "⏸ বিরতি"}
                </Button>
                <Button variant="outline" onClick={() => control("lock")}>🔒 লক</Button>
                <Button variant="outline" onClick={() => control("reveal")}>👁 উত্তর দেখান</Button>
                <Button variant="outline" onClick={() => control("leaderboard")}>🏆 লিডারবোর্ড</Button>
                <Button variant="outline" onClick={() => control("toggleLeaderboard")}>
                  {snapshot?.session.showLeaderboard ? "🙈 লুকান" : "👀 দেখান"}
                </Button>
                <Button variant="outline" onClick={() => control("skip")}>⏭ স্কিপ</Button>
                <Button onClick={() => control("next")} loading={busy === "next"}>➡️ পরবর্তী</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[5, 10, 30].map((s) => (
                  <Button key={s} size="sm" variant="ghost" onClick={() => control("extend", { seconds: s })}>
                    +{s}s
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => control("lockLobby")}>
                  {snapshot?.session.lobbyLocked ? "🔓 লবি খুলুন" : "🔐 লবি লক"}
                </Button>
                {snapshot?.session.teamMode ? (
                  <Button size="sm" variant="ghost" onClick={() => control("shuffleTeams")}>
                    🔀 টিম শাফল
                  </Button>
                ) : null}
                <div className="flex-1" />
                <Button size="sm" variant="danger" onClick={() => control("end")}>
                  🛑 শেষ করুন
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="relative overflow-hidden bg-white/95 text-slate-900">
              <p className="mb-2 text-xs font-bold uppercase text-slate-400">
                অংশগ্রহণকারী ({snapshot?.players.length ?? 0})
              </p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto pg-scroll">
                {snapshot?.players.map((p) => (
                  <div
                    key={p.id}
                    className={cx(
                      "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition",
                      q?.revealed && outcomes[p.id]?.correct
                        ? "border-emerald-300 bg-emerald-50"
                        : q?.revealed && outcomes[p.id]
                          ? "border-rose-200 bg-rose-50"
                          : answeredBy.has(p.id)
                            ? "border-teal-300 bg-teal-50"
                            : "border-[var(--pg-line)]",
                    )}
                  >
                    <span className={cx("h-2 w-2 rounded-full", p.connected ? "bg-emerald-500" : "bg-slate-300")} />
                    <span className="flex-1 truncate">{p.nickname}</span>
                    {q?.revealed ? (
                      <span>{outcomes[p.id]?.correct ? "✅" : outcomes[p.id] ? "❌" : "⏱️"}</span>
                    ) : answeredBy.has(p.id) ? (
                      <span title="উত্তর জমা দিয়েছে">✔</span>
                    ) : null}
                    <span className="tabular-nums font-bold">{Math.round(p.score)}</span>
                    <button
                      onClick={() => control("kick", { playerId: p.id })}
                      className="text-xs text-rose-500"
                      aria-label="remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {!snapshot?.players.length ? (
                  <p className="py-4 text-center text-xs text-slate-400">অপেক্ষা করা হচ্ছে…</p>
                ) : null}
              </div>
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {reactions.map((r) => (
                  <span key={r.id} className="anim-float absolute text-2xl" style={{ left: `${(r.id * 13) % 85}%`, bottom: 10 }}>
                    {r.emoji}
                  </span>
                ))}
              </div>
            </Card>

            {snapshot?.session.showLeaderboard ? (
              <Card className="bg-white/95 text-slate-900">
                <p className="mb-2 text-xs font-bold uppercase text-slate-400">লিডারবোর্ড</p>
                <Leaderboard rows={snapshot.players} limit={settings?.leaderboardSize ?? 10} compact />
              </Card>
            ) : null}

            {snapshot?.teams.length ? (
              <Card className="bg-white/95 text-slate-900">
                <p className="mb-2 text-xs font-bold uppercase text-slate-400">টিম স্কোর</p>
                {snapshot.teams.map((t) => (
                  <div key={t.id} className="mb-1.5 flex items-center gap-2 text-sm">
                    <span>{t.icon}</span>
                    <span className="flex-1 font-semibold" style={{ color: t.color }}>{t.name}</span>
                    <span className="font-bold tabular-nums">{Math.round(t.score)}</span>
                  </div>
                ))}
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <Modal open={showQr} onClose={() => setShowQr(false)} title="QR কোড দিয়ে যোগ দিন">
        <div className="text-center">
          {joinUrl ? (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(joinUrl)}`}
              alt="QR code"
              className="mx-auto rounded-xl border border-[var(--pg-line)]"
              width={260}
              height={260}
            />
          ) : null}
          <p className="mt-3 text-sm font-bold">{joinUrl}</p>
          <p className="mt-1 text-3xl font-black tracking-[0.2em]">{pin}</p>
        </div>
      </Modal>
    </ThemeStage>
  );
}

function stateLabel(state: string) {
  return (
    {
      lobby: "লবি",
      countdown: "কাউন্টডাউন",
      question_active: "প্রশ্ন চলছে",
      answer_locked: "উত্তর লক",
      answer_reveal: "উত্তর প্রকাশ",
      score_update: "স্কোর আপডেট",
      leaderboard: "লিডারবোর্ড",
      quiz_complete: "সম্পন্ন",
    }[state] ?? state
  );
}
