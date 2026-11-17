import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLowStock } from "../src/lib/domain/reports";

const rules = [{ roomTypeId: "std", itemId: "towel", minQty: 2 }];

test("дефицит считается по типу комнаты", () => {
  const issues = computeLowStock(
    [
      { roomId: "r1", roomNumber: "101", roomTypeId: "std", itemId: "towel", itemName: "Полотенце", unit: "шт", qty: 1 },
      { roomId: "r2", roomNumber: "102", roomTypeId: "std", itemId: "towel", itemName: "Полотенце", unit: "шт", qty: 5 },
    ],
    rules,
  );
  assert.deepEqual(issues, [
    { roomNumber: "101", itemId: "towel", itemName: "Полотенце", unit: "шт", have: 1, min: 2, missing: 1 },
  ]);
});

test("правило другого типа комнаты не применяется", () => {
  const issues = computeLowStock(
    [{ roomId: "r3", roomNumber: "201", roomTypeId: "suite", itemId: "towel", itemName: "Полотенце", unit: "шт", qty: 0 }],
    rules,
  );
  assert.equal(issues.length, 0);
});

test("сортировка по номеру и названию", () => {
  const issues = computeLowStock(
    [
      { roomId: "r2", roomNumber: "102", roomTypeId: "std", itemId: "towel", itemName: "Полотенце", unit: "шт", qty: 0 },
      { roomId: "r1", roomNumber: "101", roomTypeId: "std", itemId: "towel", itemName: "Полотенце", unit: "шт", qty: 0 },
    ],
    rules,
  );
  assert.deepEqual(issues.map((issue) => issue.roomNumber), ["101", "102"]);
});

test("нулевой минимум не создаёт дефицита", () => {
  const issues = computeLowStock(
    [{ roomId: "r1", roomNumber: "101", roomTypeId: "std", itemId: "soap", itemName: "Мыло", unit: "шт", qty: 0 }],
    rules,
  );
  assert.equal(issues.length, 0);
});
