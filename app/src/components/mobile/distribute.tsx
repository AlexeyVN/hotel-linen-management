"use client";

import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMutation } from "@/lib/offline/db";
import { readCache, writeCache } from "@/lib/offline/cache";
import { trpc } from "@/lib/trpc-client";

interface RoomOption {
  id: string;
  number: string;
  roomTypeName: string;
}

interface ItemOption {
  id: string;
  name: string;
  unit: string;
  warehouseQty: number;
}

const ROOMS_KEY = "cache.rooms.v1";
const ITEMS_KEY = "cache.distributable.items.v1";

export function MobileDistribute({
  initialRoomId = "",
  initialItemId = "",
}: {
  initialRoomId?: string;
  initialItemId?: string;
}) {
  const t = useTranslations("mobile");
  const utils = trpc.useUtils();
  const roomsQuery = trpc.rooms.list.useQuery();
  const itemsQuery = trpc.operations.distributableItems.useQuery();
  const distribute = trpc.operations.distribute.useMutation();

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [itemId, setItemId] = useState(initialItemId);
  const [qty, setQty] = useState("1");
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (roomsQuery.data) {
      setRooms(roomsQuery.data);
      writeCache(ROOMS_KEY, roomsQuery.data);
    } else if (roomsQuery.isError) {
      setRooms(readCache<RoomOption[]>(ROOMS_KEY) ?? []);
    }
  }, [roomsQuery.data, roomsQuery.isError]);

  useEffect(() => {
    if (itemsQuery.data) {
      setItems(itemsQuery.data);
      writeCache(ITEMS_KEY, itemsQuery.data);
    } else if (itemsQuery.isError) {
      setItems(readCache<ItemOption[]>(ITEMS_KEY) ?? []);
    }
  }, [itemsQuery.data, itemsQuery.isError]);

  const selectedItem = items.find((item) => item.id === itemId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const quantity = Number(qty);
    if (!roomId) {
      setError(t("errors.selectRoom"));
      return;
    }
    if (!itemId) {
      setError(t("errors.selectItem"));
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError(t("errors.quantity"));
      return;
    }

    const clientOpId = `m4-distribute-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!navigator.onLine) {
      await addMutation({
        kind: "DISTRIBUTE",
        label: t("queue.distributeLabel", {
          item: selectedItem?.name ?? t("distribute.itemFallback"),
          qty: quantity,
        }),
        payload: { roomId, items: [{ itemId, qty: quantity }] },
        clientOpId,
      });
      setNotice(t("distribute.queuedNotice"));
      setQty("1");
      return;
    }

    setBusy(true);
    try {
      await distribute.mutateAsync({
        roomId,
        items: [{ itemId, qty: quantity }],
        clientOpId,
      });
      setNotice(t("distribute.success"));
      setQty("1");
      await utils.operations.distributableItems.invalidate();
      await utils.items.list.invalidate();
    } catch (mutationError) {
      setError(
        mutationError instanceof TRPCClientError
          ? mutationError.message
          : t("distribute.error"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">{t("distribute.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {online ? t("distribute.subtitle") : t("distribute.offlineHint")}
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

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

      <label className="block text-sm">
        <span className="mb-2 block text-muted-foreground">{t("labels.item")}</span>
        <select
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          className="h-12 w-full rounded-md border bg-background px-3 text-base"
        >
          <option value="">{t("labels.choose")}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit})
            </option>
          ))}
        </select>
        {selectedItem ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {t("distribute.inStock", {
              qty: selectedItem.warehouseQty,
              unit: selectedItem.unit,
            })}
          </span>
        ) : null}
      </label>

      <label className="block text-sm">
        <span className="mb-2 block text-muted-foreground">{t("labels.quantity")}</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 text-lg"
            onClick={() => setQty(String(Math.max(1, Number(qty) - 1 || 1)))}
          >
            −
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            className="h-12 text-center text-base"
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 text-lg"
            onClick={() => setQty(String((Number(qty) || 0) + 1))}
          >
            +
          </Button>
        </div>
      </label>

      <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
        {busy
          ? t("distribute.submitting")
          : online
            ? t("distribute.submit")
            : t("distribute.queueSubmit")}
      </Button>
    </form>
  );
}
