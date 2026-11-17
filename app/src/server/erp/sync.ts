/**
 * Синхронизация с 1С: номенклатура внутрь, операции наружу через outbox.
 * Все обмены идут через ErpAdapter — один и тот же код работает
 * со заглушкой и с реальным HTTP-сервисом 1С (ТЗ §8).
 */
import { backoffMs } from "@/lib/offline/backoff";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { OneCAdapter } from "./adapters/onec";
import { stubAdapter } from "./adapters/stub";
import { getIntegrationConfig, getRoomStatusConfig, recordSyncError, setSetting } from "./config";
import { assertRubCurrency } from "./currency";
import type { ErpAdapter, ErpOperationDto } from "./contract";

export const MAX_OUTBOX_ATTEMPTS = 8;

export async function buildAdapter(): Promise<ErpAdapter | null> {
  const config = await getIntegrationConfig();
  if (!config.enabled) return null;
  await assertRubCurrency();
  if (config.mode === "stub") return stubAdapter;
  if (!config.baseUrl) throw new Error("Не задан URL HTTP-сервиса 1С");
  const roomStatusConfig = await getRoomStatusConfig();
  return new OneCAdapter({
    baseUrl: config.baseUrl,
    login: config.login,
    password: config.password,
    roomStatusPath: roomStatusConfig.path,
    roomStatusMethod: roomStatusConfig.method,
  });
}

async function ensureCategory(code: string | undefined): Promise<{ id: string }> {
  const normalized = (code ?? "ITEM").toUpperCase();
  const known = ["LINEN", "CHEMICAL", "ITEM"].includes(normalized) ? normalized : "ITEM";
  const found = await prisma.category.findUnique({ where: { code: known } });
  if (found) return found;
  return prisma.category.create({
    data: { code: known, name: known === "LINEN" ? "Бельё" : known === "CHEMICAL" ? "Химия" : "Инвентарь" },
    select: { id: true },
  });
}

export interface ItemSyncResult {
  created: number;
  updated: number;
  total: number;
}

export async function syncItems(adapter?: ErpAdapter): Promise<ItemSyncResult> {
  const active = adapter ?? (await buildAdapter());
  if (!active) throw new Error("Интеграция выключена");

  const since = (await getIntegrationConfig()).lastSyncAt ?? undefined;
  const items = await active.pullItems(since ?? undefined);

  let created = 0;
  let updated = 0;
  for (const dto of items) {
    const category = await ensureCategory(dto.categoryCode);
    const existing = await prisma.item.findUnique({ where: { externalId: dto.externalId } });
    if (existing) {
      await prisma.item.update({
        where: { id: existing.id },
        data: { name: dto.name, unit: dto.unit ?? existing.unit, categoryId: category.id },
      });
      updated += 1;
    } else {
      const item = await prisma.item.create({
        data: {
          name: dto.name,
          unit: dto.unit ?? "шт",
          categoryId: category.id,
          externalId: dto.externalId,
        },
        select: { id: true },
      });
      await prisma.warehouseInventory.create({ data: { itemId: item.id, qty: 0 } });
      created += 1;
    }
  }

  await setSetting("integration.lastSyncAt", new Date().toISOString());
  await setSetting("integration.lastError", "");
  logger.info({ created, updated, total: items.length }, "номенклатура 1С синхронизирована");
  return { created, updated, total: items.length };
}

export interface PushResult {
  sent: number;
  failed: number;
  pending: number;
  errors: string[];
}

export async function pushPending(limit = 20, adapter?: ErpAdapter): Promise<PushResult> {
  const active = adapter ?? (await buildAdapter());
  if (!active) throw new Error("Интеграция выключена");

  const now = new Date();
  const entries = await prisma.outboxEntry.findMany({
    where: {
      status: "PENDING",
      attempts: { lt: MAX_OUTBOX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    include: {
      operation: {
        include: {
          items: { include: { item: true } },
          room: { select: { number: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const result: PushResult = { sent: 0, failed: 0, pending: 0, errors: [] };

  for (const entry of entries) {
    const operation = entry.operation;
    const lines = operation.items.map((line) => ({
      externalId: line.item.externalId ?? "",
      qty: line.qty,
      unitPriceKopecks: line.item.priceKopecks,
      totalKopecks: line.qty * line.item.priceKopecks,
    }));

    if (lines.some((line) => !line.externalId)) {
      const message = "В операции есть позиции без кода 1С (externalId)";
      await prisma.outboxEntry.update({
        where: { id: entry.id },
        data: { status: "FAILED", attempts: MAX_OUTBOX_ATTEMPTS, lastError: message },
      });
      result.failed += 1;
      result.errors.push(`${operation.id}: ${message}`);
      continue;
    }

    const dto: ErpOperationDto = {
      id: operation.id,
      type: operation.type,
      roomNumber: operation.room?.number,
      reason: operation.reason ?? undefined,
      createdAt: operation.createdAt.toISOString(),
      documentDate: operation.documentDate.toISOString(),
      items: lines,
    };

    try {
      const outcome = await active.pushOperation(dto);
      if (!outcome.ok) throw new Error(outcome.error ?? "1С отклонила операцию");

      await prisma.outboxEntry.update({
        where: { id: entry.id },
        data: {
          status: "SENT",
          attempts: entry.attempts + 1,
          lastError: null,
          externalRef: outcome.externalRef ?? null,
          nextAttemptAt: null,
        },
      });
      result.sent += 1;
    } catch (error) {
      const attempts = entry.attempts + 1;
      const permanent = attempts >= MAX_OUTBOX_ATTEMPTS;
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      await prisma.outboxEntry.update({
        where: { id: entry.id },
        data: {
          status: permanent ? "FAILED" : "PENDING",
          attempts,
          lastError: message,
          nextAttemptAt: permanent ? null : new Date(Date.now() + backoffMs(attempts)),
        },
      });
      if (permanent) result.failed += 1;
      else result.pending += 1;
      result.errors.push(`${operation.id}: ${message}`);
    }
  }

  if (result.errors.length > 0) {
    await recordSyncError(result.errors[0]);
  }
  if (result.sent > 0) {
    logger.info({ sent: result.sent, pending: result.pending, failed: result.failed }, "outbox отправлен в 1С");
  }
  return result;
}
