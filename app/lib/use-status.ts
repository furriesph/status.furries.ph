import { useCallback, useEffect, useRef, useState } from "react";
import { emptySnapshot, parseSnapshot, statusUrl } from "./status";
import type { Service } from "./types";

export function useStatus(services: Service[]) {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setLoading(true);
    try {
      const response = await fetch(statusUrl, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/vnd.github.raw",
        },
      });
      if (!response.ok) throw new Error("Status feed unavailable");
      const text = await response.text();
      if (text.length > 30_000_000) throw new Error("Status feed too large");
      const next = parseSnapshot(JSON.parse(text), services);
      if (request.current === controller) {
        setSnapshot(next);
        setError(null);
      }
    } catch {
      if (request.current === controller)
        setError(
          "Monitoring failure: the latest status could not be loaded. Service health is unknown until fresh checks are available.",
        );
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        setLoading(false);
        setNow(Date.now());
      }
    }
  }, [services]);
  useEffect(() => {
    void refresh();
    const poll = setInterval(() => {
      void refresh();
    }, 600_000);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  return { snapshot, loading, error, now, refresh };
}
