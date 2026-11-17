/**
 * Инвентаризация: расхождения считаются как факт минус учёт (ТЗ §7.6).
 * Чистые функции — тестируются node --test, сервер использует их же.
 */

export interface AuditLineInput {
  itemId: string;
  expectedQty: number;
  factQty: number;
}

export interface AuditDelta {
  itemId: string;
  delta: number;
}

export function computeAuditDeltas(lines: readonly AuditLineInput[]): AuditDelta[] {
  return lines.map((line) => ({
    itemId: line.itemId,
    delta: line.factQty - line.expectedQty,
  }));
}

export interface AuditSummary {
  lines: number;
  changed: number;
  increase: number;
  decrease: number;
}

export function summarizeAudit(lines: readonly AuditLineInput[]): AuditSummary {
  const deltas = computeAuditDeltas(lines);
  return {
    lines: lines.length,
    changed: deltas.filter((entry) => entry.delta !== 0).length,
    increase: deltas.filter((entry) => entry.delta > 0).reduce((sum, entry) => sum + entry.delta, 0),
    decrease: deltas.filter((entry) => entry.delta < 0).reduce((sum, entry) => sum + entry.delta, 0),
  };
}

export interface AuditValueLine extends AuditLineInput {
  priceKopecks: number;
}

export interface AuditValueSummary {
  /** Сумма расхождений: излишек плюс, недостача минус. */
  valueKopecks: number;
  surplusKopecks: number;
  shortageKopecks: number;
}

/** Оценка расхождений по текущей цене справочника (ТЗ v2.6). */
export function summarizeAuditValue(lines: readonly AuditValueLine[]): AuditValueSummary {
  let value = 0;
  let surplus = 0;
  let shortage = 0;
  for (const line of lines) {
    const delta = line.factQty - line.expectedQty;
    if (delta === 0) continue;
    const amount = delta * line.priceKopecks;
    value += amount;
    if (amount > 0) surplus += amount;
    else shortage += -amount;
  }
  return { valueKopecks: value, surplusKopecks: surplus, shortageKopecks: shortage };
}
