"use client";

import { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMoney } from "@/components/currency-provider";
import { trpc } from "@/lib/trpc-client";

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

export function AuditSessionView({ sessionId }: { sessionId: string }) {
  const t = useTranslations("auditSession");
  const locale = useLocale();
  const money = useMoney();
  const utils = trpc.useUtils();
  const sessionQuery = trpc.audit.get.useQuery({ sessionId });
  const saveDraft = trpc.audit.saveDraft.useMutation();
  const apply = trpc.audit.applyAudit.useMutation();
  const settingsQuery = trpc.settings.get.useQuery();

  const [facts, setFacts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const session = sessionQuery.data;

  useEffect(() => {
    if (!session) return;
    const next: Record<string, string> = {};
    for (const line of session.lines) next[line.itemId] = String(line.factQty);
    setFacts(next);
  }, [session]);

  const changed = useMemo(() => {
    if (!session) return 0;
    return session.lines.filter((line) => {
      const value = Number(facts[line.itemId] ?? line.factQty);
      return Number.isInteger(value) && value !== line.expectedQty;
    }).length;
  }, [session, facts]);

  const valueTotals = useMemo(() => {
    if (!session) return { value: 0, surplus: 0, shortage: 0 };
    let value = 0;
    let surplus = 0;
    let shortage = 0;
    for (const line of session.lines) {
      const fact = Number(facts[line.itemId] ?? line.factQty);
      if (!Number.isInteger(fact)) continue;
      const amount = (fact - line.expectedQty) * line.priceKopecks;
      value += amount;
      if (amount > 0) surplus += amount;
      else shortage += -amount;
    }
    return { value, surplus, shortage };
  }, [session, facts]);

  async function handleSave() {
    if (!session) return;
    setError(null);
    setNotice(null);
    const lines: Array<{ itemId: string; factQty: number }> = [];
    for (const line of session.lines) {
      const raw = Number(facts[line.itemId] ?? line.factQty);
      if (!Number.isInteger(raw) || raw < 0) {
        setError(t("invalidQty", { name: line.itemName }));
        return;
      }
      lines.push({ itemId: line.itemId, factQty: raw });
    }
    try {
      await saveDraft.mutateAsync({ sessionId, lines });
      setNotice(t("draftSaved"));
      await utils.audit.get.invalidate({ sessionId });
      await utils.audit.list.invalidate();
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  async function handleApply() {
    if (!session) return;
    setError(null);
    setNotice(null);
    try {
      const result = await apply.mutateAsync({ sessionId });
      setNotice(
        t("appliedSummary", {
          changed: result.summary.changed,
          increase: result.summary.increase,
          decrease: result.summary.decrease,
          value: money(result.summary.valueKopecks),
        }),
      );
      await utils.audit.get.invalidate({ sessionId });
      await utils.audit.list.invalidate();
      await utils.items.list.invalidate();
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/audit/${sessionId}/photo`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("loadPhotoError"));
      }
      setNotice(t("photoUploaded"));
      await utils.audit.get.invalidate({ sessionId });
      await utils.audit.list.invalidate();
    } catch (uploadError) {
      setError(errorText(uploadError));
    } finally {
      setUploading(false);
    }
  }

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }
  if (sessionQuery.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {sessionQuery.error.message}
      </p>
    );
  }
  if (!session) return null;

  const isDraft = session.status === "DRAFT";
  const showDates = settingsQuery.data?.showDates ?? true;

  return (
    <div className="max-w-5xl space-y-6">
      <header className="space-y-1">
        <Link href="/admin/audit" className="text-sm text-primary underline">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("room", { number: session.roomNumber })}</h1>
        <p className="text-sm text-muted-foreground">
          {t("status")}: {isDraft ? t("draft") : t("applied")} · {t("author", { name: session.userFullName })} ·{" "}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(session.startedAt))}
          {session.appliedAt
            ? ` · ${t("appliedAt", { date: new Intl.DateTimeFormat(locale, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(session.appliedAt)) })}`
            : ""}
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {t("stockVsFact")}
            {isDraft ? ` · ${t("discrepancies", { count: changed })}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="whitespace-nowrap py-2 font-medium">{t("item")}</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t("book")}</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t("fact")}</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t("difference")}</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t("price")}</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t("valueDelta")}</th>
                {showDates ? <th className="whitespace-nowrap py-2 pl-4 font-medium">{t("receipt")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {session.lines.map((line) => {
                const factValue = Number(facts[line.itemId] ?? line.factQty);
                const delta = Number.isInteger(factValue) ? factValue - line.expectedQty : 0;
                return (
                  <tr key={line.itemId} className="border-b last:border-0">
                    <td className="py-2">
                      {line.itemName} <span className="text-muted-foreground">({line.unit})</span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{line.expectedQty}</td>
                    <td className="py-2 text-right">
                      {isDraft ? (
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={facts[line.itemId] ?? ""}
                          onChange={(event) =>
                            setFacts({ ...facts, [line.itemId]: event.target.value })
                          }
                          className="ml-auto h-9 w-20 text-right"
                        />
                      ) : (
                        <span className="tabular-nums">{line.factQty}</span>
                      )}
                    </td>
                    <td
                      className={`whitespace-nowrap py-2 pl-3 text-right tabular-nums ${
                        delta > 0 ? "text-green-700" : delta < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta === 0 ? "0" : String(delta)}
                    </td>
                    <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">
                      {money(line.priceKopecks)}
                    </td>
                    <td
                      className={`whitespace-nowrap py-2 pl-3 text-right tabular-nums ${
                        delta > 0 ? "text-green-700" : delta < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {money(delta * line.priceKopecks)}
                    </td>
                    {showDates ? (
                      <td className="whitespace-nowrap py-2 pl-4 text-muted-foreground">
                        {line.lastReceiptAt
                          ? new Intl.DateTimeFormat(locale).format(
                              new Date(line.lastReceiptAt),
                            )
                          : "—"}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-sm">
            {t("totalValue")} <strong>{money(valueTotals.value)}</strong>
            {" · "}{t("surplus", { value: money(valueTotals.surplus) })}
            {" · "}{t("shortage", { value: money(valueTotals.shortage) })}
          </p>

          {isDraft ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleSave} disabled={saveDraft.isPending}>
                {t("saveDraft")}
              </Button>
              <Button onClick={handleApply} disabled={apply.isPending}>
                {apply.isPending ? t("applying") : t("apply")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("applyWarning")}
              </span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("appliedLocked")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("photosTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPhotos")}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {session.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={`/api/photos/${photo.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-24 w-24 overflow-hidden rounded-md border"
                >
                  {/* Отдача только через авторизованный route handler */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.id}`}
                    alt={t("photoAlt")}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          {isDraft ? (
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                {t("photoPick")}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={uploading}
                onChange={(event) => {
                  void handleUpload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                className="block text-sm"
              />
            </label>
          ) : null}
          {uploading ? <p className="text-sm text-muted-foreground">{t("uploading")}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
