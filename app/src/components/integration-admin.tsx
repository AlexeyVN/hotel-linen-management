"use client";

import { TRPCClientError } from "@trpc/client";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

interface Status {
  enabled: boolean;
  mode: "stub" | "onec";
  baseUrl: string;
  login: string;
  passwordSet: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastError: string | null;
  outbox: { pending: number; sent: number; failed: number };
}

export function IntegrationAdmin() {
  const utils = trpc.useUtils();
  const t = useTranslations("integration");
  const tSettings = useTranslations("settings");
  const locale = useLocale();
  const statusQuery = trpc.integration.status.useQuery();
  const uiSettingsQuery = trpc.settings.get.useQuery();
  const currency = uiSettingsQuery.data?.currency;
  const save = trpc.integration.save.useMutation();
  const ping = trpc.integration.ping.useMutation();
  const syncItemsNow = trpc.integration.syncItemsNow.useMutation();
  const pushNow = trpc.integration.pushNow.useMutation();
  const roomStatusQuery = trpc.integration.roomStatusConfig.useQuery();
  const saveRoomStatus = trpc.integration.saveRoomStatusConfig.useMutation();
  const generateRoomStatusToken = trpc.integration.generateRoomStatusToken.useMutation();
  const pushRoomStatusesNow = trpc.integration.pushRoomStatusesNow.useMutation();

  const status = statusQuery.data as Status | undefined;
  const roomStatus = roomStatusQuery.data;

  const [form, setForm] = useState({
    enabled: false,
    mode: "stub" as "stub" | "onec",
    baseUrl: "",
    login: "",
    password: "",
    syncIntervalMinutes: 5,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roomForm, setRoomForm] = useState({
    enabled: false,
    path: "/hs/Housekeeping/v1/SetRoomStatus",
    method: "POST" as "POST" | "PUT",
  });
  const [revealedToken, setRevealedToken] = useState("");

  useEffect(() => {
    if (!status) return;
    setForm({
      enabled: status.enabled,
      mode: status.mode,
      baseUrl: status.baseUrl,
      login: status.login,
      password: "",
      syncIntervalMinutes: status.syncIntervalMinutes,
    });
  }, [status]);

  useEffect(() => {
    if (!roomStatus) return;
    setRoomForm({
      enabled: roomStatus.enabled,
      path: roomStatus.path,
      method: roomStatus.method,
    });
  }, [roomStatus]);

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      if (message) setNotice(message);
      await utils.integration.status.invalidate();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
      {currency && currency !== "RUB" ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {tSettings("integrationCurrencyGuard")}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { title: t("status"), value: status ? (status.enabled ? t("enabled") : t("disabled")) : "…" },
          { title: t("mode"), value: status?.mode === "onec" ? t("onec") : t("stub") },
          { title: t("queued"), value: status?.outbox.pending ?? 0 },
          { title: t("sentFailed"), value: `${status?.outbox.sent ?? 0} / ${status?.outbox.failed ?? 0}` },
        ].map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("connection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
            {t("integrationEnabled")}
          </label>

          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("modeLabel")}</span>
              <select
                value={form.mode}
                onChange={(event) =>
                  setForm({ ...form, mode: event.target.value as "stub" | "onec" })
                }
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="stub">{t("stubOption")}</option>
                <option value="onec">{t("onecOption")}</option>
              </select>
            </label>

            <label className="min-w-64 flex-1 text-sm">
              <span className="mb-1 block text-muted-foreground">{t("baseUrl")}</span>
              <Input
                value={form.baseUrl}
                placeholder="http://server-1c:8080/hotel"
                onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("interval")}</span>
              <Input
                type="number"
                min={1}
                max={1440}
                value={form.syncIntervalMinutes}
                onChange={(event) =>
                  setForm({ ...form, syncIntervalMinutes: Number(event.target.value) })
                }
                className="w-24"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("login")}</span>
              <Input
                value={form.login}
                onChange={(event) => setForm({ ...form, login: event.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">
                {t("password")} {status?.passwordSet ? t("passwordSet") : ""}
              </span>
              <Input
                type="password"
                value={form.password}
                placeholder={status?.passwordSet ? "••••••" : ""}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    save.mutateAsync({
                      enabled: form.enabled,
                      mode: form.mode,
                      baseUrl: form.baseUrl,
                      login: form.login,
                      password: form.password === "" ? undefined : form.password,
                      syncIntervalMinutes: form.syncIntervalMinutes,
                    }),
                  t("saved"),
                )
              }
            >
              {t("save")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                setNotice(null);
                try {
                  const result = await ping.mutateAsync();
                  setNotice(result.details ?? (result.ok ? t("connected") : t("noConnection")));
                } catch (pingError) {
                  setError(errorText(pingError));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("checkConnection")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await syncItemsNow.mutateAsync();
                  setNotice(
                    t("itemsLoaded", { created: result.created, updated: result.updated, total: result.total }),
                  );
                }, "")
              }
            >
              {t("loadItems")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await pushNow.mutateAsync();
                  setNotice(
                    t("queuePushed", { sent: result.sent, pending: result.pending, failed: result.failed }),
                  );
                }, "" )}
            >
              {t("pushQueue")}
            </Button>
          </div>

          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("lastSync")}</dt>
              <dd>{status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString(locale) : t("none")}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{t("lastError")}</dt>
              <dd className={status?.lastError ? "text-destructive" : ""}>
                {status?.lastError || t("none")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("roomStatuses")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("roomStatusIntro")}</p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={roomForm.enabled}
              onChange={(event) => setRoomForm({ ...roomForm, enabled: event.target.checked })}
            />
            {t("statusExchangeEnabled")}
          </label>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="text-sm lg:col-span-2">
              <span className="mb-1 block text-muted-foreground">
                {t("webhookUrl")}
              </span>
              <Input value={roomStatus?.webhookUrl ?? ""} readOnly className="font-mono text-xs" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("setRoomStatusPath")}</span>
              <Input
                value={roomForm.path}
                onChange={(event) => setRoomForm({ ...roomForm, path: event.target.value })}
                className="font-mono text-xs"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("method")}</span>
              <select
                value={roomForm.method}
                onChange={(event) =>
                  setRoomForm({ ...roomForm, method: event.target.value as "POST" | "PUT" })
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </label>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t("webhookToken")}</p>
                <p className="text-xs text-muted-foreground">
                  {roomStatus?.tokenSet
                    ? t("tokenSetHint") : t("tokenNotSetHint")}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  setNotice(null);
                  try {
                    const result = await generateRoomStatusToken.mutateAsync();
                    setRevealedToken(result.token);
                    setNotice(t("tokenCreated"));
                    await utils.integration.roomStatusConfig.invalidate();
                  } catch (tokenError) {
                    setError(errorText(tokenError));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {roomStatus?.tokenSet ? t("replaceToken") : t("generateToken")}
              </Button>
            </div>
            {revealedToken ? (
              <Input
                readOnly
                value={revealedToken}
                className="mt-2 font-mono text-xs"
                aria-label={t("webhookToken")}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await saveRoomStatus.mutateAsync(roomForm);
                  await utils.integration.roomStatusConfig.invalidate();
                }, t("savedStatus"))
              }
            >
              {t("saveStatus")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await pushRoomStatusesNow.mutateAsync();
                  setNotice(
                    t("statusesPushed", { sent: result.sent, pending: result.pending, failed: result.failed }),
                  );
                  await utils.integration.roomStatusConfig.invalidate();
                }, "")
              }
            >
              {t("pushStatuses")}
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <div><dt className="text-muted-foreground">{t("statusQueued")}</dt><dd className="font-medium">{roomStatus?.stats.pending ?? 0}</dd></div>
            <div><dt className="text-muted-foreground">{t("statusSent")}</dt><dd className="font-medium">{roomStatus?.stats.sent ?? 0}</dd></div>
            <div><dt className="text-muted-foreground">{t("statusErrors")}</dt><dd className="font-medium">{roomStatus?.stats.failed ?? 0}</dd></div>
            <div><dt className="text-muted-foreground">{t("statusApplied")}</dt><dd className="font-medium">{roomStatus?.stats.applied ?? 0}</dd></div>
            <div><dt className="text-muted-foreground">{t("statusIgnored")}</dt><dd className="font-medium">{roomStatus?.stats.ignored ?? 0}</dd></div>
          </dl>

          <p className="text-xs text-amber-700">{t("contractWarning")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
