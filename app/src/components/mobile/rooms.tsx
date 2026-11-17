"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CLEANING_TYPE_LABELS,
  PRIORITY_LABELS,
  ROOM_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/domain/cleaning";
import { trpc } from "@/lib/trpc-client";

type Filter = "ALL" | "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_ORDER";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "Все" },
  { key: "DIRTY", label: "Грязно" },
  { key: "CLEAN", label: "Убрано" },
  { key: "INSPECTED", label: "Проверено" },
  { key: "OUT_OF_ORDER", label: "Ремонт" },
];

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
  const [filter, setFilter] = useState<Filter>("ALL");
  const roomsQuery = trpc.cleaning.myRooms.useQuery();
  const rooms = ((roomsQuery.data ?? []) as RoomRow[]).filter((room) =>
    filter === "ALL" ? true : room.cleaningStatus === filter,
  );

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Мои номера</h1>
        <p className="text-sm text-muted-foreground">
          {rooms.length} из {(roomsQuery.data ?? []).length}
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={
              filter === item.key
                ? "whitespace-nowrap rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                : "whitespace-nowrap rounded-full border bg-card px-3 py-2 text-sm"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {rooms.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Номеров с таким статусом нет.
        </p>
      ) : (
        rooms.map((room) => (
          <article key={room.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">Номер {room.number}</p>
                <p className="text-xs text-muted-foreground">
                  {room.floorLabel} этаж · {room.roomTypeName}
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
                {ROOM_STATUS_LABELS[room.cleaningStatus] ?? room.cleaningStatus}
              </span>
            </div>

            {room.activeTask ? (
              <div className="mt-3 rounded-lg border p-2 text-xs">
                <p className="font-medium">
                  {CLEANING_TYPE_LABELS[room.activeTask.type] ?? room.activeTask.type} ·{" "}
                  {TASK_STATUS_LABELS[room.activeTask.status] ?? room.activeTask.status}
                  {room.activeTask.priority === "URGENT" ? " · срочно" : ""}
                </p>
                <p className="text-muted-foreground">
                  {PRIORITY_LABELS[room.activeTask.priority] ?? room.activeTask.priority}
                  {room.activeTask.mine ? "" : " · назначена другой горничной"}
                </p>
                {room.activeTask.mine ? (
                  <Link
                    href={`/m/tasks/${room.activeTask.id}`}
                    className="mt-2 flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
                  >
                    Открыть задачу
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Активной задачи нет.</p>
            )}
          </article>
        ))
      )}
    </div>
  );
}
