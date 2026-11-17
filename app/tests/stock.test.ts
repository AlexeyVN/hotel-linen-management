import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyOperation,
  type OperationDraft,
  type StockLevels,
} from "../src/lib/domain/stock";

function levels(warehouse: Record<string, number> = {}, room: Record<string, number> = {}): StockLevels {
  return { warehouse, room };
}

test("RECEIVE увеличивает остаток склада", () => {
  const result = applyOperation(
    { type: "RECEIVE", items: [{ itemId: "i1", qty: 5 }] },
    levels({ i1: 10 }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.levels.warehouse.i1, 15);
  assert.equal(result.levels.room.i1, undefined);
});

test("RECEIVE отклоняет нулевое и отрицательное количество", () => {
  for (const qty of [0, -3]) {
    const result = applyOperation(
      { type: "RECEIVE", items: [{ itemId: "i1", qty }] },
      levels({ i1: 10 }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.errors[0]?.code, "NON_POSITIVE_QTY");
  }
});

test("DISTRIBUTE переносит со склада в номер", () => {
  const result = applyOperation(
    { type: "DISTRIBUTE", items: [{ itemId: "i1", qty: 4 }] },
    levels({ i1: 10 }, { i1: 2 }),
    { hasRoom: true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.levels.warehouse.i1, 6);
  assert.equal(result.levels.room.i1, 6);
});

test("DISTRIBUTE сверх остатка отклоняется, остатки не меняются", () => {
  const result = applyOperation(
    { type: "DISTRIBUTE", items: [{ itemId: "i1", qty: 11 }] },
    levels({ i1: 10 }),
    { hasRoom: true },
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "INSUFFICIENT_STOCK");
  assert.equal(result.levels.warehouse.i1, 10);
});

test("DISTRIBUTE без номера отклоняется", () => {
  const result = applyOperation(
    { type: "DISTRIBUTE", items: [{ itemId: "i1", qty: 1 }] },
    levels({ i1: 10 }),
    { hasRoom: false },
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "ROOM_REQUIRED");
});

test("RETURN возвращает из номера на склад", () => {
  const result = applyOperation(
    { type: "RETURN", items: [{ itemId: "i1", qty: 3 }] },
    levels({ i1: 5 }, { i1: 4 }),
    { hasRoom: true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.levels.warehouse.i1, 8);
  assert.equal(result.levels.room.i1, 1);
});

test("WRITE_OFF со склада уменьшает остаток", () => {
  const result = applyOperation(
    { type: "WRITE_OFF", location: "WAREHOUSE", items: [{ itemId: "i1", qty: 2 }] },
    levels({ i1: 5 }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.levels.warehouse.i1, 3);
});

test("AUDIT применяет расхождение факт минус учёт", () => {
  const result = applyOperation(
    {
      type: "AUDIT",
      auditItems: [
        { itemId: "i1", expectedQty: 4, factQty: 3 },
        { itemId: "i2", expectedQty: 2, factQty: 5 },
      ],
    },
    levels({}, { i1: 4, i2: 2 }),
    { hasRoom: true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.levels.room.i1, 3);
  assert.equal(result.levels.room.i2, 5);
  assert.equal(result.changes.length, 2);
});

test("AUDIT без изменений не порождает корректировок", () => {
  const result = applyOperation(
    { type: "AUDIT", auditItems: [{ itemId: "i1", expectedQty: 4, factQty: 4 }] },
    levels({}, { i1: 4 }),
    { hasRoom: true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.changes.length, 0);
});

test("AUDIT отклоняет отрицательный факт", () => {
  const result = applyOperation(
    { type: "AUDIT", auditItems: [{ itemId: "i1", expectedQty: 4, factQty: -1 }] },
    levels({}, { i1: 4 }),
    { hasRoom: true },
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "INVALID_AUDIT_LINE");
});

test("пустая операция отклоняется", () => {
  const draft: OperationDraft = { type: "RECEIVE", items: [] };
  const result = applyOperation(draft, levels());
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "EMPTY_OPERATION");
});
