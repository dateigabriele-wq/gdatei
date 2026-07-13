"use client";
import { useCallback, useEffect, useState } from "react";

export function useFetch<T>(url: string | null, timeoutMs = 45_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`);
        return body as T;
      })
      .then((d) => alive && setData(d))
      .catch((e) => {
        if (!alive) return;
        const timedOut = e instanceof Error && e.name === "AbortError";
        setError(timedOut ? "This is taking longer than expected. Try again in a moment." : e instanceof Error ? e.message : "Request failed");
      })
      .finally(() => {
        clearTimeout(timer);
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, tick, timeoutMs]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, retry };
}
