import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  priorityRank,
  sortTasks,
  summarizeCleaning,
} from "../src/lib/domain/cleaning";

test("разрешённые переходы статусов задачи", () => {
  assert.equal(canTransition("NEW", "IN_PROGRESS"), true);
  assert.equal(canTransition("NEW", "CANCELLED"), true);
  assert.equal(canTransition("IN_PROGRESS", "DONE"), true);
  assert.equal(canTransition("IN_PROGRESS", "CANCELLED"), true);
});

test("запрещённые переходы: из DONE/CANCELLED и перескок NEW→DONE", () => {
  assert.equal(canTransition("NEW", "DONE"), false);
  assert.equal(canTransition("DONE", "IN_PROGRESS"), false);
  assert.equal(canTransition("CANCELLED", "NEW"), false);
  assert.equal(canTransition("DONE", "DONE"), false);
});

test("приоритеты ранжируются: срочно → средний → низкий", () => {
  assert.equal(priorityRank("URGENT"), 0);
  assert.equal(priorityRank("MEDIUM"), 1);
  assert.equal(priorityRank("LOW"), 2);
  assert.equal(priorityRank("UNKNOWN"), 3);
});

test("активные задачи выше завершённых, внутри — приоритет", () => {
  const tasks = [
    { id: "done", priority: "URGENT", status: "DONE", createdAt: "2026-11-05T08:00:00Z" },
    { id: "low", priority: "LOW", status: "NEW", createdAt: "2026-11-05T09:00:00Z" },
    { id: "urgent", priority: "URGENT", status: "NEW", createdAt: "2026-11-05T10:00:00Z" },
    { id: "progress", priority: "MEDIUM", status: "IN_PROGRESS", createdAt: "2026-11-05T07:00:00Z" },
  ];
  assert.deepEqual(
    sortTasks(tasks).map((task) => task.id),
    ["urgent", "low", "progress", "done"],
  );
});

test("сводка считает выполненные, в работе и среднее время", () => {
  const summary = summarizeCleaning([
    {
      status: "DONE",
      startedAt: "2026-11-05T09:00:00Z",
      finishedAt: "2026-11-05T09:20:00Z",
    },
    {
      status: "DONE",
      startedAt: "2026-11-05T10:00:00Z",
      finishedAt: "2026-11-05T10:40:00Z",
    },
    { status: "IN_PROGRESS", startedAt: "2026-11-05T11:00:00Z", finishedAt: null },
    { status: "CANCELLED", startedAt: null, finishedAt: null },
  ]);
  assert.deepEqual(summary, {
    total: 4,
    done: 2,
    inProgress: 1,
    cancelled: 1,
    avgMinutes: 30,
  });
});

test("без выполненных задач среднего времени нет", () => {
  const summary = summarizeCleaning([
    { status: "NEW", startedAt: null, finishedAt: null },
  ]);
  assert.equal(summary.avgMinutes, null);
  assert.equal(summary.total, 1);
});
