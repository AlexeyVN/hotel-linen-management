/**
 * Политика ретраев офлайн-очереди (ТЗ §9.2):
 * повтор с экспоненциальной задержкой, максимум 8 попыток;
 * 4xx — конфликт, разбирает оператор, автоматических повторов нет.
 */

export const MAX_ATTEMPTS = 8;

/** 1 с, 2 с, 4 с … максимум 30 минут. */
export function backoffMs(attempt: number): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 20));
  const delay = 1000 * 2 ** safeAttempt;
  return Math.min(delay, 30 * 60_000);
}

const CONFLICT_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "PARSE_ERROR",
  "METHOD_NOT_SUPPORTED",
]);

export type FailureKind = "conflict" | "retry";

/** Классификация ошибки tRPC: конфликт данных против временного сбоя. */
export function classifyFailure(input: {
  code?: string | null;
  message?: string | null;
}): FailureKind {
  if (input.code && CONFLICT_CODES.has(input.code)) return "conflict";
  return "retry";
}

/** Повторное применение уже проведённой инвентаризации — это успех, а не конфликт. */
export function isAlreadyApplied(message: string | null | undefined): boolean {
  return Boolean(message && message.includes("уже проведена"));
}

export interface RetryDecision {
  status: "pending" | "conflict" | "failed";
  attempts: number;
  nextAttemptAt: number;
}

export function nextRetryState(input: {
  attempts: number;
  now: number;
  failure: FailureKind;
  message?: string | null;
}): RetryDecision {
  if (input.failure === "conflict") {
    return { status: "conflict", attempts: input.attempts, nextAttemptAt: 0 };
  }
  const attempts = input.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { status: "failed", attempts, nextAttemptAt: 0 };
  }
  return { status: "pending", attempts, nextAttemptAt: input.now + backoffMs(attempts) };
}
