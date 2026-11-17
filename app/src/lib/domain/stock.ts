/**
 * Доменная логика остатков — чистые функции без БД, тестируется node --test.
 * Одна и та же логика используется сервером при проведении операции.
 * ТЗ v2.3 §5.2, §7.3–§7.6.
 */

export const OPERATION_TYPES = {
  RECEIVE: "RECEIVE",
  DISTRIBUTE: "DISTRIBUTE",
  RETURN: "RETURN",
  WRITE_OFF: "WRITE_OFF",
  AUDIT: "AUDIT",
} as const;

export type OperationType = (typeof OPERATION_TYPES)[keyof typeof OPERATION_TYPES];

export type StockLocation = "WAREHOUSE" | "ROOM";

export interface StockLevels {
  warehouse: Record<string, number>;
  room: Record<string, number>;
}

export interface StockChange {
  itemId: string;
  location: StockLocation;
  delta: number;
}

export interface StockError {
  code:
    | "NON_POSITIVE_QTY"
    | "NON_INTEGER_QTY"
    | "ROOM_REQUIRED"
    | "ROOM_NOT_ALLOWED"
    | "INSUFFICIENT_STOCK"
    | "INVALID_AUDIT_LINE"
    | "EMPTY_OPERATION";
  message: string;
  itemId?: string;
}

export interface OperationDraft {
  type: OperationType;
  /** Для RECEIVE / DISTRIBUTE / RETURN / WRITE_OFF. */
  items?: Array<{ itemId: string; qty: number }>;
  /** Для AUDIT: учётное и фактическое количество. */
  auditItems?: Array<{ itemId: string; expectedQty: number; factQty: number }>;
  /** Только для WRITE_OFF. */
  location?: StockLocation;
}

export interface ApplyResult {
  ok: boolean;
  changes: StockChange[];
  errors: StockError[];
  levels: StockLevels;
}

function cloneLevels(levels: StockLevels): StockLevels {
  return {
    warehouse: { ...levels.warehouse },
    room: { ...levels.room },
  };
}

function readLevel(levels: StockLevels, location: StockLocation, itemId: string): number {
  const bucket = location === "WAREHOUSE" ? levels.warehouse : levels.room;
  return bucket[itemId] ?? 0;
}

function applyChange(levels: StockLevels, change: StockChange): void {
  const bucket = change.location === "WAREHOUSE" ? levels.warehouse : levels.room;
  bucket[change.itemId] = (bucket[change.itemId] ?? 0) + change.delta;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Проверяет и применяет черновик операции к копии остатков.
 * Возвращает либо изменения и новые уровни, либо список ошибок — без частичного применения.
 */
export function applyOperation(
  draft: OperationDraft,
  levels: StockLevels,
  options: { hasRoom?: boolean } = {},
): ApplyResult {
  const hasRoom = options.hasRoom ?? true;
  const errors: StockError[] = [];
  const target = cloneLevels(levels);
  const changes: StockChange[] = [];

  const requireRoom = () => {
    if (!hasRoom) {
      errors.push({ code: "ROOM_REQUIRED", message: "Для этой операции нужен номер" });
      return false;
    }
    return true;
  };

  if (draft.type === "AUDIT") {
    const auditItems = draft.auditItems ?? [];
    if (auditItems.length === 0) {
      errors.push({ code: "EMPTY_OPERATION", message: "Инвентаризация без позиций" });
    }
    if (!requireRoom()) return { ok: false, changes, errors, levels };

    for (const line of auditItems) {
      if (!isNonNegativeInt(line.expectedQty) || !isNonNegativeInt(line.factQty)) {
        errors.push({
          code: "INVALID_AUDIT_LINE",
          message: "Количества должны быть целыми и неотрицательными",
          itemId: line.itemId,
        });
        continue;
      }
      const delta = line.factQty - line.expectedQty;
      if (delta !== 0) {
        changes.push({ itemId: line.itemId, location: "ROOM", delta });
      }
    }
  } else {
    const items = draft.items ?? [];
    if (items.length === 0) {
      errors.push({ code: "EMPTY_OPERATION", message: "Операция без позиций" });
    }

    for (const line of items) {
      if (!isPositiveInt(line.qty)) {
        errors.push({
          code: Number.isInteger(line.qty) ? "NON_POSITIVE_QTY" : "NON_INTEGER_QTY",
          message: "Количество должно быть целым и больше нуля",
          itemId: line.itemId,
        });
        continue;
      }

      switch (draft.type) {
        case "RECEIVE":
          changes.push({ itemId: line.itemId, location: "WAREHOUSE", delta: line.qty });
          break;
        case "DISTRIBUTE":
          if (!requireRoom()) return { ok: false, changes, errors, levels };
          changes.push({ itemId: line.itemId, location: "WAREHOUSE", delta: -line.qty });
          changes.push({ itemId: line.itemId, location: "ROOM", delta: line.qty });
          break;
        case "RETURN":
          if (!requireRoom()) return { ok: false, changes, errors, levels };
          changes.push({ itemId: line.itemId, location: "ROOM", delta: -line.qty });
          changes.push({ itemId: line.itemId, location: "WAREHOUSE", delta: line.qty });
          break;
        case "WRITE_OFF": {
          const location = draft.location ?? "WAREHOUSE";
          if (location === "ROOM" && !requireRoom()) return { ok: false, changes, errors, levels };
          changes.push({ itemId: line.itemId, location, delta: -line.qty });
          break;
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, changes: [], errors, levels };

  // Применяем и следим, чтобы ни один остаток не ушёл в минус.
  for (const change of changes) {
    applyChange(target, change);
    if (readLevel(target, change.location, change.itemId) < 0) {
      errors.push({
        code: "INSUFFICIENT_STOCK",
        message:
          change.location === "WAREHOUSE"
            ? "Недостаточно на складе"
            : "Недостаточно в номере",
        itemId: change.itemId,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, changes: [], errors, levels };
  }

  return { ok: true, changes, errors, levels: target };
}
