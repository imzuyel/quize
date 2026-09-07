import { autoAdvanceIfExpired, buildSnapshot, getSessionByPin } from "@/lib/live";
import { subscribe } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

export async function GET(req: Request) {
  const pin = new URL(req.url).searchParams.get("pin");
  if (!pin) return new Response("pin required", { status: 400 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* closed */
        }
      };
      send(`retry: 2000\n\n`);
      const snap = await buildSnapshot(pin);
      if (snap) send(`event: update\ndata: ${JSON.stringify(snap)}\n\n`);
      unsubscribe = subscribe(`session:${pin}`, send);

      // Safety net: if the in-process reveal timer was lost (server restart,
      // cold start), this catches the expiry within a second.
      heartbeat = setInterval(async () => {
        send(`: ping\n\n`);
        try {
          const s = await getSessionByPin(pin);
          if (!s) return;
          if (s.state === "question_active" && !s.pausedAt && s.questionEndsAt) {
            if (await autoAdvanceIfExpired(s.id)) {
              const next = await buildSnapshot(pin);
              if (next) send(`event: reveal\ndata: ${JSON.stringify(next)}\n\n`);
            }
          }
        } catch {
          /* transient */
        }
      }, 1000);
      req.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
