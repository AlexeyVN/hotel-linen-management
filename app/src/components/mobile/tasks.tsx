"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CLEANING_TYPE_LABELS,
  PRIORITY_LABELS,
  ROOM_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain/cleaning";
import { trpc } from "@/lib/trpc-client";

type View = "ACTIVE" | "DONE" | "ALL";

const VIEWS: Array<{ key: View; label: string }> = [
  { key: "ACTIVE", label: "Активные" },
  { key: "DONE", label: "Выполненные" },
  { key: "ALL", label: "Все" },
];

interface TaskRow {
  id: string;
  roomNumber: string;
  floorLabel: string;
  roomStatus: string;
  type: string;
  priority: string;
  status: string;
  plannedMinutes: number | null;
  comment: string | null;
  checklist: { name: string; total: number; answered: number; complete: boolean } | null;
}

export function MobileTasks() {
  const utils = trpc.useUtils();
  const [view, setView] = useState<View>("ACTIVE");
  const tasksQuery = trpc.cleaning.listMine.useQuery({ view });
  const setStatus = trpc.cleaning.setStatus.useMutation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tasks = (tasksQuery.data ?? []) as TaskRow[];

  async function startTask(taskId: string) {
    setError(null);
    setBusyId(taskId);
    try {
      await setStatus.mutateAsync({ taskId, status: "IN_PROGRESS" });
      await Promise.all([
        utils.cleaning.listMine.invalidate(),
        utils.cleaning.dashboard.invalidate(),
        utils.cleaning.myRooms.invalidate(),
      ]);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Не удалось взять задачу");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Мои уборки</h1>
        <p className="text-sm text-muted-foreground">Задачи по приоритету и статусу</p>
      </header>

      <div className="flex gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={
              view === item.key
                ? "flex-1 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                : "flex-1 rounded-full border bg-card px-3 py-2 text-sm"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {tasks.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {view === "DONE" ? "Выполненных задач нет." : "Активных задач нет."}
        </p>
      ) : (
        tasks.map((task) => (
          <article key={task.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/m/tasks/${task.id}`} className="text-lg font-semibold underline-offset-2 hover:underline">
                  Номер {task.roomNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {task.floorLabel} этаж · {ROOM_STATUS_LABELS[task.roomStatus] ?? task.roomStatus}
                </p>
              </div>
              <span
                className={
                  task.priority === "URGENT"
                    ? "rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                    : task.priority === "MEDIUM"
                      ? "rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                      : "rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
                }
              >
                {PRIORITY_LABELS[task.priority] ?? task.priority}
              </span>
            </div>

            <p className="mt-2 text-sm">
              {CLEANING_TYPE_LABELS[task.type] ?? task.type}
              {task.plannedMinutes ? ` · план ${task.plannedMinutes} мин` : ""}
              {" · "}
              <span className={task.status === "DONE" ? "text-green-700" : "text-amber-700"}>
                {TASK_STATUS_LABELS[task.status] ?? task.status}
              </span>
            </p>

            {task.checklist ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Чек-лист «{task.checklist.name}»: {task.checklist.answered} из{" "}
                {task.checklist.total}
                {task.checklist.complete ? " · готов" : ""}
              </p>
            ) : null}
            {task.comment ? (
              <p className="mt-1 text-xs text-muted-foreground">{task.comment}</p>
            ) : null}

            <div className="mt-3 flex gap-2">
              {task.status === "NEW" ? (
                <Button
                  className="h-11 flex-1"
                  disabled={busyId === task.id}
                  onClick={() => startTask(task.id)}
                >
                  {busyId === task.id ? "Берём…" : "Взять в работу"}
                </Button>
              ) : null}
              <Link
                href={`/m/tasks/${task.id}`}
                className="flex h-11 flex-1 items-center justify-center rounded-md border text-sm font-medium"
              >
                Открыть задачу
              </Link>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
