"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/offline/queue";

/**
 * Досыл офлайн-очереди на любом мобильном экране:
 * раньше панель с досылом жила только на главной.
 */
export function QueueFlusher() {
  useEffect(() => {
    const run = () => {
      void flushQueue();
    };
    if (navigator.onLine) run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);

  return null;
}
