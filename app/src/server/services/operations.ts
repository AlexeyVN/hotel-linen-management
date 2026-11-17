import { Prisma } from "@prisma/client";
import { applyOperation, type OperationDraft, type StockLevels } from "@/lib/domain/stock";
import { resolveWriteOffReason } from "@/lib/domain/writeoff";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type OperationType = "RECEIVE" | "DISTRIBUTE" | "RETURN" | "WRITE_OFF" | "AUDIT";
export type StockLocation = "WAREHOUSE" | "ROOM";

export interface OperationLineInput {
  itemId: string;
  qty: number;
}

export interface AuditLineInput {
  itemId: string;
  expectedQty: number;
  factQty: number;
}

export interface CreateOperationInput {
  type: OperationType;
  userId: string;
  roomId?: string | null;
  items?: OperationLineInput[];
  auditItems?: AuditLineInput[];
  location?: StockLocation;
  reasonCode?: string | null;
  reasonText?: string | null;
  comment?: string | null;
  clientOpId?: string | null;
  /** Дата документа (ТЗ v2.6): приёмка — дата поступления. */
  documentDate?: Date;
}

export interface OperationResult {
  operationId: string;
  idempotent: boolean;
}

export interface OperationErrorItem {
  code: string;
  message: string;
  itemId?: string;
}

export class OperationValidationError extends Error {
  readonly errors: OperationErrorItem[];

  constructor(message: string, errors: OperationErrorItem[] = []) {
    super(message);
    this.name = "OperationValidationError";
    this.errors = errors;
  }
}

function uniqueItemIds(input: CreateOperationInput): string[] {
  const ids = new Set<string>();
  for (const line of input.items ?? []) ids.add(line.itemId);
  for (const line of input.auditItems ?? []) ids.add(line.itemId);
  return [...ids];
}

/**
 * Проводит операцию атомарно: проверка прав делает роутер, проверка количеств —
 * домен (applyOperation), запись остатков и журнала — одна транзакция.
 * Идемпотентность — по unique clientOpId (ТЗ §5.2.6).
 */
export async function createOperation(
  input: CreateOperationInput,
): Promise<OperationResult> {
  if (input.clientOpId) {
    const existing = await prisma.operation.findUnique({
      where: { clientOpId: input.clientOpId },
      select: { id: true },
    });
    if (existing) return { operationId: existing.id, idempotent: true };
  }

  let reason: string | null = null;
  if (input.type === "WRITE_OFF") {
    const reasons = await prisma.writeOffReason.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
    });
    const resolved = resolveWriteOffReason(
      { reasonCode: input.reasonCode, reasonText: input.reasonText },
      reasons,
    );
    if (!resolved.ok) throw new OperationValidationError(resolved.error);
    reason = resolved.reason;
  }

  const itemIds = uniqueItemIds(input);
  if (itemIds.length === 0) {
    throw new OperationValidationError("Операция без позиций");
  }

  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true, isActive: true },
  });
  if (items.length !== itemIds.length) {
    throw new OperationValidationError("Позиция не найдена");
  }
  const inactive = items.filter((item) => !item.isActive);
  if (inactive.length > 0) {
    throw new OperationValidationError(
      `Позиция деактивирована: ${inactive.map((item) => item.name).join(", ")}`,
    );
  }

  let room: { id: string; number: string } | null = null;
  if (input.roomId) {
    const found = await prisma.room.findUnique({
      where: { id: input.roomId },
      select: { id: true, number: true, isActive: true },
    });
    if (!found || !found.isActive) {
      throw new OperationValidationError("Номер не найден или деактивирован");
    }
    room = { id: found.id, number: found.number };
  }

  const needsRoom = input.type === "DISTRIBUTE" || input.type === "RETURN" || input.type === "AUDIT";
  if (needsRoom && !room) throw new OperationValidationError("Выберите номер");
  if (input.type === "WRITE_OFF" && input.location === "ROOM" && !room) {
    throw new OperationValidationError("Для списания из номера выберите номер");
  }
  if (input.type === "RECEIVE" && room) {
    throw new OperationValidationError("Приёмка не привязана к номеру");
  }

  const operationItemData =
    input.type === "AUDIT"
      ? (input.auditItems ?? []).map((line) => ({
          itemId: line.itemId,
          qty: line.factQty,
          expectedQty: line.expectedQty,
          factQty: line.factQty,
          delta: line.factQty - line.expectedQty,
        }))
      : (input.items ?? []).map((line) => ({ itemId: line.itemId, qty: line.qty }));

  try {
    const documentDate = input.documentDate ?? new Date();
    return await prisma.$transaction(async (tx) => {
      const warehouseRows = await tx.warehouseInventory.findMany({
        where: { itemId: { in: itemIds } },
      });
      const roomRows = room
        ? await tx.roomInventory.findMany({
            where: { roomId: room.id, itemId: { in: itemIds } },
          })
        : [];

      const levels: StockLevels = {
        warehouse: Object.fromEntries(warehouseRows.map((row) => [row.itemId, row.qty])),
        room: Object.fromEntries(roomRows.map((row) => [row.itemId, row.qty])),
      };

      const draft: OperationDraft =
        input.type === "AUDIT"
          ? { type: "AUDIT", auditItems: input.auditItems }
          : {
              type: input.type,
              items: input.items,
              location:
                input.type === "WRITE_OFF" ? (input.location ?? "WAREHOUSE") : undefined,
            };

      const result = applyOperation(draft, levels, { hasRoom: Boolean(room) });
      if (!result.ok) {
        throw new OperationValidationError(
          result.errors[0]?.message ?? "Операция отклонена",
          result.errors,
        );
      }

      const operation = await tx.operation.create({
        data: {
          type: input.type,
          userId: input.userId,
          roomId: room?.id ?? null,
          reason,
          comment: input.comment ?? null,
          clientOpId: input.clientOpId ?? null,
          documentDate,
          items: { create: operationItemData },
        },
        select: { id: true },
      });

      const warehouseTouched = new Set(
        result.changes.filter((c) => c.location === "WAREHOUSE").map((c) => c.itemId),
      );
      for (const itemId of warehouseTouched) {
        const qty = result.levels.warehouse[itemId] ?? 0;
        const previous = warehouseRows.find((row) => row.itemId === itemId);
        const receiptAt =
          input.type === "RECEIVE"
            ? previous?.lastReceiptAt && previous.lastReceiptAt > documentDate
              ? previous.lastReceiptAt
              : documentDate
            : undefined;
        await tx.warehouseInventory.upsert({
          where: { itemId },
          update: {
            qty,
            version: { increment: 1 },
            ...(receiptAt ? { lastReceiptAt: receiptAt } : {}),
          },
          create: {
            itemId,
            qty,
            ...(receiptAt ? { lastReceiptAt: receiptAt } : {}),
          },
        });
      }

      if (room) {
        const roomTouched = new Set(
          result.changes.filter((c) => c.location === "ROOM").map((c) => c.itemId),
        );
        for (const itemId of roomTouched) {
          const qty = result.levels.room[itemId] ?? 0;
          await tx.roomInventory.upsert({
            where: { roomId_itemId: { roomId: room.id, itemId } },
            update: { qty, version: { increment: 1 } },
            create: { roomId: room.id, itemId, qty },
          });
        }
      }

      // Очередь экспорта в 1С: операция уже зафиксирована локально (ТЗ §8.3).
      await tx.outboxEntry.create({ data: { operationId: operation.id } });

      logger.info(
        {
          operationId: operation.id,
          type: input.type,
          room: room?.number,
          lines: operationItemData.length,
          reason,
          documentDate: documentDate.toISOString(),
        },
        "операция проведена",
      );

      return { operationId: operation.id, idempotent: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.operation.findUnique({
        where: { clientOpId: input.clientOpId ?? "" },
        select: { id: true },
      });
      if (existing) return { operationId: existing.id, idempotent: true };
    }
    throw error;
  }
}
