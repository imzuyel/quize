import { db } from "@/db";
import { sql } from "drizzle-orm";
import { demoSeedAllowed, seedDatabase } from "@/lib/seed";

export const dynamic = "force-dynamic";

const globalForSeed = globalThis as typeof globalThis & {
  __pgtscSeeded?: boolean;
  __pgtscSeeding?: Promise<unknown> | null;
};

export async function GET() {
  try {
    await db.execute(sql`select 1`);

    // Seed once per process, but only latch the flag on success so a transient
    // failure (e.g. schema not pushed yet) can be retried on the next call.
    if (!globalForSeed.__pgtscSeeded && demoSeedAllowed()) {
      if (!globalForSeed.__pgtscSeeding) {
        globalForSeed.__pgtscSeeding = seedDatabase()
          .then(() => {
            globalForSeed.__pgtscSeeded = true;
          })
          .catch((err) => {
            console.error("[seed]", err);
          })
          .finally(() => {
            globalForSeed.__pgtscSeeding = null;
          });
      }
      await globalForSeed.__pgtscSeeding;
    }

    return Response.json({ ok: true, seeded: Boolean(globalForSeed.__pgtscSeeded) });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
