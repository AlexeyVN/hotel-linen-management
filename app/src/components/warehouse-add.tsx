"use client";

import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMoney } from "@/components/currency-provider";
import { trpc } from "@/lib/trpc-client";

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

export function WarehouseAddForm({ initialItemId }: { initialItemId?: string }) {
  const money = useMoney();
  const router = useRouter();
  const utils = trpc.useUtils();
  const catalogQuery = trpc.catalog.list.useQuery();
  const receive = trpc.operations.receive.useMutation();

  const items = (catalogQuery.data ?? []).filter((item) => item.isActive);
  const [itemId, setItemId] = useState(initialItemId ?? "");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(today());
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = items.find((item) => item.id === itemId);
  const parsedQty = Number(qty);
  const total =
    selected && Number.isInteger(parsedQty) && parsedQty > 0
      ? selected.priceKopecks * parsedQty
      : 0;

  async function submit() {
    setError(null);
    setNotice(null);
    if (!itemId) {
      setError("Выберите позицию из справочника");
      return;
    }
    if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
      setError("Количество должно быть целым и больше нуля");
      return;
    }
    setPending(true);
    try {
      await receive.mutateAsync({
        items: [{ itemId, qty: parsedQty }],
        documentDate: date || undefined,
        comment: comment || undefined,
        clientOpId: newOpId(),
      });
      setNotice("Позиция добавлена на склад");
      setQty("");
      setComment("");
      await Promise.all([
        utils.catalog.list.invalidate(),
        utils.items.list.invalidate(),
        utils.operations.distributableItems.invalidate(),
      ]);
      router.refresh();
    } catch (mutationError) {
      setError(errorText(mutationError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">Добавить на склад из справочника</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm">
          <span className="mb-1 block text-muted-foreground">Позиция</span>
          <select
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3"
          >
            <option value="">— выберите —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit}) · {money(item.priceKopecks)}
              </option>
            ))}
          </select>
        </label>
        <label className="w-28 text-sm">
          <span className="mb-1 block text-muted-foreground">Количество</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Дата поступления</span>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="min-w-48 flex-1 text-sm">
          <span className="mb-1 block text-muted-foreground">Примечание</span>
          <Input
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Добавляем…" : "Добавить"}
        </Button>
      </div>
      {selected ? (
        <p className="text-xs text-muted-foreground">
          Цена из справочника: {money(selected.priceKopecks)} · сумма:{" "}
          {money(total)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
    </div>
  );
}
