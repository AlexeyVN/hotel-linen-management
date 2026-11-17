"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CLEANING_TYPE_LABELS,
  PRIORITY_LABELS,
  ROOM_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain/cleaning";
import { MAID_STATUS_LABELS, type MaidWorkStatus } from "@/lib/domain/maids";
import { trpc } from "@/lib/trpc-client";
import { DataTable } from "@/components/ui/data-table";

function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const now = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function formatTime(value: string | Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { timeStyle: "short" }).format(new Date(value));
}

function formatDateTime(value: string | Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

const STATUS_TONE: Record<MaidWorkStatus, string> = {
  WORKING: "bg-amber-50 text-amber-800",
  ON_SHIFT: "bg-green-50 text-green-700",
  OFF_SHIFT: "bg-muted text-muted-foreground",
  INACTIVE: "bg-red-50 text-red-700",
};

export function MaidsAdmin() {
  const [date, setDate] = useState(localToday());
  const [maidId, setMaidId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(localToday());

  const overviewQuery = trpc.cleaning.maidsOverview.useQuery({ date });
  const archiveQuery = trpc.cleaning.maidArchive.useQuery({
    from,
    to,
    maidId: maidId || undefined,
    status: status
      ? (status as "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED")
      : undefined,
  });

  const maids = overviewQuery.data?.maids ?? [];
  const archive = archiveQuery.data;

  const excelHref = `/api/reports/export?report=maid-tasks&from=${from}&to=${to}${
    maidId ? `&maidId=${maidId}` : ""
  }${status ? `&status=${status}` : ""}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Горничные</h1>
          <p className="text-sm text-muted-foreground">
            Смены, закреплённые номера, выполнение плана за дату и архив заданий.
          </p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Дата</span>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </header>

      {overviewQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Загружаем горничных…</p>
      ) : maids.length === 0 ? (
        <p className="text-sm text-muted-foreground">Горничных нет.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {maids.map((maid) => (
            <Card key={maid.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{maid.fullName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{maid.login}</p>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
                      STATUS_TONE[maid.status]
                    }`}
                  >
                    {MAID_STATUS_LABELS[maid.status]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {maid.shift.active
                    ? `Смена с ${formatTime(maid.shift.startedAt)}`
                    : "Смена не начата"}
                  {maid.shift.overdue ? (
                    <span className="ml-2 text-amber-700">· смена не закрыта</span>
                  ) : null}
                </p>

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Закреплённые номера
                  </p>
                  {maid.rooms.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Не закреплены</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {maid.rooms.map((room) => (
                        <span
                          key={room.id}
                          className="rounded border px-1.5 py-0.5 text-xs"
                          title={ROOM_STATUS_LABELS[room.cleaningStatus] ?? room.cleaningStatus}
                        >
                          {room.number}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">План на дату</span>
                    <span className="tabular-nums">
                      {maid.plan.plan === 0
                        ? "—"
                        : `${maid.plan.done} из ${maid.plan.plan} · ${maid.plan.percent}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${maid.plan.percent ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Номеров убрано: {maid.plan.roomsDone} · отменено: {maid.plan.cancelled}
                    {maid.plan.avgMinutes !== null ? ` · среднее ${maid.plan.avgMinutes} мин` : ""}
                  </p>
                </div>

                {maid.currentTask ? (
                  <Link
                    href="/admin/cleaning"
                    className="block rounded-md border bg-muted/40 p-2 text-xs hover:bg-muted"
                  >
                    В работе: номер {maid.currentTask.roomNumber} ·{" "}
                    {CLEANING_TYPE_LABELS[maid.currentTask.type] ?? maid.currentTask.type}
                    {" · "}с {formatTime(maid.currentTask.startedAt)}
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">Активной задачи нет</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Архив заданий по датам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Горничная</span>
              <select
                value={maidId}
                onChange={(event) => setMaidId(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">Все</option>
                {maids.map((maid) => (
                  <option key={maid.id} value={maid.id}>
                    {maid.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">С даты</span>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">По дату</span>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Статус</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">Все</option>
                <option value="NEW">Новая</option>
                <option value="IN_PROGRESS">В работе</option>
                <option value="DONE">Выполнена</option>
                <option value="CANCELLED">Отменена</option>
              </select>
            </label>
            <a
              href={excelHref}
              className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
            >
              Скачать Excel
            </a>
          </div>

          <p className="text-sm text-muted-foreground">
            Всего: {archive?.summary.total ?? 0} · выполнено: {archive?.summary.done ?? 0} · в работе:{" "}
            {archive?.summary.inProgress ?? 0} · отменено: {archive?.summary.cancelled ?? 0}
            {archive?.summary.avgMinutes !== null && archive?.summary.avgMinutes !== undefined
              ? ` · среднее время: ${archive.summary.avgMinutes} мин`
              : ""}
          </p>

          {archiveQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Загружаем архив…</p>
          ) : (archive?.tasks.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">За выбранный период заданий нет.</p>
          ) : (
            <DataTable minWidth="1000px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 font-medium">Дата</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Горничная</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Номер</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Тип</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Приоритет</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Статус</th>
                  <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">План, мин</th>
                  <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">Факт, мин</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Начало</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">Завершение</th>
                </tr>
              </thead>
              <tbody>
                {archive?.tasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-2">{formatDateTime(task.createdAt)}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{task.maidName}</td>
                    <td className="whitespace-nowrap py-2 pl-3 font-medium">{task.roomNumber}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{CLEANING_TYPE_LABELS[task.type] ?? task.type}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{PRIORITY_LABELS[task.priority] ?? task.priority}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{TASK_STATUS_LABELS[task.status] ?? task.status}</td>
                    <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">{task.plannedMinutes ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">{task.durationMinutes ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{formatDateTime(task.startedAt)}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{formatDateTime(task.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
