import { db } from "@/db";
import {
  playerAnswers,
  quizResults,
  quizSessions,
  quizzes,
  sessionPlayers,
  sessionReactions,
  sessionTeams,
  notifications,
  users,
} from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { getCurrentUser, isStaff } from "@/lib/auth";
import {
  autoAdvanceIfExpired,
  buildSnapshot,
  computePoints,
  generatePin,
  getSessionByPin,
  isAnswerCorrect,
  loadQuizQuestions,
  mergeSettings,
} from "@/lib/live";
import { clearScheduled, publish, rateLimit, scheduleFor } from "@/lib/realtime";
import { getFeatures } from "@/lib/features";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function broadcast(pin: string, event = "update") {
  const snap = await buildSnapshot(pin);
  if (snap) publish(`session:${pin}`, event, snap);
  return snap;
}

/**
 * Arms a timer that reveals the answer the moment the question expires, so
 * every screen flips together without anyone pressing a button.
 */
function armReveal(pin: string, sessionId: number, endsAt: Date) {
  scheduleFor(`reveal:${pin}`, endsAt.getTime() - Date.now() + 700, async () => {
    try {
      const changed = await autoAdvanceIfExpired(sessionId);
      if (changed) await broadcast(pin, "reveal");
    } catch (err) {
      console.error("[armReveal]", err);
    }
  });
}

export async function GET(req: Request) {
  return guard(async () => {
    const url = new URL(req.url);
    const pin = url.searchParams.get("pin");
    if (!pin) {
      const user = await getCurrentUser();
      if (!user || !isStaff(user.role)) return fail("Forbidden", 403);
      const rows = await db
        .select({
          id: quizSessions.id,
          pin: quizSessions.pin,
          state: quizSessions.state,
          quizId: quizSessions.quizId,
          createdAt: quizSessions.createdAt,
          endedAt: quizSessions.endedAt,
          title: quizzes.title,
          players: sql<number>`(select count(*)::int from session_players sp where sp.session_id = ${quizSessions.id})`,
        })
        .from(quizSessions)
        .innerJoin(quizzes, eq(quizzes.id, quizSessions.quizId))
        .orderBy(sql`${quizSessions.id} desc`)
        .limit(30);
      return ok({ sessions: rows });
    }
    const snap = await buildSnapshot(pin);
    if (!snap) return fail("সেশন পাওয়া যায়নি", 404);
    return ok(snap);
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const pin = String(body.pin ?? "");
    const user = await getCurrentUser();

    /* --------------------------- create session --------------------------- */
    if (action === "create") {
      if (!user || !isStaff(user.role)) return fail("Forbidden", 403);
      const quizId = Number(body.quizId);
      const quiz = (await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1))[0];
      if (!quiz) return fail("কুইজ পাওয়া যায়নি", 404);
      const settings = mergeSettings(quiz.settings);
      let newPin = generatePin();
      for (let i = 0; i < 6; i++) {
        const clash = await getSessionByPin(newPin);
        if (!clash) break;
        newPin = generatePin();
      }
      const session = (
        await db
          .insert(quizSessions)
          .values({
            quizId,
            pin: newPin,
            hostId: user.id,
            settings: settings as object,
            teamMode: settings.teamMode,
            showLeaderboard: settings.leaderboard,
            tournamentId: (body.tournamentId as number) ?? null,
          })
          .returning()
      )[0];
      if (settings.teamMode) {
        const palette = ["#e2574c", "#2f80ed", "#0f9d58", "#f0b429", "#8b5cf6", "#0891b2"];
        const icons = ["🚀", "⚡", "🔥", "🌟", "🛡️", "🎯"];
        const count = Math.max(2, Math.min(20, settings.teamCount || 4));
        await db.insert(sessionTeams).values(
          Array.from({ length: count }).map((_, i) => ({
            sessionId: session.id,
            name: `টিম ${i + 1}`,
            color: palette[i % palette.length],
            icon: icons[i % icons.length],
          })),
        );
      }
      await db.insert(notifications).values({
        audience: "students",
        title: "লাইভ কুইজ শুরু হচ্ছে",
        body: `${quiz.title} — পিন ${newPin}`,
        kind: "live",
        link: `/join?pin=${newPin}`,
      });
      return ok({ pin: newPin, sessionId: session.id });
    }

    const session = await getSessionByPin(pin);
    if (!session) return fail("সেশন পাওয়া যায়নি", 404);

    /* ------------------------------- join -------------------------------- */
    if (action === "join") {
      if (!rateLimit(`join:${pin}`, 400, 10_000)) return fail("অনেক অনুরোধ, একটু পরে চেষ্টা করুন", 429);
      if (session.lobbyLocked) return fail("লবি লক করা হয়েছে");
      // Guest joining can be turned off school-wide.
      if (!user) {
        const features = await getFeatures();
        if (!features.guestJoin)
          return fail("গেস্ট জয়েন বন্ধ আছে — লগইন করে যোগ দিন", 403);
      }
      if (session.state === "quiz_complete") return fail("কুইজ শেষ হয়ে গেছে");
      const nickname = String(body.nickname ?? "").trim().slice(0, 28);
      if (!nickname) return fail("নাম দিন");
      const existingId = Number(body.playerId ?? 0);
      if (existingId) {
        const rows = await db
          .select()
          .from(sessionPlayers)
          .where(and(eq(sessionPlayers.id, existingId), eq(sessionPlayers.sessionId, session.id)))
          .limit(1);
        if (rows[0] && !rows[0].removed) {
          await db
            .update(sessionPlayers)
            .set({ connected: true, lastSeen: new Date() })
            .where(eq(sessionPlayers.id, existingId));
          await broadcast(pin, "players");
          return ok({ playerId: existingId, reconnected: true });
        }
      }
      const teams = await db.select().from(sessionTeams).where(eq(sessionTeams.sessionId, session.id));
      const playerCount = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(sessionPlayers)
        .where(eq(sessionPlayers.sessionId, session.id));
      const teamId =
        body.teamId != null
          ? Number(body.teamId)
          : teams.length
            ? teams[(playerCount[0]?.c ?? 0) % teams.length].id
            : null;
      const player = (
        await db
          .insert(sessionPlayers)
          .values({
            sessionId: session.id,
            userId: user?.id ?? null,
            nickname,
            studentRef: (body.studentRef as string) ?? null,
            teamId,
          })
          .returning()
      )[0];
      await broadcast(pin, "players");
      return ok({ playerId: player.id, teamId });
    }

    /* ----------------------------- heartbeat ------------------------------ */
    if (action === "heartbeat") {
      const playerId = Number(body.playerId);
      if (playerId)
        await db
          .update(sessionPlayers)
          .set({ connected: true, lastSeen: new Date() })
          .where(eq(sessionPlayers.id, playerId));
      return ok({ ok: true });
    }

    /* ------------------------------ answer -------------------------------- */
    if (action === "answer") {
      const playerId = Number(body.playerId);
      if (!rateLimit(`ans:${playerId}`, 20, 5_000)) return fail("অনেক দ্রুত চেষ্টা", 429);
      if (session.state !== "question_active") return fail("এখন উত্তর নেওয়া হচ্ছে না");
      const player = (
        await db.select().from(sessionPlayers).where(eq(sessionPlayers.id, playerId)).limit(1)
      )[0];
      if (!player || player.sessionId !== session.id || player.removed) return fail("Invalid player", 403);
      const list = await loadQuizQuestions(session.quizId);
      const question = list[session.currentIndex];
      if (!question) return fail("প্রশ্ন নেই");
      const already = await db
        .select({ id: playerAnswers.id })
        .from(playerAnswers)
        .where(and(eq(playerAnswers.playerId, playerId), eq(playerAnswers.questionIndex, session.currentIndex)))
        .limit(1);
      if (already.length) return ok({ ok: true, duplicate: true });

      const startedAt = session.questionStartedAt?.getTime() ?? Date.now();
      const endsAt = session.questionEndsAt?.getTime() ?? Date.now() + question.timer * 1000;
      const nowMs = Date.now();
      if (nowMs > endsAt + 1500) return fail("সময় শেষ");
      const responseMs = Math.max(0, nowMs - startedAt);
      const correct = isAnswerCorrect(question, body.answer);
      const settings = mergeSettings(session.settings);
      const nextStreak = correct ? player.streak + 1 : 0;
      const points = computePoints({
        settings,
        question,
        correct,
        responseMs,
        streak: nextStreak,
        doublePoints: Boolean((player.powerUps as Record<string, boolean>)?.double_points_active),
      });
      await db.insert(playerAnswers).values({
        sessionId: session.id,
        playerId,
        questionId: question.id,
        questionIndex: session.currentIndex,
        answer: body.answer as object,
        correct,
        points,
        responseMs,
      });
      await db
        .update(sessionPlayers)
        .set({
          score: player.score + points,
          streak: nextStreak,
          bestStreak: Math.max(player.bestStreak, nextStreak),
          correctCount: player.correctCount + (correct ? 1 : 0),
          answeredCount: player.answeredCount + 1,
          powerUps: { ...(player.powerUps as object), double_points_active: false },
        })
        .where(eq(sessionPlayers.id, playerId));
      if (player.teamId)
        await db
          .update(sessionTeams)
          .set({ score: sql`${sessionTeams.score} + ${points}` })
          .where(eq(sessionTeams.id, player.teamId));
      // If every connected player has answered, don't make the class wait.
      const activePlayers = await db
        .select({ id: sessionPlayers.id })
        .from(sessionPlayers)
        .where(and(eq(sessionPlayers.sessionId, session.id), eq(sessionPlayers.removed, false)));
      const answeredRows = await db
        .select({ id: playerAnswers.id })
        .from(playerAnswers)
        .where(
          and(
            eq(playerAnswers.sessionId, session.id),
            eq(playerAnswers.questionIndex, session.currentIndex),
          ),
        );
      if (activePlayers.length > 0 && answeredRows.length >= activePlayers.length) {
        clearScheduled(`reveal:${pin}`);
        await db
          .update(quizSessions)
          .set({ state: "answer_reveal" })
          .where(and(eq(quizSessions.id, session.id), eq(quizSessions.state, "question_active")));
        await broadcast(pin, "reveal");
        return ok({ ok: true, submitted: true, allAnswered: true });
      }

      await broadcast(pin, "answers");
      return ok({ ok: true, submitted: true });
    }

    /* ----------------------------- power-up ------------------------------- */
    if (action === "powerup") {
      const playerId = Number(body.playerId);
      const kind = String(body.kind);
      const player = (
        await db.select().from(sessionPlayers).where(eq(sessionPlayers.id, playerId)).limit(1)
      )[0];
      if (!player) return fail("Invalid player", 403);
      const settings = mergeSettings(session.settings);
      if (!settings.powerUps[kind]) return fail("এই পাওয়ার-আপ বন্ধ আছে");
      const used = (player.powerUps as Record<string, boolean>) ?? {};
      if (used[`used_${kind}`]) return fail("এই পাওয়ার-আপ আগেই ব্যবহার করা হয়েছে");
      const next: Record<string, boolean | number> = { ...used, [`used_${kind}`]: true };
      if (kind === "double_points") next.double_points_active = true;
      await db.update(sessionPlayers).set({ powerUps: next }).where(eq(sessionPlayers.id, playerId));
      if (kind === "extra_time" && session.questionEndsAt) {
        await db
          .update(quizSessions)
          .set({ questionEndsAt: new Date(session.questionEndsAt.getTime() + 10_000) })
          .where(eq(quizSessions.id, session.id));
        await broadcast(pin, "timer");
      }
      let hidden: number[] = [];
      if (kind === "fifty_fifty") {
        const list = await loadQuizQuestions(session.quizId);
        const q = list[session.currentIndex];
        if (q) {
          const wrong = q.options
            .map((_, i) => i)
            .filter((i) => !q.correct.map(Number).includes(i));
          hidden = wrong.slice(0, Math.max(1, Math.floor(wrong.length / 2)));
        }
      }
      return ok({ ok: true, hidden });
    }

    /* ------------------------------ reaction ------------------------------ */
    if (action === "react") {
      const settings = mergeSettings(session.settings);
      const features = await getFeatures();
      if (!settings.reactions || !features.reactions) return fail("রিঅ্যাকশন বন্ধ");
      const playerId = Number(body.playerId);
      if (!rateLimit(`react:${playerId}`, 5, 10_000)) return fail("একটু ধীরে!", 429);
      const emoji = String(body.emoji ?? "❤️").slice(0, 4);
      await db.insert(sessionReactions).values({ sessionId: session.id, playerId, emoji });
      publish(`session:${pin}`, "reaction", { emoji, at: Date.now() });
      return ok({ ok: true });
    }

    /* ------------------------------ controls ------------------------------ */
    if (action === "control") {
      if (!user || !isStaff(user.role)) return fail("Forbidden", 403);
      const cmd = String(body.command ?? "");
      const list = await loadQuizQuestions(session.quizId);
      const settings = mergeSettings(session.settings);
      const startQuestion = async (index: number) => {
        const q = list[index];
        if (!q) return;
        const seconds = settings.timerMode === "global" ? settings.globalTimer : q.timer;
        const now = new Date();
        const endsAt = new Date(now.getTime() + seconds * 1000);
        await db
          .update(quizSessions)
          .set({
            state: "question_active",
            currentIndex: index,
            questionStartedAt: now,
            questionEndsAt: endsAt,
            pausedAt: null,
            version: session.version + 1,
          })
          .where(eq(quizSessions.id, session.id));
        armReveal(pin, session.id, endsAt);
      };

      switch (cmd) {
        case "start":
          await db
            .update(quizSessions)
            .set({ state: "countdown", lobbyLocked: true })
            .where(eq(quizSessions.id, session.id));
          await broadcast(pin);
          await startQuestion(0);
          break;
        case "next": {
          const nextIndex = session.currentIndex + 1;
          if (nextIndex >= list.length) {
            await finishSession(session.id, pin);
          } else {
            await startQuestion(nextIndex);
          }
          break;
        }
        case "prev":
          await startQuestion(Math.max(0, session.currentIndex - 1));
          break;
        case "skip":
          await startQuestion(Math.min(list.length - 1, session.currentIndex + 1));
          break;
        case "lock":
          clearScheduled(`reveal:${pin}`);
          await db
            .update(quizSessions)
            .set({ state: "answer_locked", questionEndsAt: new Date() })
            .where(eq(quizSessions.id, session.id));
          break;
        case "reveal":
          clearScheduled(`reveal:${pin}`);
          await db.update(quizSessions).set({ state: "answer_reveal" }).where(eq(quizSessions.id, session.id));
          break;
        case "leaderboard":
          await db.update(quizSessions).set({ state: "leaderboard" }).where(eq(quizSessions.id, session.id));
          break;
        case "toggleLeaderboard":
          await db
            .update(quizSessions)
            .set({ showLeaderboard: !session.showLeaderboard })
            .where(eq(quizSessions.id, session.id));
          break;
        case "pause":
          clearScheduled(`reveal:${pin}`);
          await db.update(quizSessions).set({ pausedAt: new Date() }).where(eq(quizSessions.id, session.id));
          break;
        case "resume": {
          if (session.pausedAt && session.questionEndsAt) {
            const delta = Date.now() - session.pausedAt.getTime();
            const endsAt = new Date(session.questionEndsAt.getTime() + delta);
            await db
              .update(quizSessions)
              .set({ pausedAt: null, questionEndsAt: endsAt })
              .where(eq(quizSessions.id, session.id));
            if (session.state === "question_active") armReveal(pin, session.id, endsAt);
          } else {
            await db.update(quizSessions).set({ pausedAt: null }).where(eq(quizSessions.id, session.id));
          }
          break;
        }
        case "extend": {
          const secs = Math.max(1, Math.min(300, Number(body.seconds ?? 10)));
          const base = session.questionEndsAt ?? new Date();
          const endsAt = new Date(base.getTime() + secs * 1000);
          await db
            .update(quizSessions)
            .set({ questionEndsAt: endsAt })
            .where(eq(quizSessions.id, session.id));
          if (session.state === "question_active") armReveal(pin, session.id, endsAt);
          break;
        }
        case "lockLobby":
          await db
            .update(quizSessions)
            .set({ lobbyLocked: !session.lobbyLocked })
            .where(eq(quizSessions.id, session.id));
          break;
        case "kick":
          await db
            .update(sessionPlayers)
            .set({ removed: true, connected: false })
            .where(eq(sessionPlayers.id, Number(body.playerId)));
          break;
        case "assignTeam":
          await db
            .update(sessionPlayers)
            .set({ teamId: Number(body.teamId) })
            .where(eq(sessionPlayers.id, Number(body.playerId)));
          break;
        case "shuffleTeams": {
          const teams = await db.select().from(sessionTeams).where(eq(sessionTeams.sessionId, session.id));
          const players = await db
            .select()
            .from(sessionPlayers)
            .where(eq(sessionPlayers.sessionId, session.id));
          if (teams.length) {
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffled.length; i++) {
              await db
                .update(sessionPlayers)
                .set({ teamId: teams[i % teams.length].id })
                .where(eq(sessionPlayers.id, shuffled[i].id));
            }
          }
          break;
        }
        case "end":
          clearScheduled(`reveal:${pin}`);
          await finishSession(session.id, pin);
          break;
        default:
          return fail("Unknown command");
      }
      const snap = await broadcast(pin);
      return ok(snap ?? { ok: true });
    }

    return fail("Unknown action");
  });
}

async function finishSession(sessionId: number, pin: string) {
  const session = (await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).limit(1))[0];
  if (!session) return;
  const players = await db
    .select()
    .from(sessionPlayers)
    .where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.removed, false)));
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const list = await loadQuizQuestions(session.quizId);
  const answers = await db.select().from(playerAnswers).where(eq(playerAnswers.sessionId, sessionId));

  for (let i = 0; i < ranked.length; i++) {
    const p = ranked[i];
    const mine = answers.filter((a) => a.playerId === p.id);
    const bySubject: Record<string, { c: number; t: number }> = {};
    for (const a of mine) {
      const q = list.find((x) => x.id === a.questionId);
      const key = String(q?.subjectId ?? "general");
      bySubject[key] = bySubject[key] ?? { c: 0, t: 0 };
      bySubject[key].t += 1;
      if (a.correct) bySubject[key].c += 1;
    }
    const breakdown: Record<string, number> = {};
    for (const [k, v] of Object.entries(bySubject))
      breakdown[k] = Math.round((v.c / Math.max(1, v.t)) * 100);
    await db.insert(quizResults).values({
      sessionId,
      quizId: session.quizId,
      userId: p.userId,
      playerName: p.nickname,
      score: p.score,
      accuracy: p.answeredCount ? Math.round((p.correctCount / p.answeredCount) * 100) : 0,
      rank: i + 1,
      totalQuestions: list.length,
      correctCount: p.correctCount,
      subjectBreakdown: breakdown,
    });
    if (p.userId) {
      await db
        .update(users)
        .set({ xp: sql`${users.xp} + ${Math.round(p.score / 20) + 10}` })
        .where(eq(users.id, p.userId));
      await db.insert(notifications).values({
        userId: p.userId,
        title: "ফলাফল প্রকাশিত",
        body: `আপনি ${i + 1} নম্বর স্থান পেয়েছেন (${Math.round(p.score)} পয়েন্ট)`,
        kind: "result",
        link: "/student/results",
      });
    }
  }
  await db
    .update(quizSessions)
    .set({ state: "quiz_complete", endedAt: new Date() })
    .where(eq(quizSessions.id, sessionId));
  const snap = await buildSnapshot(pin);
  if (snap) publish(`session:${pin}`, "complete", snap);
}
