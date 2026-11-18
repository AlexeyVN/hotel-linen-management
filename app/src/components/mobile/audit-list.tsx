"use client";

import { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readCache, writeCache } from "@/lib/offline/cache";
import { trpc } from "@/lib/trpc-client";

interface RoomOption {
  id: string;
  number: string;
  roomTypeName: string;
}

interface SessionRow {
  id: string;
  roomNumber: string;
  status: string;
  startedAt: string | Date;
  appliedAt: string | Date | null;
}

const ROOMS_KEY = "cache.rooms.v1";
const SESSIONS_KEY = "cache.audit.list.v1";

export function MobileAuditList({ initialRoomId = "" }: { initialRoomId?: string }) {
  const t = useTranslations("mobile");
  const locale = useLocale();
  const router = useRouter();
  const utils = trpc.useUtils();
  const roomsQuery = trpc.rooms.list.useQuery();
  const sessionsQuery = trpc.audit.list.useQuery({ limit: 20 });
  const start = trpc.audit.start.useMutation();

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roomsQuery.data) {
      setRooms(roomsQuery.data);
      writeCache(ROOMS_KEY, roomsQuery.data);
    } else if (roomsQuery.isError) {
      setRooms(readCache<RoomOption[]>(ROOMS_KEY) ?? []);
    }
  }, [roomsQuery.data, roomsQuery.isError]);

  useEffect(() => {
    if (sessionsQuery.data) {
      setSessions(sessionsQuery.data);
      writeCache(SESSIONS_KEY, sessionsQuery.data);
    } else if (sessionsQuery.isError) {
      setSessions(readCache<SessionRow[]>(SESSIONS_KEY) ?? []);
    }
  }, [sessionsQuery.data, sessionsQuery.isError]);

  async function handleStart() {
    setError(null);
    if (!roomId) {
      setError(t("errors.selectRoom"));
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(t("auditList.offlineStart"));
      return;
    }
    try {
      const result = await start.mutateAsync({ roomId });
      await utils.audit.list.invalidate();
      router.push(`/m/audit/${result.sessionId}`);
    } catch (mutationError) {
      setError(
        mutationError instanceof TRPCClientError
          ? mutationError.message
          : t("auditList.startError"),
      );
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{t("auditList.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auditList.roomsCount", { count: rooms.length })}
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border bg-card p-4">
        <label className="block text-sm">
          <span className="mb-2 block text-muted-foreground">{t("labels.room")}</span>
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className="h-12 w-full rounded-md border bg-background px-3 text-base"
          >
            <option value="">{t("labels.choose")}</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number} · {room.roomTypeName}
              </option>
            ))}
          </select>
        </label>
        <Button className="mt-3 h-12 w-full text-base" onClick={handleStart} disabled={start.isPending}>
          {start.isPending ? t("auditList.starting") : t("auditList.startButton")}
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("auditList.sessions")}</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("auditList.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/m/audit/${session.id}`}
                  className="flex items-center justify-between rounded-xl border bg-card p-4 active:bg-muted"
                >
                  <span>
                    <span className="block text-base font-semibold">
                      {t("labels.roomNumber", { number: session.roomNumber })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session.status === "APPLIED" ? t("auditList.applied") : t("auditList.draft")}{" "}
                      ·{" "}
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(session.startedAt))}
                    </span>
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
