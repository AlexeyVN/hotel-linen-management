import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canCompleteTask,
  computeChecklistProgress,
} from "../src/lib/domain/checklist";

const items = [
  { id: "i1", text: "Пыль", photoRequired: false },
  { id: "i2", text: "Санузел", photoRequired: true },
];

test("без ответов чек-лист не завершён", () => {
  const progress = computeChecklistProgress(items, []);
  assert.equal(progress.complete, false);
  assert.deepEqual(progress.missingIds, ["i1", "i2"]);
  assert.equal(progress.answered, 0);
});

test("ответы без обязательного фото не закрывают пункт", () => {
  const progress = computeChecklistProgress(items, [
    { itemId: "i1", answer: "YES" },
    { itemId: "i2", answer: "YES" },
  ]);
  assert.equal(progress.complete, false);
  assert.deepEqual(progress.missingPhotoIds, ["i2"]);
  assert.equal(progress.answered, 2);
});

test("все ответы и фото — чек-лист завершён", () => {
  const progress = computeChecklistProgress(items, [
    { itemId: "i1", answer: "YES" },
    { itemId: "i2", answer: "NO", photoFileName: "2026/11/x.jpg" },
  ]);
  assert.equal(progress.complete, true);
  assert.equal(progress.photosRequired, 1);
  assert.equal(progress.photosMissing, 0);
  assert.equal(canCompleteTask(items, [
    { itemId: "i1", answer: "YES" },
    { itemId: "i2", answer: "NO", photoFileName: "2026/11/x.jpg" },
  ]), true);
});

test("дополнительный вариант ответа считается ответом", () => {
  const progress = computeChecklistProgress(
    [{ id: "i1", text: "Минибар", photoRequired: false }],
    [{ itemId: "i1", answer: "EXTRA" }],
  );
  assert.equal(progress.complete, true);
});

test("задача без чек-листа завершается", () => {
  assert.equal(canCompleteTask([], []), true);
});
