/**
 * Отчёты: расчёт дефицита по минимальным остаткам (ТЗ §7.7).
 * Чистая функция — тестируется отдельно от БД.
 */

export interface LowStockRow {
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  itemId: string;
  itemName: string;
  unit: string;
  qty: number;
}

export interface MinStockRule {
  roomTypeId: string;
  itemId: string;
  minQty: number;
}

export interface LowStockIssue {
  roomNumber: string;
  itemId: string;
  itemName: string;
  unit: string;
  have: number;
  min: number;
  missing: number;
}

export function computeLowStock(
  rows: readonly LowStockRow[],
  rules: readonly MinStockRule[],
): LowStockIssue[] {
  const limits = new Map<string, number>();
  for (const rule of rules) {
    limits.set(`${rule.roomTypeId}:${rule.itemId}`, rule.minQty);
  }

  const issues: LowStockIssue[] = [];
  for (const row of rows) {
    const min = limits.get(`${row.roomTypeId}:${row.itemId}`) ?? 0;
    if (min > 0 && row.qty < min) {
      issues.push({
        roomNumber: row.roomNumber,
        itemId: row.itemId,
        itemName: row.itemName,
        unit: row.unit,
        have: row.qty,
        min,
        missing: min - row.qty,
      });
    }
  }

  return issues.sort(
    (a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, "ru", { numeric: true }) ||
      a.itemName.localeCompare(b.itemName, "ru"),
  );
}
