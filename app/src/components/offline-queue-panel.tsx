"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listMutations, type QueuedMutation } from "@/lib/offline/db";
import { flushQueue, retryMutation } from "@/lib/offline/queue";

export function OfflineQueuePanel() {
  const t = useTranslations("mobile");
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    pending: t("queue.status.pending"),
    conflict: t("queue.status.conflict"),
    failed: t("queue.status.failed"),
  };

  const refresh = useCallback(async () => {
    setQueue(await listMutations());
  }, []);

  const flush = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await flushQueue();
      setMessage(
        result.sent > 0
          ? t("queue.flushSummary", {
              sent: result.sent,
              conflicts: result.conflicts,
              retries: result.retries,
            })
          : null,
      );
    } finally {
      await refresh();
      setBusy(false);
    }
  }, [refresh, t]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();

    const handleOnline = () => {
      setOnline(true);
      void flush();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Периодический досыл: страница могла открыться уже с очередью.
    const timer = window.setInterval(() => {
      void refresh();
      if (navigator.onLine) void flushQueue().then(refresh);
    }, 10_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(timer);
    };
  }, [flush, refresh]);

  const pending = queue.filter((item) => item.status === "pending").length;
  const conflicts = queue.filter((item) => item.status === "conflict").length;
  const failed = queue.filter((item) => item.status === "failed").length;

  return (
    <section className="rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className={online ? "text-green-700" : "text-amber-700"}>
          {online ? t("queue.online") : t("queue.offline")}
        </span>
        {queue.length > 0 ? (
          <Button size="sm" variant="outline" onClick={flush} disabled={busy || !online}>
            {busy ? t("queue.sending") : t("queue.sendNow")}
          </Button>
        ) : null}
      </div>

      {queue.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("queue.empty")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("queue.summary", { pending, conflicts, failed })}
          </p>
          <ul className="space-y-2">
            {queue.map((item) => (
              <li key={item.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {statusLabels[item.status] ?? item.status}
                    {item.status === "pending" && item.attempts > 0
                      ? ` · ${t("queue.attempts", { attempts: item.attempts })}`
                      : ""}
                  </span>
                </div>
                {item.lastError ? (
                  <p className="mt-1 text-xs text-destructive">{item.lastError}</p>
                ) : null}
                {item.status !== "pending" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={!online || busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await retryMutation(item.id);
                      } finally {
                        await refresh();
                        setBusy(false);
                      }
                    }}
                  >
                    {t("queue.retry")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
}
