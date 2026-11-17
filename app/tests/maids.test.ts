import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maidWorkStatus,
  summarizeMaidPlan,
  uniqueRoomIds,
} from "../src/lib/domain/maids";

test("статус горничной по приоритету", () => {
  assert.equal(
    maidWorkStatus({ isActive: false, hasOpenShift: true, hasInProgress: true }),
    "INACTIVE",
  );
  assert.equal(
    maidWorkStatus({ isActive: true, hasOpenShift: true, hasInProgress: true }),
    "WORKING",
  );
  assert.equal(
    maidWorkStatus({ isActive: true, hasOpenShift: true, hasInProgress: false }),
    "ON_SHIFT",
  );
  assert.equal(
    maidWorkStatus({ isActive: true, hasOpenShift: false, hasInProgress: false }),
    "OFF_SHIFT",
  );
});

test("план не включает отменённые задачи", () => {
  const summary = summarizeMaidPlan([
    { status: "DONE", roomId: "r1", startedAt: "2026-11-05T09:00:00Z", finishedAt: "2026-11-05T09:30:00Z" },
    { status: "NEW", roomId: "r2" },
    { status: "CANCELLED", roomId: "r3" },
  ]);
  assert.equal(summary.plan, 2);
  assert.equal(summary.done, 1);
  assert.equal(summary.cancelled, 1);
  assert.equal(summary.percent, 50);
  assert.equal(summary.avgMinutes, 30);
  assert.equal(summary.roomsDone, 1);
});

test("пустой план даёт процент null", () => {
  const summary = summarizeMaidPlan([]);
  assert.equal(summary.plan, 0);
  assert.equal(summary.percent, null);
  assert.equal(summary.avgMinutes, null);
});

test("несколько задач в одном номере считаются как один убранный номер", () => {
  const summary = summarizeMaidPlan([
    { status: "DONE", roomId: "r1" },
    { status: "DONE", roomId: "r1" },
    { status: "DONE", roomId: "r2" },
  ]);
  assert.equal(summary.roomsDone, 2);
  assert.equal(summary.percent, 100);
});

test("уникальные номера горничной", () => {
  assert.deepEqual(uniqueRoomIds([{ roomId: "a" }, { roomId: "b" }, { roomId: "a" }]), ["a", "b"]);
});
