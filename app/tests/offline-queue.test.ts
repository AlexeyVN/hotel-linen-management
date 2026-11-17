import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ATTEMPTS,
  backoffMs,
  classifyFailure,
  isAlreadyApplied,
  nextRetryState,
} from "../src/lib/offline/backoff";

test("задержка растёт экспоненциально и упирается в 30 минут", () => {
  assert.equal(backoffMs(0), 1000);
  assert.equal(backoffMs(1), 2000);
  assert.equal(backoffMs(2), 4000);
  assert.equal(backoffMs(10), 1024 * 1000);
  assert.equal(backoffMs(11), 30 * 60_000);
  assert.equal(backoffMs(50), 30 * 60_000);
});

test("4xx — конфликт, 5xx и сеть — повтор", () => {
  assert.equal(classifyFailure({ code: "BAD_REQUEST" }), "conflict");
  assert.equal(classifyFailure({ code: "FORBIDDEN" }), "conflict");
  assert.equal(classifyFailure({ code: "INTERNAL_SERVER_ERROR" }), "retry");
  assert.equal(classifyFailure({ code: "TIMEOUT" }), "retry");
  assert.equal(classifyFailure({}), "retry");
});

test("повторное применение инвентаризации распознаётся как успех", () => {
  assert.equal(isAlreadyApplied("Инвентаризация уже проведена — правки запрещены"), true);
  assert.equal(isAlreadyApplied("Недостаточно на складе"), false);
  assert.equal(isAlreadyApplied(null), false);
});

test("конфликт не ретраится автоматически", () => {
  const decision = nextRetryState({
    attempts: 3,
    now: 1000,
    failure: "conflict",
    message: "Недостаточно на складе",
  });
  assert.deepEqual(decision, { status: "conflict", attempts: 3, nextAttemptAt: 0 });
});

test("после 8 попыток запись уходит в failed", () => {
  const decision = nextRetryState({
    attempts: MAX_ATTEMPTS - 1,
    now: 1000,
    failure: "retry",
  });
  assert.equal(decision.status, "failed");
  assert.equal(decision.attempts, MAX_ATTEMPTS);
});

test("промежуточная ошибка планирует повтор", () => {
  const decision = nextRetryState({ attempts: 0, now: 1000, failure: "retry" });
  assert.equal(decision.status, "pending");
  assert.equal(decision.attempts, 1);
  assert.equal(decision.nextAttemptAt, 1000 + backoffMs(1));
});
