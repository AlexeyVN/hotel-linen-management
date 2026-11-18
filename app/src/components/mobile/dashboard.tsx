"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { OfflineQueuePanel } from "@/components/offline-queue-panel";
import { trpc } from "@/lib/trpc-client";

export function MobileDashboard({ fullName }: { fullName: string }) {
  const t = useTranslations("mobile");
  const locale = useLocale();
  const utils = trpc.useUtils();
  const dashboardQuery = trpc.cleaning.dashboard.useQuery();
  const shiftQuery = trpc.cleaning.shiftStatus.useQuery();
  const startShift = trpc.cleaning.startShift.useMutation();
  const endShift = trpc.cleaning.endShift.useMutation();

  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const quickActions = [
    { href: "/m/audit", title: t("actions.audit"), subtitle: t("actions.auditSubtitle") },
    {
      href: "/m/distribute",
      title: t("actions.distribute"),
      subtitle: t("actions.distributeSubtitle"),
    },
    { href: "/m/scan", title: t("actions.scan"), subtitle: t("actions.scanSubtitle") },
  ];

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

  const stats = dashboardQuery.data;
  const shift = shiftQuery.data;

  const shiftStart = shift?.startedAt
    ? new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(shift.startedAt))
    : null;

  async function toggleShift() {
    setBusy(true);
    setNotice(null);
    try {
      if (shift?.active) {
        await endShift.mutateAsync();
        setNotice(t("dashboard.shiftEnded"));
      } else {
        await startShift.mutateAsync();
        setNotice(t("dashboard.shiftStarted"));
      }
      await Promise.all([
        utils.cleaning.shiftStatus.invalidate(),
        utils.cleaning.dashboard.invalidate(),
        utils.cleaning.listMine.invalidate(),
      ]);
    } finally {
      setBusy(false);
    }
  }

  const statCards = [
    {
      label: t("dashboard.stats.myTasks"),
      value: stats ? stats.tasks.new + stats.tasks.inProgress : 0,
      tone: "",
    },
    { label: t("dashboard.stats.inProgress"), value: stats?.tasks.inProgress ?? 0, tone: "text-amber-700" },
    { label: t("dashboard.stats.done"), value: stats?.tasks.done ?? 0, tone: "text-green-700" },
    { label: t("dashboard.stats.dirty"), value: stats?.rooms.dirty ?? 0, tone: "text-red-700" },
    { label: t("dashboard.stats.clean"), value: stats?.rooms.clean ?? 0, tone: "text-green-700" },
    { label: t("dashboard.stats.inspected"), value: stats?.rooms.inspected ?? 0, tone: "text-primary" },
    {
      label: t("dashboard.stats.outOfOrder"),
      value: stats?.rooms.outOfOrder ?? 0,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{t("dashboard.greeting")}</h1>
          <p className="text-sm text-muted-foreground">{fullName}</p>
        </div>
        <span
          className={
            online
              ? "rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
              : "rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
          }
        >
          {online ? t("online.online") : t("online.offline")}
        </span>
      </header>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {shift?.active ? t("dashboard.shiftActive") : t("dashboard.shiftInactive")}
            </p>
            <p className="text-xs text-muted-foreground">
              {shift?.active && shiftStart
                ? t("dashboard.shiftSince", { time: shiftStart })
                : t("dashboard.shiftStartHint")}
            </p>
          </div>
          <Button
            className="h-11"
            variant={shift?.active ? "outline" : "default"}
            disabled={busy}
            onClick={toggleShift}
          >
            {shift?.active ? t("dashboard.shiftEnd") : t("dashboard.shiftStart")}
          </Button>
        </div>
        {notice ? <p className="mt-2 text-xs text-green-700">{notice}</p> : null}
      </section>

      <section className="grid grid-cols-3 gap-2">
        {statCards.slice(0, 6).map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-xl font-semibold tabular-nums ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <Link
        href="/m/tasks"
        className="flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm active:bg-muted"
      >
        <span>
          <span className="block text-lg font-semibold">{t("dashboard.myTasksTitle")}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {t("dashboard.myTasksSubtitle")}
          </span>
        </span>
        <span aria-hidden className="text-2xl text-muted-foreground">
          ›
        </span>
      </Link>

      <Link
        href="/m/rooms"
        className="flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm active:bg-muted"
      >
        <span>
          <span className="block text-lg font-semibold">{t("dashboard.myRoomsTitle")}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {t("dashboard.myRoomsSubtitle")}
          </span>
        </span>
        <span aria-hidden className="text-2xl text-muted-foreground">
          ›
        </span>
      </Link>

      <OfflineQueuePanel />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("dashboard.actionsTitle")}</h2>
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center justify-between rounded-xl border bg-card p-4 active:bg-muted"
          >
            <span>
              <span className="block text-sm font-medium">{action.title}</span>
              <span className="text-xs text-muted-foreground">{action.subtitle}</span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
