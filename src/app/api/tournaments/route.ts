import { db } from "@/db";
import { challenges, playlistProgress, playlists, quizResults, tournamentEntries, tournaments } from "@/db/schema";
import { fail, guard, ok } from "@/lib/api";
import { isStaff, requireUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    const tRows = await db.select().from(tournaments).orderBy(desc(tournaments.id)).limit(50);
    const entries = await db.select().from(tournamentEntries).orderBy(desc(tournamentEntries.score)).limit(500);
    const cRows = await db.select().from(challenges).orderBy(desc(challenges.id)).limit(50);
    const pRows = await db.select().from(playlists).orderBy(desc(playlists.id)).limit(50);
    const progress = await db.select().from(playlistProgress).where(eq(playlistProgress.userId, user.id));
    return ok({ tournaments: tRows, entries, challenges: cRows, playlists: pRows, progress });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const body = (await req.json()) as Record<string, unknown>;
    const op = String(body.op ?? "");

    if (op === "completePlaylistQuiz") {
      const playlistId = Number(body.playlistId);
      const quizId = Number(body.quizId);
      const existing = (
        await db.select().from(playlistProgress).where(eq(playlistProgress.playlistId, playlistId))
      ).find((p) => p.userId === user.id);
      const done = new Set(((existing?.completedQuizIds as number[]) ?? []).map(Number));
      done.add(quizId);
      if (existing) {
        await db
          .update(playlistProgress)
          .set({ completedQuizIds: [...done], updatedAt: new Date() })
          .where(eq(playlistProgress.id, existing.id));
      } else {
        await db.insert(playlistProgress).values({ playlistId, userId: user.id, completedQuizIds: [...done] });
      }
      return ok({ ok: true, completed: [...done] });
    }

    if (!isStaff(user.role)) return fail("Forbidden", 403);

    switch (op) {
      case "createTournament": {
        const row = await db
          .insert(tournaments)
          .values({
            name: String(body.name ?? "PGTSC Digital Quiz Championship"),
            description: String(body.description ?? ""),
            createdBy: user.id,
            config: (body.config as object) ?? { stages: ["class_round", "trade_round", "school_round", "final"] },
          })
          .returning();
        return ok(row[0]);
      }
      case "advanceStage": {
        const id = Number(body.id);
        const t = (await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1))[0];
        if (!t) return fail("Not found", 404);
        const stages = ["class_round", "trade_round", "school_round", "final", "completed"];
        const next = stages[Math.min(stages.length - 1, stages.indexOf(t.stage) + 1)];
        await db.update(tournaments).set({ stage: next, status: next === "completed" ? "closed" : "open" }).where(eq(tournaments.id, id));
        return ok({ stage: next });
      }
      case "syncEntries": {
        const id = Number(body.id);
        const quizId = Number(body.quizId);
        const results = await db
          .select()
          .from(quizResults)
          .where(eq(quizResults.quizId, quizId))
          .orderBy(desc(quizResults.score))
          .limit(200);
        if (!results.length) return fail("এই কুইজের কোনো ফলাফল নেই");
        const t = (await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1))[0];
        await db.insert(tournamentEntries).values(
          results.map((r, i) => ({
            tournamentId: id,
            userId: r.userId,
            playerName: r.playerName,
            stage: t?.stage ?? "class_round",
            score: r.score,
            qualified: i < Math.max(3, Math.ceil(results.length * 0.3)),
          })),
        );
        return ok({ added: results.length });
      }
      case "deleteTournament": {
        await db.delete(tournamentEntries).where(eq(tournamentEntries.tournamentId, Number(body.id)));
        await db.delete(tournaments).where(eq(tournaments.id, Number(body.id)));
        return ok({ ok: true });
      }
      case "createChallenge": {
        const row = await db
          .insert(challenges)
          .values({
            title: String(body.title ?? "সাপ্তাহিক চ্যালেঞ্জ"),
            metric: String(body.metric ?? "accuracy"),
            classId: (body.classId as number) ?? null,
            endsAt: body.endsAt ? new Date(String(body.endsAt)) : new Date(Date.now() + 7 * 86400000),
            createdBy: user.id,
          })
          .returning();
        return ok(row[0]);
      }
      case "deleteChallenge": {
        await db.delete(challenges).where(eq(challenges.id, Number(body.id)));
        return ok({ ok: true });
      }
      case "createPlaylist": {
        const row = await db
          .insert(playlists)
          .values({
            name: String(body.name ?? "নতুন লার্নিং পাথ"),
            description: String(body.description ?? ""),
            quizIds: (body.quizIds as number[]) ?? [],
            createdBy: user.id,
          })
          .returning();
        return ok(row[0]);
      }
      case "deletePlaylist": {
        await db.delete(playlists).where(eq(playlists.id, Number(body.id)));
        return ok({ ok: true });
      }
      default:
        return fail("Unknown op");
    }
  });
}
