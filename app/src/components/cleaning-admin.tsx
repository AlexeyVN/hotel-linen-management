"use client";

import { TRPCClientError } from "@trpc/client";
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
        <h1 className="text-2xl font-semibold">Уборка</h1>
        <p className="text-sm text-muted-foreground">
          Задачи на уборку, статусы номеров и отчёт по горничным. Чек-листы — вне
          объёма этого этапа.
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
          <CardTitle>Новая задача</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Номер</span>
              <select
                value={form.roomId}
                onChange={(event) => setForm({ ...form, roomId: event.target.value })}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">— выберите —</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.number} · {room.roomTypeName} ({ROOM_STATUS_LABELS[room.cleaningStatus]})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Тип</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as typeof form.type })
                }
                className="h-10 rounded-md border bg-background px-3"
              >
                {Object.entries(CLEANING_TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Приоритет</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value as typeof form.priority })
                }
                className="h-10 rounded-md border bg-background px-3"
              >
                {Object.entries(PRIORITY_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Исполнитель</span>
              <select
                value={form.assigneeId}
                onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">— не назначен —</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Чек-лист</span>
              <select
                value={form.checklistTemplateId}
                onChange={(event) =>
                  setForm({ ...form, checklistTemplateId: event.target.value })
                }
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">— без чек-листа —</option>
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
              <span className="mb-1 block text-muted-foreground">План, мин</span>
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
                  "Задача создана, номер помечен грязным",
                )
              }
            >
              Создать задачу
            </Button>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted-foreground">Комментарий</span>
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
          <CardTitle>Задачи ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Фильтр по статусу</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as typeof statusFilter)
              }
              className="h-10 rounded-md border bg-background px-3"
            >
              <option value="">Все</option>
              {Object.entries(TASK_STATUS_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Задач нет.</p>
          ) : (
            <DataTable minWidth="1000px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Номер</th>
                  <th className="py-2 font-medium">Тип</th>
                  <th className="py-2 font-medium">Приоритет</th>
                  <th className="py-2 font-medium">Статус</th>
                  <th className="py-2 font-medium">Исполнитель</th>
                  <th className="py-2 font-medium">Чек-лист</th>
                  <th className="py-2 font-medium">План</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{task.roomNumber}</td>
                    <td className="py-2">{CLEANING_TYPE_LABELS[task.type] ?? task.type}</td>
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
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </span>
                    </td>
                    <td className="py-2">{TASK_STATUS_LABELS[task.status] ?? task.status}</td>
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
                              "Исполнитель назначен",
                            )
                          }
                          className="h-9 rounded-md border bg-background px-2"
                        >
                          <option value="">— не назначен —</option>
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
                    <td className="py-2">{task.plannedMinutes ? `${task.plannedMinutes} мин` : "—"}</td>
                    <td className="py-2">
                      {task.checklist ? (
                        <span className="text-xs">
                          {task.checklist.name}
                          <span className="block text-muted-foreground">
                            отмечено: {task.checklist.answered}
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
                                  "Чек-лист прикреплён",
                                )
                              : undefined
                          }
                          className="h-9 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="">— прикрепить —</option>
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
                              "Задача отменена",
                            )
                          }
                        >
                          Отменить
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
          <CardTitle>Статусы номеров</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable minWidth="1000px">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Номер</th>
                <th className="py-2 font-medium">Этаж</th>
                <th className="py-2 font-medium">Тип</th>
                <th className="py-2 font-medium">Статус уборки</th>
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
                          `Номер ${room.number}: статус обновлён`,
                        )
                      }
                      className="h-9 rounded-md border bg-background px-2"
                    >
                      {Object.entries(ROOM_STATUS_LABELS).map(([code, label]) => (
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
            Отчёт за {range.from} — {range.to}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href={`/api/reports/export?report=tasks&from=${range.from}&to=${range.to}`}
            className="inline-flex h-10 items-center rounded-md border border-primary px-4 text-sm text-primary hover:bg-muted"
          >
            Скачать Excel
          </a>
          {report.length === 0 ? (
            <p className="text-sm text-muted-foreground">За период задач нет.</p>
          ) : (
            <DataTable minWidth="1000px">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Исполнитель</th>
                  <th className="py-2 text-right font-medium">Всего</th>
                  <th className="py-2 text-right font-medium">Выполнено</th>
                  <th className="py-2 text-right font-medium">В работе</th>
                  <th className="py-2 text-right font-medium">Отменено</th>
                  <th className="py-2 text-right font-medium">Среднее, мин</th>
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
