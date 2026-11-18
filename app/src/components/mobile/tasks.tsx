"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";

type View = "ACTIVE" | "DONE" | "ALL";

const VIEWS: View[] = ["ACTIVE", "DONE", "ALL"];

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
  const t = useTranslations("mobile");
  const tc = useTranslations("cleaning");
  const utils = trpc.useUtils();
  const [view, setView] = useState<View>("ACTIVE");
  const tasksQuery = trpc.cleaning.listMine.useQuery({ view });
  const setStatus = trpc.cleaning.setStatus.useMutation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const viewLabels: Record<View, string> = {
    ACTIVE: t("tasks.filterActive"),
    DONE: t("tasks.filterDone"),
    ALL: t("tasks.filterAll"),
  };
  const typeLabels: Record<string, string> = {
    DAILY: tc("daily"),
    ON_DEMAND: tc("onDemand"),
    GENERAL: tc("general"),
  };
  const priorityLabels: Record<string, string> = {
    URGENT: tc("urgent"),
    MEDIUM: tc("medium"),
    LOW: tc("low"),
  };
  const statusLabels: Record<string, string> = {
    NEW: tc("taskNew"),
    IN_PROGRESS: tc("taskInProgress"),
    DONE: tc("taskDone"),
    CANCELLED: tc("taskCancelled"),
  };
  const roomStatusLabels: Record<string, string> = {
    CLEAN: tc("clean"),
    DIRTY: tc("dirty"),
    INSPECTED: tc("inspected"),
    OUT_OF_ORDER: tc("outOfOrder"),
  };

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
      setError(mutationError instanceof Error ? mutationError.message : t("tasks.errorTake"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{t("tasks.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tasks.subtitle")}</p>
      </header>

      <div className="flex gap-2">
        {VIEWS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={
              view === key
                ? "flex-1 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                : "flex-1 rounded-full border bg-card px-3 py-2 text-sm"
            }
          >
            {viewLabels[key]}
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
          {view === "DONE" ? t("tasks.emptyDone") : t("tasks.emptyActive")}
        </p>
      ) : (
        tasks.map((task) => (
          <article key={task.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/m/tasks/${task.id}`} className="text-lg font-semibold underline-offset-2 hover:underline">
                  {t("labels.roomNumber", { number: task.roomNumber })}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {t("labels.floor", { floor: task.floorLabel })} ·{" "}
                  {roomStatusLabels[task.roomStatus] ?? task.roomStatus}
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
                {priorityLabels[task.priority] ?? task.priority}
              </span>
            </div>

            <p className="mt-2 text-sm">
              {typeLabels[task.type] ?? task.type}
              {task.plannedMinutes
                ? ` · ${t("labels.planMinutes", { minutes: task.plannedMinutes })}`
                : ""}
              {" · "}
              <span className={task.status === "DONE" ? "text-green-700" : "text-amber-700"}>
                {statusLabels[task.status] ?? task.status}
              </span>
            </p>

            {task.checklist ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("tasks.checklistProgress", {
                  name: task.checklist.name,
                  answered: task.checklist.answered,
                  total: task.checklist.total,
                })}
                {task.checklist.complete ? ` · ${t("tasks.checklistReady")}` : ""}
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
                  {busyId === task.id ? t("tasks.taking") : t("tasks.take")}
                </Button>
              ) : null}
              <Link
                href={`/m/tasks/${task.id}`}
                className="flex h-11 flex-1 items-center justify-center rounded-md border text-sm font-medium"
              >
                {t("tasks.open")}
              </Link>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
