"use client";

import { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMutation } from "@/lib/offline/db";
import { readCache, writeCache } from "@/lib/offline/cache";
import { trpc } from "@/lib/trpc-client";

interface SessionLine {
  itemId: string;
  itemName: string;
  unit: string;
  expectedQty: number;
  factQty: number;
  delta: number;
}

interface SessionData {
  id: string;
  roomId: string;
  roomNumber: string;
  status: string;
  startedAt: string | Date;
  appliedAt: string | Date | null;
  operationId: string | null;
  userFullName: string;
  lines: SessionLine[];
  photos: Array<{ id: string; mimeType: string; createdAt: string | Date }>;
}

function cacheKey(sessionId: string): string {
  return `cache.audit.session.${sessionId}`;
}

function formatDate(value: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MobileAuditSession({ sessionId }: { sessionId: string }) {
  const t = useTranslations("mobile");
  const ta = useTranslations("auditSession");
  const locale = useLocale();
  const utils = trpc.useUtils();
  const query = trpc.audit.get.useQuery({ sessionId }, { retry: false });
  const saveMutation = trpc.audit.saveDraft.useMutation();
  const applyMutation = trpc.audit.applyAudit.useMutation();

  const [data, setData] = useState<SessionData | null>(null);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (query.data) {
      const sessionData = query.data as unknown as SessionData;
      setData(sessionData);
      writeCache(cacheKey(sessionId), sessionData);
      const next: Record<string, string> = {};
      for (const line of sessionData.lines) next[line.itemId] = String(line.factQty);
      setFacts(next);
    } else if (query.isError) {
      const cached = readCache<SessionData>(cacheKey(sessionId));
      if (cached) {
        setData(cached);
        const next: Record<string, string> = {};
        for (const line of cached.lines) next[line.itemId] = String(line.factQty);
        setFacts(next);
      }
    }
  }, [query.data, query.isError, sessionId]);

  if (query.isLoading && !data) {
    return <p className="p-4 text-sm text-muted-foreground">{ta("loading")}</p>;
  }
  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <p role="alert" className="text-sm text-destructive">
          {query.error?.message ?? t("auditSession.notFound")}
        </p>
        <Link href="/m/audit" className="text-sm text-primary underline">
          {t("auditSession.back")}
        </Link>
      </div>
    );
  }

  const isDraft = data.status === "DRAFT";

  function buildLines(): Array<{ itemId: string; factQty: number }> | null {
    if (!data) return null;
    const lines: Array<{ itemId: string; factQty: number }> = [];
    for (const line of data.lines) {
      const raw = Number(facts[line.itemId] ?? line.factQty);
      if (!Number.isInteger(raw) || raw < 0) {
        setError(ta("invalidQty", { name: line.itemName }));
        return null;
      }
      lines.push({ itemId: line.itemId, factQty: raw });
    }
    return lines;
  }

  async function handleSave() {
    setError(null);
    setNotice(null);
    if (!data) return;
    const lines = buildLines();
    if (!lines) return;
    setBusy(true);
    try {
      if (!navigator.onLine) {
        await addMutation({
          kind: "SAVE_AUDIT_DRAFT",
          label: t("queue.draftLabel", { room: data.roomNumber }),
          payload: { sessionId, lines },
          clientOpId: `draft-${sessionId}-${Date.now()}`,
        });
        setNotice(t("auditSession.offlineDraftQueued"));
        return;
      }
      await saveMutation.mutateAsync({ sessionId, lines });
      setNotice(ta("draftSaved"));
      await utils.audit.get.invalidate({ sessionId });
    } catch (mutationError) {
      setError(
        mutationError instanceof TRPCClientError
          ? mutationError.message
          : t("auditSession.draftError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    setError(null);
    setNotice(null);
    if (!data) return;
    if (!navigator.onLine) {
      await addMutation({
        kind: "APPLY_AUDIT",
        label: t("queue.applyLabel", { room: data.roomNumber }),
        payload: { sessionId },
        clientOpId: `audit-${sessionId}`,
      });
      setNotice(t("auditSession.offlineApplyQueued"));
      return;
    }
    setBusy(true);
    try {
      const result = await applyMutation.mutateAsync({ sessionId });
      setNotice(
        t("auditSession.appliedSummaryNoValue", {
          changed: result.summary.changed,
          increase: result.summary.increase,
          decrease: result.summary.decrease,
        }),
      );
      await utils.audit.get.invalidate({ sessionId });
      await utils.audit.list.invalidate();
      await utils.items.list.invalidate();
    } catch (mutationError) {
      setError(
        mutationError instanceof TRPCClientError
          ? mutationError.message
          : t("auditSession.applyError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(file: File | null) {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!navigator.onLine) {
      setError(t("errors.photoOffline"));
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/audit/${sessionId}/photo`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? t("errors.photoUpload"));
      }
      setNotice(ta("photoUploaded"));
      await utils.audit.get.invalidate({ sessionId });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : t("errors.photoUploadGeneric"),
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <Link href="/m/audit" className="text-sm text-primary underline">
          {t("auditSession.back")}
        </Link>
        <h1 className="text-xl font-semibold">
          {t("labels.roomNumber", { number: data.roomNumber })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDraft ? t("auditSession.statusDraft") : t("auditSession.statusApplied")} ·{" "}
          {data.userFullName} · {formatDate(data.startedAt, locale)}
        </p>
        {!isDraft && data.appliedAt ? (
          <p className="text-xs text-muted-foreground">
            {t("auditSession.appliedAt", { date: formatDate(data.appliedAt, locale) })}
          </p>
        ) : null}
        {!online ? (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            {t("auditSession.offlineHint")}
          </p>
        ) : null}
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <section className="space-y-2">
        {data.lines.map((line) => {
          const factValue = Number(facts[line.itemId] ?? line.factQty);
          const delta = Number.isInteger(factValue) ? factValue - line.expectedQty : 0;
          return (
            <div key={line.itemId} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{line.itemName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("auditSession.bookQty", { qty: line.expectedQty, unit: line.unit })}
                    {delta !== 0 ? (
                      <span className={delta > 0 ? " text-green-700" : " text-destructive"}>
                        {" "}
                        · {t("auditSession.delta", { delta: delta > 0 ? `+${delta}` : delta })}
                      </span>
                    ) : null}
                  </p>
                </div>
                {isDraft ? (
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={facts[line.itemId] ?? ""}
                    onChange={(event) =>
                      setFacts({ ...facts, [line.itemId]: event.target.value })
                    }
                    className="h-12 w-24 text-right text-base"
                  />
                ) : (
                  <span className="text-base font-semibold tabular-nums">{line.factQty}</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {isDraft ? (
        <div className="space-y-2">
          <Button className="h-12 w-full text-base" onClick={handleApply} disabled={busy}>
            {busy ? ta("applying") : ta("apply")}
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full text-base"
            onClick={handleSave}
            disabled={busy}
          >
            {ta("saveDraft")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{ta("appliedLocked")}</p>
      )}

      <section className="rounded-xl border bg-card p-3">
        <h2 className="text-sm font-medium">{t("auditSession.photosTitle")}</h2>
        {data.photos.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.photos.map((photo) => (
              <a
                key={photo.id}
                href={`/api/photos/${photo.id}`}
                target="_blank"
                rel="noreferrer"
                className="block h-20 w-20 overflow-hidden rounded-md border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${photo.id}`}
                  alt={ta("photoAlt")}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{ta("noPhotos")}</p>
        )}
        {isDraft ? (
          <label className="mt-2 block text-sm">
            <span className="text-xs text-muted-foreground">{t("auditSession.photoCamera")}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={uploading || !online}
              onChange={(event) => {
                void handlePhoto(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
              className="mt-1 block w-full text-sm"
            />
          </label>
        ) : null}
        {uploading ? <p className="text-xs text-muted-foreground">{ta("uploading")}</p> : null}
      </section>
    </div>
  );
}
