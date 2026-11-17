import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRoomStatus,
  parseInboundRoomStatus,
  RoomStatusInputError,
} from "../src/server/erp/room-status";

test("статусы 1С нормализуются в CLEAN/DIRTY/INSPECTED/OUT_OF_ORDER", () => {
  assert.equal(normalizeRoomStatus("Чистый"), "CLEAN");
  assert.equal(normalizeRoomStatus("грязный"), "DIRTY");
  assert.equal(normalizeRoomStatus("INSPECTED"), "INSPECTED");
  assert.equal(normalizeRoomStatus("В ремонте"), "OUT_OF_ORDER");
  assert.equal(normalizeRoomStatus("unknown"), null);

  const parsed = parseInboundRoomStatus({
    id: "evt-1",
    number: 101,
    cleaningStatus: "Грязный",
    timestamp: "2026-11-05T16:20:00+03:00",
  });
  assert.equal(parsed.eventId, "evt-1");
  assert.equal(parsed.roomNumber, "101");
  assert.equal(parsed.status, "DIRTY");

  assert.throws(
    () => parseInboundRoomStatus({ roomNumber: "101", status: "unknown" }),
    RoomStatusInputError,
  );
});
