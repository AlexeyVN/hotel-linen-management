"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { OfflineQueuePanel } from "@/components/offline-queue-panel";
import { trpc } from "@/lib/trpc-client";

const QUICK_ACTIONS = [
  { href: "/m/audit", title: "Инвентаризация", subtitle: "Сверить остатки номера" },
  { href: "/m/distribute", title: "Раздача", subtitle: "Бельё и химия со склада" },
  { href: "/m/scan", title: "Сканировать QR", subtitle: "Открыть номер по метке" },
];

export function MobileDashboard({ fullName }: { fullName: string }) {
  const utils = trpc.useUtils();
  const dashboardQuery = trpc.cleaning.dashboard.useQuery();
  const shiftQuery = trpc.cleaning.shiftStatus.useQuery();
  const startShift = trpc.cleaning.startShift.useMutation();
  const endShift = trpc.cleaning.endShift.useMutation();

  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
    ? new Intl.DateTimeFormat("ru-RU", { timeStyle: "short" }).format(new Date(shift.startedAt))
    : null;

  async function toggleShift() {
    setBusy(true);
    setNotice(null);
    try {
      if (shift?.active) {
        await endShift.mutateAsync();
        setNotice("Смена завершена");
      } else {
        await startShift.mutateAsync();
        setNotice("Смена начата");
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
    { label: "Мои задачи", value: stats ? stats.tasks.new + stats.tasks.inProgress : 0, tone: "" },
    { label: "В работе", value: stats?.tasks.inProgress ?? 0, tone: "text-amber-700" },
    { label: "Выполнено", value: stats?.tasks.done ?? 0, tone: "text-green-700" },
    { label: "Грязные", value: stats?.rooms.dirty ?? 0, tone: "text-red-700" },
    { label: "Чистые", value: stats?.rooms.clean ?? 0, tone: "text-green-700" },
    { label: "Проверено", value: stats?.rooms.inspected ?? 0, tone: "text-primary" },
    { label: "В ремонте", value: stats?.rooms.outOfOrder ?? 0, tone: "text-muted-foreground" },
  ];

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Здравствуйте!</h1>
          <p className="text-sm text-muted-foreground">{fullName}</p>
        </div>
        <span
          className={
            online
              ? "rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
              : "rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
          }
        >
          {online ? "онлайн" : "офлайн"}
        </span>
      </header>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{shift?.active ? "Смена идёт" : "Смена не начата"}</p>
            <p className="text-xs text-muted-foreground">
              {shift?.active && shiftStart ? `с ${shiftStart}` : "Начните день, чтобы видеть задачи"}
            </p>
          </div>
          <Button
            className="h-11"
            variant={shift?.active ? "outline" : "default"}
            disabled={busy}
            onClick={toggleShift}
          >
            {shift?.active ? "Завершить" : "Начать смену"}
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
          <span className="block text-lg font-semibold">Мои уборки</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Активные задачи по приоритету
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
          <span className="block text-lg font-semibold">Мои номера</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Статусы: грязно · убрано · проверено
          </span>
        </span>
        <span aria-hidden className="text-2xl text-muted-foreground">
          ›
        </span>
      </Link>

      <OfflineQueuePanel />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Действия</h2>
        {QUICK_ACTIONS.map((action) => (
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
