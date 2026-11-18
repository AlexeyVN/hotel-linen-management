"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
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

function formatTime(value: string | Date | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(value));
}

function formatDateTime(value: string | Date | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
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
  const t = useTranslations("maids");
  const locale = useLocale();
  const typeLabels: Record<string, string> = {
    DAILY: t("daily"),
    ON_DEMAND: t("onDemand"),
    GENERAL: t("general"),
  };
  const priorityLabels: Record<string, string> = {
    LOW: t("low"),
    MEDIUM: t("medium"),
    URGENT: t("urgent"),
  };
  const taskStatusLabels: Record<string, string> = {
    NEW: t("taskNew"),
    IN_PROGRESS: t("taskInProgress"),
    DONE: t("taskDone"),
    CANCELLED: t("taskCancelled"),
  };
  const roomStatusLabels: Record<string, string> = {
    CLEAN: t("clean"),
    DIRTY: t("dirty"),
    INSPECTED: t("inspected"),
    OUT_OF_ORDER: t("outOfOrder"),
  };
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
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("intro")}
          </p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">{t("date")}</span>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </header>

      {overviewQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : maids.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMaids")}</p>
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
                    {t(maid.status === "WORKING" ? "working" : maid.status === "ON_SHIFT" ? "onShift" : maid.status === "OFF_SHIFT" ? "offShift" : "inactive")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {maid.shift.active
                    ? t("shiftSince", { time: formatTime(maid.shift.startedAt, locale) })
                    : t("shiftNotStarted")}
                  {maid.shift.overdue ? (
                    <span className="ml-2 text-amber-700">{t("shiftOpen")}</span>
                  ) : null}
                </p>

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("assignedRooms")}
                  </p>
                  {maid.rooms.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("notAssigned")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {maid.rooms.map((room) => (
                        <span
                          key={room.id}
                          className="rounded border px-1.5 py-0.5 text-xs"
                          title={roomStatusLabels[room.cleaningStatus] ?? room.cleaningStatus}
                        >
                          {room.number}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("planForDate")}</span>
                    <span className="tabular-nums">
                      {maid.plan.plan === 0
                        ? "—"
                        : t("doneOf", { done: maid.plan.done, plan: maid.plan.plan, percent: maid.plan.percent ?? 0 })}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${maid.plan.percent ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("roomsDone", { count: maid.plan.roomsDone })} · {t("cancelled", { count: maid.plan.cancelled })}
                    {maid.plan.avgMinutes !== null ? t("avgMinutes", { count: maid.plan.avgMinutes }) : ""}
                  </p>
                </div>

                {maid.currentTask ? (
                  <Link
                    href="/admin/cleaning"
                    className="block rounded-md border bg-muted/40 p-2 text-xs hover:bg-muted"
                  >
                    {t("currentTask", { number: maid.currentTask.roomNumber, type: typeLabels[maid.currentTask.type] ?? maid.currentTask.type })}
                    {maid.currentTask.type}
                    {t("since", { time: formatTime(maid.currentTask.startedAt, locale) })}
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("noActive")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("archive")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("maid")}</span>
              <select
                value={maidId}
                onChange={(event) => setMaidId(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">{t("all")}</option>
                {maids.map((maid) => (
                  <option key={maid.id} value={maid.id}>
                    {maid.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("from")}</span>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("to")}</span>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("status")}</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">{t("all")}</option>
                <option value="NEW">{t("taskNew")}</option>
                <option value="IN_PROGRESS">{t("taskInProgress")}</option>
                <option value="DONE">{t("taskDone")}</option>
                <option value="CANCELLED">{t("taskCancelled")}</option>
              </select>
            </label>
            <a
              href={excelHref}
              className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
            >
              {t("downloadExcel")}
            </a>
          </div>

          <p className="text-sm text-muted-foreground">
            {t("total", { count: archive?.summary.total ?? 0 })} · {t("completed", { count: archive?.summary.done ?? 0 })} · {t("inWork", { count: archive?.summary.inProgress ?? 0 })}
            {t("cancelledSummary", { count: archive?.summary.cancelled ?? 0 })}
            {archive?.summary.avgMinutes !== null && archive?.summary.avgMinutes !== undefined
              ? t("avgTime", { count: archive.summary.avgMinutes })
              : ""}
          </p>

          {archiveQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("loadingArchive")}</p>
          ) : (archive?.tasks.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPeriod")}</p>
          ) : (
            <DataTable minWidth="1000px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 font-medium">{t("date")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">{t("maid")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">{t("roomHeader")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">{t("typeHeader")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">{t("priorityHeader")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">{t("status")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t("planHeader")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">{t("factHeader")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">{t("startHeader")}</th>
                  <th className="whitespace-nowrap py-2 pl-3 font-medium">{t("endHeader")}</th>
                </tr>
              </thead>
              <tbody>
                {archive?.tasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-2">{formatDateTime(task.createdAt, locale)}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{task.maidName}</td>
                    <td className="whitespace-nowrap py-2 pl-3 font-medium">{task.roomNumber}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{typeLabels[task.type] ?? task.type}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{priorityLabels[task.priority] ?? task.priority}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{taskStatusLabels[task.status] ?? task.status}</td>
                    <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">{task.plannedMinutes ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">{task.durationMinutes ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{formatDateTime(task.startedAt, locale)}</td>
                    <td className="whitespace-nowrap py-2 pl-3">{formatDateTime(task.finishedAt, locale)}</td>
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
