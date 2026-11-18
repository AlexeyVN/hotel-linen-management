"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";

type Filter = "ALL" | "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_ORDER";

const FILTERS: Filter[] = ["ALL", "DIRTY", "CLEAN", "INSPECTED", "OUT_OF_ORDER"];

interface RoomRow {
  id: string;
  number: string;
  floorLabel: string;
  roomTypeName: string;
  cleaningStatus: string;
  activeTask: {
    id: string;
    status: string;
    type: string;
    priority: string;
    mine: boolean;
  } | null;
}

export function MobileRooms() {
  const t = useTranslations("mobile");
  const tc = useTranslations("cleaning");
  const [filter, setFilter] = useState<Filter>("ALL");
  const roomsQuery = trpc.cleaning.myRooms.useQuery();
  const rooms = ((roomsQuery.data ?? []) as RoomRow[]).filter((room) =>
    filter === "ALL" ? true : room.cleaningStatus === filter,
  );

  const filterLabels: Record<Filter, string> = {
    ALL: t("rooms.filterAll"),
    DIRTY: t("rooms.filterDirty"),
    CLEAN: t("rooms.filterClean"),
    INSPECTED: t("rooms.filterInspected"),
    OUT_OF_ORDER: t("rooms.filterRepair"),
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

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{t("rooms.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("rooms.count", { shown: rooms.length, total: (roomsQuery.data ?? []).length })}
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "whitespace-nowrap rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                : "whitespace-nowrap rounded-full border bg-card px-3 py-2 text-sm"
            }
          >
            {filterLabels[key]}
          </button>
        ))}
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {t("rooms.empty")}
        </p>
      ) : (
        rooms.map((room) => (
          <article key={room.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">
                  {t("labels.roomNumber", { number: room.number })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("labels.floor", { floor: room.floorLabel })} · {room.roomTypeName}
                </p>
              </div>
              <span
                className={
                  room.cleaningStatus === "CLEAN"
                    ? "rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
                    : room.cleaningStatus === "DIRTY"
                      ? "rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                      : room.cleaningStatus === "INSPECTED"
                        ? "rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                        : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                }
              >
                {roomStatusLabels[room.cleaningStatus] ?? room.cleaningStatus}
              </span>
            </div>

            {room.activeTask ? (
              <div className="mt-3 rounded-lg border p-2 text-xs">
                <p className="font-medium">
                  {typeLabels[room.activeTask.type] ?? room.activeTask.type} ·{" "}
                  {statusLabels[room.activeTask.status] ?? room.activeTask.status}
                  {room.activeTask.priority === "URGENT" ? ` · ${t("rooms.urgent")}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {priorityLabels[room.activeTask.priority] ?? room.activeTask.priority}
                  {room.activeTask.mine ? "" : ` · ${t("rooms.assignedToOther")}`}
                </p>
                {room.activeTask.mine ? (
                  <Link
                    href={`/m/tasks/${room.activeTask.id}`}
                    className="mt-2 flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
                  >
                    {t("rooms.openTask")}
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{t("rooms.noActiveTask")}</p>
            )}
          </article>
        ))
      )}
    </div>
  );
}
