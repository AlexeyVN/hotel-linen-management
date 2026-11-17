"use client";

import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMoney } from "@/components/currency-provider";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc-client";

type Mode = "RECEIVE" | "DISTRIBUTE" | "RETURN" | "WRITE_OFF";

interface Row {
  itemId: string;
  qty: string;
}

function newOpId(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}


export function OperationForm({ mode }: { mode: Mode }) {
  const t = useTranslations("operations");
  const money = useMoney();
  const router = useRouter();
  const utils = trpc.useUtils();

  const itemsQuery = trpc.items.list.useQuery();
  const roomsQuery = trpc.rooms.list.useQuery(undefined, {
    enabled: mode !== "RECEIVE",
  });
  const reasonsQuery = trpc.items.writeOffReasons.useQuery(undefined, {
    enabled: mode === "WRITE_OFF",
  });

  const receive = trpc.operations.receive.useMutation();
  const distribute = trpc.operations.distribute.useMutation();
  const returnToWarehouse = trpc.operations.returnToWarehouse.useMutation();
  const writeOff = trpc.operations.writeOff.useMutation();

  const [rows, setRows] = useState<Row[]>([{ itemId: "", qty: "" }]);
  const [roomId, setRoomId] = useState("");
  const [location, setLocation] = useState<"WAREHOUSE" | "ROOM">("WAREHOUSE");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [comment, setComment] = useState("");
  const [documentDate, setDocumentDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const items = itemsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const reasons = reasonsQuery.data ?? [];
  const needsRoom = mode !== "RECEIVE";
  const needsRoomForWriteOff = mode === "WRITE_OFF" && location === "ROOM";

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const lines = rows
      .map((row) => ({ itemId: row.itemId, qty: Number(row.qty) }))
      .filter((row) => row.itemId && Number.isInteger(row.qty) && row.qty > 0);

    if (lines.length === 0) {
      setError(t("errorLines"));
      return;
    }
    if ((needsRoom || needsRoomForWriteOff) && !roomId) {
      setError(t("errorRoom"));
      return;
    }
    if (mode === "WRITE_OFF" && !reasonCode && reasonText.trim().length === 0) {
      setError(t("errorReason"));
      return;
    }

    setPending(true);
    try {
      const clientOpId = newOpId();
      if (mode === "RECEIVE") {
        await receive.mutateAsync({
          items: lines,
          comment: comment || undefined,
          documentDate: documentDate || undefined,
          clientOpId,
        });
      } else if (mode === "DISTRIBUTE") {
        await distribute.mutateAsync({
          roomId,
          items: lines,
          comment: comment || undefined,
          documentDate: documentDate || undefined,
          clientOpId,
        });
      } else if (mode === "RETURN") {
        await returnToWarehouse.mutateAsync({
          roomId,
          items: lines,
          comment: comment || undefined,
          documentDate: documentDate || undefined,
          clientOpId,
        });
      } else {
        await writeOff.mutateAsync({
          location,
          roomId: location === "ROOM" ? roomId : undefined,
          reasonCode: reasonCode || undefined,
          reasonText: reasonText.trim() || undefined,
          items: lines,
          comment: comment || undefined,
          documentDate: documentDate || undefined,
          clientOpId,
        });
      }

      setSuccess(t("success"));
      setRows([{ itemId: "", qty: "" }]);
      setComment("");
      setReasonText("");
      setDocumentDate(today());
      await utils.items.list.invalidate();
      await utils.rooms.list.invalidate();
      router.refresh();
    } catch (mutationError) {
      setError(errorText(mutationError));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            {mode === "RECEIVE" ? t("dateReceipt") : t("dateDocument")}
          </span>
          <Input
            type="date"
            value={documentDate}
            onChange={(event) => setDocumentDate(event.target.value)}
            className="w-44"
          />
        </label>
        {mode === "WRITE_OFF" ? (
          <div className="flex flex-wrap gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("from")}</span>
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value as "WAREHOUSE" | "ROOM")}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="WAREHOUSE">{t("warehouse")}</option>
                <option value="ROOM">{t("room")}</option>
              </select>
            </label>
            {location === "ROOM" ? (
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">{t("roomLabel")}</span>
                <select
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3"
                  required
                >
                  <option value="">{t("choose")}</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.number} · {room.roomTypeName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {mode === "DISTRIBUTE" || mode === "RETURN" ? (
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">{t("roomLabel")}</span>
            <select
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3"
              required
            >
              <option value="">{t("choose")}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} · {room.roomTypeName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="space-y-2">
          <span className="block text-sm font-medium">{t("positions")}</span>
          {rows.map((row, index) => {
            const selected = items.find((item) => item.id === row.itemId);
            return (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <label className="min-w-56 flex-1 text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("item")}</span>
                  <select
                    value={row.itemId}
                    onChange={(event) => updateRow(index, { itemId: event.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3"
                  >
                    <option value="">{t("choose")}</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="w-28 text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("qty")}</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={row.qty}
                    onChange={(event) => updateRow(index, { qty: event.target.value })}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  disabled={rows.length === 1}
                >
                  {t("remove")}
                </Button>
                {selected && mode !== "WRITE_OFF" ? (
                  <span className="pb-2 text-xs text-muted-foreground">
                    {t("inStock", { qty: selected.warehouseQty })}
                    {mode === "RECEIVE"
                      ? t("priceSuffix", { value: money(selected.priceKopecks) })
                      : ""}
                  </span>
                ) : null}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((current) => [...current, { itemId: "", qty: "" }])}
          >
            {t("addPosition")}
          </Button>
        </div>

        {mode === "WRITE_OFF" ? (
          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="reasonCode">{t("reason")}</Label>
            <select
              id="reasonCode"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t("customReason")}</option>
              {reasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.name}
                </option>
              ))}
            </select>
            <Input
              placeholder={t("reasonPlaceholder")}
              value={reasonText}
              maxLength={200}
              onChange={(event) => setReasonText(event.target.value)}
            />
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">{t("comment")}</span>
          <Input
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("submitting") : t("submit", { title: mode === "RECEIVE" ? t("receiveTitle") : mode === "DISTRIBUTE" ? t("distributeTitle") : mode === "RETURN" ? t("returnTitle") : t("writeoffTitle") })}
      </Button>
    </form>
  );
}
