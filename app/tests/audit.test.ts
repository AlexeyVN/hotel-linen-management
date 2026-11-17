import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAuditDeltas, summarizeAudit, summarizeAuditValue } from "../src/lib/domain/audit";

test("расхождение: недостача и излишек", () => {
  const deltas = computeAuditDeltas([
    { itemId: "i1", expectedQty: 4, factQty: 3 },
    { itemId: "i2", expectedQty: 2, factQty: 5 },
    { itemId: "i3", expectedQty: 1, factQty: 1 },
  ]);
  assert.deepEqual(deltas, [
    { itemId: "i1", delta: -1 },
    { itemId: "i2", delta: 3 },
    { itemId: "i3", delta: 0 },
  ]);
});

test("сводка считает изменённые позиции и суммы", () => {
  const summary = summarizeAudit([
    { itemId: "i1", expectedQty: 4, factQty: 3 },
    { itemId: "i2", expectedQty: 2, factQty: 5 },
    { itemId: "i3", expectedQty: 1, factQty: 1 },
  ]);
  assert.deepEqual(summary, { lines: 3, changed: 2, increase: 3, decrease: -1 });
});

test("полное совпадение — нет изменений", () => {
  const summary = summarizeAudit([
    { itemId: "i1", expectedQty: 0, factQty: 0 },
    { itemId: "i2", expectedQty: 7, factQty: 7 },
  ]);
  assert.deepEqual(summary, { lines: 2, changed: 0, increase: 0, decrease: 0 });
});

test("пустой список не ломает сводку", () => {
  assert.deepEqual(summarizeAudit([]), { lines: 0, changed: 0, increase: 0, decrease: 0 });
});

test("стоимость расхождений считается по текущей цене", () => {
  const summary = summarizeAuditValue([
    { itemId: "i1", expectedQty: 2, factQty: 1, priceKopecks: 45000 },
    { itemId: "i2", expectedQty: 1, factQty: 3, priceKopecks: 120000 },
    { itemId: "i3", expectedQty: 5, factQty: 5, priceKopecks: 90000 },
  ]);
  assert.equal(summary.shortageKopecks, 45000);
  assert.equal(summary.surplusKopecks, 240000);
  assert.equal(summary.valueKopecks, 195000);
});

test("нулевые расхождения не дают стоимости", () => {
  assert.deepEqual(summarizeAuditValue([]), {
    valueKopecks: 0,
    surplusKopecks: 0,
    shortageKopecks: 0,
  });
});
