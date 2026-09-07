"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "./quiz-settings";

export type LiveStatus = "connecting" | "connected" | "reconnecting" | "offline";

export function useLiveSession(pin: string) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const counter = useRef(0);

  const connect = useCallback(() => {
    if (!pin) return;
    esRef.current?.close();
    const es = new EventSource(`/api/live/stream?pin=${pin}`);
    esRef.current = es;
    const onData = (e: MessageEvent) => {
      try {
        setSnapshot(JSON.parse(e.data) as Snapshot);
        setStatus("connected");
        retryRef.current = 0;
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("update", onData);
    es.addEventListener("players", onData);
    es.addEventListener("answers", onData);
    es.addEventListener("timer", onData);
    es.addEventListener("complete", onData);
    es.addEventListener("reaction", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { emoji: string };
        const id = ++counter.current;
        setReactions((r) => [...r.slice(-14), { id, emoji: data.emoji }]);
        setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 1600);
      } catch {
        /* ignore */
      }
    });
    es.onopen = () => setStatus("connected");
    es.onerror = () => {
      setStatus("reconnecting");
      es.close();
      retryRef.current += 1;
      const delay = Math.min(8000, 800 * retryRef.current);
      setTimeout(connect, delay);
    };
  }, [pin]);

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, [connect]);

  // polling fallback keeps everyone in sync even if SSE is blocked by a proxy
  useEffect(() => {
    const id = setInterval(async () => {
      if (status === "connected") return;
      try {
        const res = await fetch(`/api/live?pin=${pin}`);
        if (res.ok) {
          setSnapshot((await res.json()) as Snapshot);
          setStatus((s) => (s === "connected" ? s : "reconnecting"));
        }
      } catch {
        setStatus("offline");
      }
    }, 3000);
    return () => clearInterval(id);
  }, [pin, status]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/live?pin=${pin}`);
    if (res.ok) setSnapshot((await res.json()) as Snapshot);
  }, [pin]);

  return { snapshot, status, reactions, refresh };
}

export async function liveAction(body: Record<string, unknown>) {
  const res = await fetch("/api/live", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "ব্যর্থ");
  return data;
}
