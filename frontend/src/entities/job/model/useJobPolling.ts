"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJob } from "../api";
import type { JobResponse } from "./types";

const TERMINAL = new Set(["done", "failed"]);

/**
 * Track a single job, polling its status every second until it reaches a
 * terminal state. `start(job)` seeds it (e.g. straight from a create response).
 */
export function useJobPolling() {
  const [job, setJob] = useState<JobResponse | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(
    (initial: JobResponse) => {
      stop();
      setJob(initial);
      if (TERMINAL.has(initial.status)) return;
      timer.current = setInterval(async () => {
        try {
          const updated = await fetchJob(initial.id);
          setJob(updated);
          if (TERMINAL.has(updated.status)) stop();
        } catch {
          /* transient poll error — keep trying */
        }
      }, 1000);
    },
    [stop]
  );

  useEffect(() => stop, [stop]);

  return {
    job,
    start,
    reset: () => {
      stop();
      setJob(null);
    },
  };
}
