"use client";

import { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc-client";

export function AuditAdmin() {
  const t = useTranslations("audit");
  const locale = useLocale();
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
      setError(t("errorRoom"));
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
          : t("errorStart"),
      );
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

      <Card>
        <CardHeader>
          <CardTitle>{t("newAudit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("room")}</span>
              <select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="">{t("choose")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.number} · {room.roomTypeName}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={handleStart} disabled={start.isPending}>
              {start.isPending ? t("creating") : t("start")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("draftHint")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessions")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">{t("room")}</th>
                  <th className="py-2 font-medium">{t("status")}</th>
                  <th className="py-2 font-medium">{t("started")}</th>
                  <th className="py-2 font-medium">{t("applied")}</th>
                  <th className="py-2 font-medium">{t("author")}</th>
                  <th className="py-2 font-medium">{t("photos")}</th>
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
                        {session.status === "DRAFT" ? t("draft") : t("appliedStatus")}
                      </span>
                    </td>
                    <td className="py-2">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(session.startedAt))}
                    </td>
                    <td className="py-2">
                      {session.appliedAt
                        ? new Intl.DateTimeFormat(locale, {
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
                        {session.status === "DRAFT" ? t("continue") : t("open")}
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
