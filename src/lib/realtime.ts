/**
 * Lightweight in-process pub/sub used to fan-out server-authoritative live
 * session events to SSE subscribers. Designed for many concurrent listeners:
 * one shared encoder, per-channel subscriber sets, no per-client polling.
 */

type Listener = (payload: string) => void;

type Hub = {
  channels: Map<string, Set<Listener>>;
  rate: Map<string, { count: number; reset: number }>;
  /** Pending deadline timers, keyed by session pin. */
  timers: Map<string, ReturnType<typeof setTimeout>>;
};

const globalForHub = globalThis as typeof globalThis & { __pgtscHub?: Hub };

export const hub: Hub =
  globalForHub.__pgtscHub ?? { channels: new Map(), rate: new Map(), timers: new Map() };
if (!hub.timers) hub.timers = new Map();
globalForHub.__pgtscHub = hub;

export function subscribe(channel: string, listener: Listener): () => void {
  let set = hub.channels.get(channel);
  if (!set) {
    set = new Set();
    hub.channels.set(channel, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) hub.channels.delete(channel);
  };
}

export function publish(channel: string, event: string, data: unknown) {
  const set = hub.channels.get(channel);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const listener of set) {
    try {
      listener(payload);
    } catch {
      /* dropped client */
    }
  }
}

export function subscriberCount(channel: string) {
  return hub.channels.get(channel)?.size ?? 0;
}

/**
 * Schedules a one-shot callback for a session (e.g. "question time is up").
 * Re-scheduling for the same key cancels the previous timer, so moving to the
 * next question never leaves a stale reveal pending.
 */
export function scheduleFor(key: string, delayMs: number, fn: () => void) {
  clearScheduled(key);
  if (delayMs < 0) delayMs = 0;
  const t = setTimeout(() => {
    hub.timers.delete(key);
    try {
      fn();
    } catch (err) {
      console.error("[schedule]", err);
    }
  }, delayMs);
  // Never keep the process alive just for a quiz timer.
  if (typeof t === "object" && "unref" in t) (t as { unref: () => void }).unref();
  hub.timers.set(key, t);
}

export function clearScheduled(key: string) {
  const existing = hub.timers.get(key);
  if (existing) {
    clearTimeout(existing);
    hub.timers.delete(key);
  }
}

/** Simple sliding-window rate limiter (per key). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hub.rate.get(key);
  if (!entry || entry.reset < now) {
    hub.rate.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
