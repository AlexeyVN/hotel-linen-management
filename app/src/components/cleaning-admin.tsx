"use client";

import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CLEANING_TYPE_LABELS,
  PRIORITY_LABELS,
  ROOM_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain/cleaning";
import { trpc } from "@/lib/trpc-client";
import { DataTable } from "@/components/ui/data-table";

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

function defaultRange() {
  const now = new Date();
  const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export function CleaningAdmin() {
  const t = useTranslations("cleaning");
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
  const roomStatusLabels: Record<string, string> = {
    CLEAN: t("clean"),
    DIRTY: t("dirty"),
    INSPECTED: t("inspected"),
    OUT_OF_ORDER: t("outOfOrder"),
  };
  const taskStatusLabels: Record<string, string> = {
    NEW: t("taskNew"),
    IN_PROGRESS: t("taskInProgress"),
    DONE: t("taskDone"),
    CANCELLED: t("taskCancelled"),
  };
  const utils = trpc.useUtils();
  const roomsQuery = trpc.cleaning.rooms.useQuery();
  const assigneesQuery = trpc.cleaning.assignees.useQuery();
  const [statusFilter, setStatusFilter] = useState<"" | "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED">("");
  const tasksQuery = trpc.cleaning.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined,
  );
  const [range] = useState(defaultRange);
  const reportQuery = trpc.cleaning.report.useQuery({ from: range.from, to: range.to });

  const createTask = trpc.cleaning.create.useMutation();
  const assign = trpc.cleaning.assign.useMutation();
  const setStatus = trpc.cleaning.setStatus.useMutation();
  const setRoomStatus = trpc.cleaning.setRoomStatus.useMutation();
  const templatesQuery = trpc.checklists.list.useQuery();
  const attachChecklist = trpc.checklists.attachToTask.useMutation();

  const [form, setForm] = useState({
    roomId: "",
    type: "DAILY" as "DAILY" | "ON_DEMAND" | "GENERAL",
    priority: "MEDIUM" as "URGENT" | "MEDIUM" | "LOW",
    assigneeId: "",
    plannedMinutes: "30",
    comment: "",
    checklistTemplateId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rooms = roomsQuery.data ?? [];
  const assignees = assigneesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const report = reportQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  async function refresh() {
    await Promise.all([
      utils.cleaning.list.invalidate(),
      utils.cleaning.rooms.invalidate(),
      utils.cleaning.report.invalidate(),
      utils.checklists.list.invalidate(),
    ]);
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      setNotice(message);
      await refresh();
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
        <p className="text-sm text-muted-foreground">
          {t("intro")}
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
          <CardTitle>{t("newTask")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("room")}</span>
              <select
                value={form.roomId}
                onChange={(event) => setForm({ ...form, roomId: event.target.value })}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">{t("choose")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.number} · {room.roomTypeName} ({roomStatusLabels[room.cleaningStatus]})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("type")}</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as typeof form.type })
                }
                className="h-10 rounded-md border bg-background px-3"
              >
                {Object.entries(typeLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("priority")}</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value as typeof form.priority })
                }
                className="h-10 rounded-md border bg-background px-3"
              >
                {Object.entries(priorityLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("assignee")}</span>
              <select
                value={form.assigneeId}
                onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">{t("unassigned")}</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("checklist")}</span>
              <select
                value={form.checklistTemplateId}
                onChange={(event) =>
                  setForm({ ...form, checklistTemplateId: event.target.value })
                }
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">{t("noChecklist")}</option>
                {templates
                  .filter((template) => template.isActive)
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("planMinutes")}</span>
              <Input
                type="number"
                min={5}
                max={600}
                value={form.plannedMinutes}
                onChange={(event) => setForm({ ...form, plannedMinutes: event.target.value })}
                className="w-24"
              />
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    createTask.mutateAsync({
                      roomId: form.roomId,
                      type: form.type,
                      priority: form.priority,
                      assigneeId: form.assigneeId || undefined,
                      plannedMinutes: Number(form.plannedMinutes) || undefined,
                      comment: form.comment || undefined,
                      checklistTemplateId: form.checklistTemplateId || undefined,
                    }),
                  t("created"),
                )
              }
            >
              {t("createTask")}
            </Button>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted-foreground">{t("comment")}</span>
            <Input
              value={form.comment}
              maxLength={300}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("tasks")} ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">{t("statusFilter")}</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as typeof statusFilter)
              }
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">{t("all")}</option>
              {Object.entries(taskStatusLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <DataTable minWidth="1000px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">{t("room")}</th>
                  <th className="py-2 font-medium">{t("type")}</th>
                  <th className="py-2 font-medium">{t("priority")}</th>
                  <th className="py-2 font-medium">{t("statusHeader")}</th>
                  <th className="py-2 font-medium">{t("assignee")}</th>
                  <th className="py-2 font-medium">{t("checklist")}</th>
                  <th className="py-2 font-medium">{t("planHeader")}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{task.roomNumber}</td>
                    <td className="py-2">{typeLabels[task.type] ?? task.type}</td>
                    <td className="py-2">
                      <span
                        className={
                          task.priority === "URGENT"
                            ? "text-destructive"
                            : task.priority === "MEDIUM"
                              ? "text-amber-700"
                              : "text-green-700"
                        }
                      >
                        {priorityLabels[task.priority] ?? task.priority}
                      </span>
                    </td>
                    <td className="py-2">{taskStatusLabels[task.status] ?? task.status}</td>
                    <td className="py-2">
                      {task.status === "NEW" ? (
                        <select
                          value={task.assigneeId ?? ""}
                          onChange={(event) =>
                            run(
                              () =>
                                assign.mutateAsync({
                                  taskId: task.id,
                                  assigneeId: event.target.value || null,
                                }),
                              t("assigned"),
                            )
                          }
                          className="h-9 rounded-md border bg-background px-2"
                        >
                          <option value="">{t("unassigned")}</option>
                          {assignees.map((assignee) => (
                            <option key={assignee.id} value={assignee.id}>
                              {assignee.fullName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        task.assigneeName ?? "—"
                      )}
                    </td>
                    <td className="py-2">{task.plannedMinutes ? t("minutesShort", { count: task.plannedMinutes }) : "—"}</td>
                    <td className="py-2">
                      {task.checklist ? (
                        <span className="text-xs">
                          {task.checklist.name}
                          <span className="block text-muted-foreground">
                            {t("answered", { count: task.checklist.answered })}
                          </span>
                        </span>
                      ) : task.status === "NEW" ? (
                        <select
                          value=""
                          onChange={(event) =>
                            event.target.value
                              ? run(
                                  () =>
                                    attachChecklist.mutateAsync({
                                      taskId: task.id,
                                      templateId: event.target.value,
                                    }),
                                  t("attached"),
                                )
                              : undefined
                          }
                          className="h-9 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="">{t("attach")}</option>
                          {templates
                            .filter((template) => template.isActive)
                            .map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {task.status === "NEW" || task.status === "IN_PROGRESS" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                setStatus.mutateAsync({ taskId: task.id, status: "CANCELLED" }),
                              t("cancelled"),
                            )
                          }
                        >
                          {t("cancel")}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("statuses")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable minWidth="1000px">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">{t("room")}</th>
                <th className="py-2 font-medium">{t("floor")}</th>
                <th className="py-2 font-medium">{t("type")}</th>
                <th className="py-2 font-medium">{t("cleaningStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{room.number}</td>
                  <td className="py-2">{room.floorLabel}</td>
                  <td className="py-2">{room.roomTypeName}</td>
                  <td className="py-2">
                    <select
                      value={room.cleaningStatus}
                      onChange={(event) =>
                        run(
                          () =>
                            setRoomStatus.mutateAsync({
                              roomId: room.id,
                              status: event.target.value as
                                | "CLEAN"
                                | "DIRTY"
                                | "INSPECTED"
                                | "OUT_OF_ORDER",
                            }),
                          t("roomStatusUpdated", { number: room.number }),
                        )
                      }
                      className="h-9 rounded-md border bg-background px-2"
                    >
                      {Object.entries(roomStatusLabels).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("reportPeriod", { from: range.from, to: range.to })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href={`/api/reports/export?report=tasks&from=${range.from}&to=${range.to}`}
            className="inline-flex h-10 items-center rounded-md border border-primary px-4 text-sm text-primary hover:bg-muted"
          >
            {t("downloadExcel")}
          </a>
          {report.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTasksPeriod")}</p>
          ) : (
            <DataTable minWidth="1000px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">{t("assignee")}</th>
                  <th className="py-2 text-right font-medium">{t("total")}</th>
                  <th className="py-2 text-right font-medium">{t("done")}</th>
                  <th className="py-2 text-right font-medium">{t("inProgress")}</th>
                  <th className="py-2 text-right font-medium">{t("cancelledCount")}</th>
                  <th className="py-2 text-right font-medium">{t("avgMinutes")}</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.assigneeId} className="border-b last:border-0">
                    <td className="py-2">{row.assigneeName}</td>
                    <td className="py-2 text-right tabular-nums">{row.total}</td>
                    <td className="py-2 text-right tabular-nums">{row.done}</td>
                    <td className="py-2 text-right tabular-nums">{row.inProgress}</td>
                    <td className="py-2 text-right tabular-nums">{row.cancelled}</td>
                    <td className="py-2 text-right tabular-nums">{row.avgMinutes ?? "—"}</td>
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
