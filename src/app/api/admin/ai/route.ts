import { fail, guard, ok } from "@/lib/api";
import { isAdmin, requireUser } from "@/lib/auth";
import { effectiveKey, getProviderInfo, keySource, verifyKey, type ProviderId } from "@/lib/ai";
import { loadAiKeys, maskKey, readAiKeys, saveAiKeys, type AiKeySettings } from "@/lib/ai-keys";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROVIDERS: ProviderId[] = ["gemini", "groq", "openai", "anthropic"];

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    if (!isAdmin(user.role)) return fail("শুধুমাত্র অ্যাডমিন", 403);
    await loadAiKeys(true);
    const saved = await readAiKeys();
    return ok({
      provider: getProviderInfo(),
      // Never return raw keys to the browser — masked preview only.
      keys: PROVIDERS.map((id) => ({
        id,
        masked: maskKey(saved[id as keyof AiKeySettings] as string | undefined),
        source: keySource(id),
      })),
      preferred: saved.provider ?? "",
      model: saved.model ?? "",
    });
  });
}

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    if (!isAdmin(user.role)) return fail("শুধুমাত্র অ্যাডমিন", 403);
    const body = (await req.json()) as Record<string, unknown>;
    const op = String(body.op ?? "");

    if (op === "verify") {
      const id = String(body.provider ?? "gemini") as ProviderId;
      let key = String(body.key ?? "").trim();
      if (!key) {
        // No key typed → verify whatever is configured (admin override or env).
        await loadAiKeys(true);
        key = effectiveKey(id) ?? "";
      }
      if (!key) return fail("এই প্রোভাইডারের কোনো কী সেট করা নেই");
      const result = await verifyKey(id, key);
      return ok(result);
    }

    if (op === "save") {
      const saved = await readAiKeys();
      const next: AiKeySettings = { ...saved };
      for (const id of PROVIDERS) {
        const raw = body[id];
        if (raw === undefined) continue;
        const value = String(raw).trim();
        // Empty string clears the override and falls back to the env var.
        if (value) next[id as keyof AiKeySettings] = value as never;
        else delete next[id as keyof AiKeySettings];
      }
      if (body.preferred !== undefined) {
        const p = String(body.preferred).trim();
        if (p) next.provider = p;
        else delete next.provider;
      }
      if (body.model !== undefined) {
        const m = String(body.model).trim();
        if (m) next.model = m;
        else delete next.model;
      }
      await saveAiKeys(next);
      return ok({ ok: true, provider: getProviderInfo() });
    }

    if (op === "clear") {
      await saveAiKeys({});
      return ok({ ok: true, provider: getProviderInfo() });
    }

    return fail("Unknown op");
  });
}
