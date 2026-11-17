import { randomUUID } from "node:crypto";
import { z } from "zod";
import { backoffMs } from "@/lib/offline/backoff";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { buildAdapter, MAX_OUTBOX_ATTEMPTS } from "./sync";
import { getIntegrationConfig, getRoomStatusConfig, recordSyncError } from "./config";
import type { ErpRoomStatusDto } from "./contract";

export const ROOM_STATUS_VALUES = ["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"] as const;
export type RoomStatusValue = (typeof ROOM_STATUS_VALUES)[number];

const STATUS_ALIASES: Record<string, RoomStatusValue> = {
  CLEAN: "CLEAN",
  "ЧИСТЫЙ": "CLEAN",
  "ЧИСТО": "CLEAN",
  "УБРАН": "CLEAN",
  "УБРАНО": "CLEAN",
  CLEANED: "CLEAN",
  DIRTY: "DIRTY",
  "ГРЯЗНЫЙ": "DIRTY",
  "ГРЯЗНО": "DIRTY",
  "ТРЕБУЕТ УБОРКИ": "DIRTY",
  INSPECTED: "INSPECTED",
  "ПРОВЕРЕН": "INSPECTED",
  "ПРОВЕРЕННЫЙ": "INSPECTED",
  "ИНСПЕКТИРОВАН": "INSPECTED",
  OUT_OF_ORDER: "OUT_OF_ORDER",
  REPAIR: "OUT_OF_ORDER",
  "РЕМОНТ": "OUT_OF_ORDER",
  "В РЕМОНТЕ": "OUT_OF_ORDER",
};

export function normalizeRoomStatus(value: string): RoomStatusValue | null {
  const key = value.trim().toUpperCase().replace(/\s+/g, " ");
  return STATUS_ALIASES[key] ?? null;
}

export function localRoomStatusData(status: RoomStatusValue) {
  return {
    cleaningStatus: status,
    cleaningStatusUpdatedAt: new Date(),
    cleaningStatusSource: "LOCAL",
  };
}

const inboundSchema = z
  .object({
    eventId: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional(),
    externalId: z.union([z.string(), z.number()]).optional(),
    roomNumber: z.union([z.string(), z.number()]).optional(),
    number: z.union([z.string(), z.number()]).optional(),
    room: z.union([z.string(), z.number()]).optional(),
    status: z.string().optional(),
    cleaningStatus: z.string().optional(),
    occurredAt: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .passthrough();

export class RoomStatusInputError extends Error {}

export interface InboundRoomStatus {
  eventId: string;
  roomNumber: string;
  status: RoomStatusValue;
  occurredAt: Date;
}

export function parseInboundRoomStatus(json: unknown): InboundRoomStatus {
  const parsed = inboundSchema.safeParse(json);
  if (!parsed.success) throw new RoomStatusInputError("Ожидался JSON-объект события");
  const data = parsed.data;
  const roomNumberRaw = data.roomNumber ?? data.number ?? data.room;
  const statusRaw = data.status ?? data.cleaningStatus;
  if (roomNumberRaw === undefined || String(roomNumberRaw).trim() === "") {
    throw new RoomStatusInputError("Не указан номер комнаты");
  }
  if (!statusRaw) throw new RoomStatusInputError("Не указан статус номера");
  const status = normalizeRoomStatus(statusRaw);
  if (!status) {
    throw new RoomStatusInputError(
      `Неизвестный статус «${statusRaw}»; ожидается CLEAN/DIRTY/INSPECTED/OUT_OF_ORDER`,
    );
  }
  const atRaw = data.occurredAt ?? data.timestamp;
  const occurredAt = atRaw ? new Date(atRaw) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new RoomStatusInputError("Некорректная дата occurredAt");
  }
  const rawEventId = data.eventId ?? data.id ?? data.externalId;
  const eventId =
    rawEventId !== undefined && String(rawEventId).trim() !== ""
      ? String(rawEventId).trim()
      : `room:${String(roomNumberRaw).trim()}:${status}:${occurredAt.toISOString()}`;
  if (eventId.length > 200) throw new RoomStatusInputError("eventId слишком длинный");
  return {
    eventId,
    roomNumber: String(roomNumberRaw).trim(),
    status,
    occurredAt,
  };
}

export async function applyInboundRoomStatus(input: InboundRoomStatus) {
  const duplicate = await prisma.roomStatusEvent.findUnique({ where: { eventId: input.eventId } });
  if (duplicate) {
    return { applied: false, duplicate: true, roomNumber: input.roomNumber, status: duplicate.status };
  }

  const room = await prisma.room.findUnique({ where: { number: input.roomNumber } });
  if (!room) throw new RoomStatusInputError(`Номер «${input.roomNumber}» не найден`);
  if (!room.isActive) throw new RoomStatusInputError(`Номер «${input.roomNumber}» деактивирован`);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.room.findUniqueOrThrow({ where: { id: room.id } });
      if (input.occurredAt.getTime() <= current.cleaningStatusUpdatedAt.getTime()) {
        await tx.roomStatusEvent.create({
          data: {
            roomId: room.id,
            direction: "INBOUND",
            eventId: input.eventId,
            status: input.status,
            source: "ONEC",
            state: "IGNORED",
            occurredAt: input.occurredAt,
            lastError: "Событие старше локального статуса",
          },
        });
        return { applied: false, stale: true, status: current.cleaningStatus };
      }
      await tx.room.update({
        where: { id: room.id },
        data: {
          cleaningStatus: input.status,
          cleaningStatusUpdatedAt: input.occurredAt,
          cleaningStatusSource: "ONEC",
        },
      });
      await tx.roomStatusEvent.create({
        data: {
          roomId: room.id,
          direction: "INBOUND",
          eventId: input.eventId,
          status: input.status,
          source: "ONEC",
          state: "APPLIED",
          occurredAt: input.occurredAt,
        },
      });
      return { applied: true, stale: false, status: input.status };
    });
    logger.info(
      { roomNumber: input.roomNumber, status: input.status, applied: result.applied },
      "статус номера из 1С",
    );
    return { ...result, duplicate: false, roomNumber: input.roomNumber };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { applied: false, duplicate: true, roomNumber: input.roomNumber, status: input.status };
    }
    throw error;
  }
}

/** Ставит локальное изменение в очередь; ничего не делает при выключенном обмене. */
export async function enqueueRoomStatus(
  roomId: string,
  status: RoomStatusValue,
): Promise<{ id: string } | null> {
  const [integration, roomStatus] = await Promise.all([
    getIntegrationConfig(),
    getRoomStatusConfig(),
  ]);
  if (!integration.enabled || !roomStatus.enabled) return null;

  return prisma.$transaction(async (tx) => {
    await tx.roomStatusEvent.updateMany({
      where: { roomId, direction: "OUTBOUND", state: "PENDING" },
      data: { state: "SUPERSEDED", lastError: "Заменено более новым статусом" },
    });
    const event = await tx.roomStatusEvent.create({
      data: {
        roomId,
        direction: "OUTBOUND",
        eventId: `local:${randomUUID()}`,
        status,
        source: "LOCAL",
        state: "PENDING",
        occurredAt: new Date(),
      },
      select: { id: true },
    });
    return event;
  });
}

export interface RoomStatusPushResult {
  sent: number;
  failed: number;
  pending: number;
  errors: string[];
}

export async function pushRoomStatuses(limit = 20): Promise<RoomStatusPushResult> {
  const integration = await getIntegrationConfig();
  const roomStatus = await getRoomStatusConfig();
  if (!integration.enabled || !roomStatus.enabled) {
    throw new Error("Обмен статусами номеров выключен");
  }
  const adapter = await buildAdapter();
  if (!adapter) throw new Error("Интеграция выключена");

  const now = new Date();
  const events = await prisma.roomStatusEvent.findMany({
    where: {
      direction: "OUTBOUND",
      state: "PENDING",
      attempts: { lt: MAX_OUTBOX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    include: { room: { select: { number: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const result: RoomStatusPushResult = { sent: 0, failed: 0, pending: 0, errors: [] };
  for (const event of events) {
    const dto: ErpRoomStatusDto = {
      eventId: event.eventId,
      roomNumber: event.room.number,
      status: event.status,
      occurredAt: event.occurredAt.toISOString(),
    };
    try {
      const outcome = await adapter.pushRoomStatus(dto);
      if (!outcome.ok) throw new Error(outcome.error ?? "1С отклонила статус");
      await prisma.roomStatusEvent.update({
        where: { id: event.id },
        data: {
          state: "SENT",
          attempts: event.attempts + 1,
          lastError: null,
          externalRef: outcome.externalRef ?? null,
          nextAttemptAt: null,
        },
      });
      result.sent += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const status = (error as { status?: number }).status;
      const permanent = (status !== undefined && status >= 400 && status < 500) || attempts >= MAX_OUTBOX_ATTEMPTS;
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      await prisma.roomStatusEvent.update({
        where: { id: event.id },
        data: {
          state: permanent ? "FAILED" : "PENDING",
          attempts,
          lastError: message.slice(0, 500),
          nextAttemptAt: permanent ? null : new Date(Date.now() + backoffMs(attempts)),
        },
      });
      if (permanent) result.failed += 1;
      else result.pending += 1;
      result.errors.push(`${event.id}: ${message}`);
    }
  }
  if (result.errors.length > 0) await recordSyncError(result.errors[0]);
  if (result.sent > 0) {
    logger.info({ sent: result.sent, pending: result.pending, failed: result.failed }, "статусы номеров отправлены в 1С");
  }
  return result;
}

export async function roomStatusStats() {
  const [pending, sent, failed, applied, ignored] = await Promise.all([
    prisma.roomStatusEvent.count({ where: { direction: "OUTBOUND", state: "PENDING" } }),
    prisma.roomStatusEvent.count({ where: { direction: "OUTBOUND", state: "SENT" } }),
    prisma.roomStatusEvent.count({ where: { direction: "OUTBOUND", state: "FAILED" } }),
    prisma.roomStatusEvent.count({ where: { direction: "INBOUND", state: "APPLIED" } }),
    prisma.roomStatusEvent.count({ where: { direction: "INBOUND", state: "IGNORED" } }),
  ]);
  return { pending, sent, failed, applied, ignored };
}
