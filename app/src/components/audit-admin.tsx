"use client";

import { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc-client";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  APPLIED: "Проведена",
};

export function AuditAdmin() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const roomsQuery = trpc.rooms.list.useQuery();
  const sessionsQuery = trpc.audit.list.useQuery({ limit: 25 });
  const start = trpc.audit.start.useMutation();

  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rooms = roomsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  async function handleStart() {
    setError(null);
    if (!roomId) {
      setError("Выберите номер");
      return;
    }
    try {
      const result = await start.mutateAsync({ roomId });
      await utils.audit.list.invalidate();
      router.push(`/admin/audit/${result.sessionId}`);
    } catch (mutationError) {
      setError(
        mutationError instanceof TRPCClientError
          ? mutationError.message
          : "Не удалось начать инвентаризацию",
      );
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Инвентаризация номеров</h1>
        <p className="text-sm text-muted-foreground">
          Сверка факта с учётом. Расхождение формирует корректировку остатка номера.
          Фото — по желанию.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Новая инвентаризация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Номер</span>
              <select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">— выберите —</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.number} · {room.roomTypeName}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={handleStart} disabled={start.isPending}>
              {start.isPending ? "Создаём…" : "Начать"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Если по номеру уже есть черновик — откроется он.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Сессии инвентаризации</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет ни одной инвентаризации.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Номер</th>
                  <th className="py-2 font-medium">Статус</th>
                  <th className="py-2 font-medium">Начата</th>
                  <th className="py-2 font-medium">Проведена</th>
                  <th className="py-2 font-medium">Автор</th>
                  <th className="py-2 font-medium">Фото</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{session.roomNumber}</td>
                    <td className="py-2">
                      <span
                        className={
                          session.status === "APPLIED" ? "text-green-700" : "text-amber-700"
                        }
                      >
                        {STATUS_LABELS[session.status] ?? session.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {new Intl.DateTimeFormat("ru-RU", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(session.startedAt))}
                    </td>
                    <td className="py-2">
                      {session.appliedAt
                        ? new Intl.DateTimeFormat("ru-RU", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(session.appliedAt))
                        : "—"}
                    </td>
                    <td className="py-2">{session.userFullName}</td>
                    <td className="py-2">{session.photos}</td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/admin/audit/${session.id}`}
                        className="text-primary underline"
                      >
                        {session.status === "DRAFT" ? "Продолжить" : "Открыть"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
