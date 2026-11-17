import { TRPCClientError, createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/trpc/root";
import { classifyFailure, isAlreadyApplied, nextRetryState } from "./backoff";
import { listMutations, removeMutation, updateMutation, type QueuedMutation } from "./db";

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

async function send(mutation: QueuedMutation): Promise<void> {
  if (mutation.kind === "DISTRIBUTE") {
    const payload = mutation.payload as {
      roomId: string;
      items: Array<{ itemId: string; qty: number }>;
      comment?: string;
    };
    await client.operations.distribute.mutate({ ...payload, clientOpId: mutation.clientOpId });
    return;
  }
  if (mutation.kind === "SAVE_AUDIT_DRAFT") {
    const payload = mutation.payload as {
      sessionId: string;
      lines: Array<{ itemId: string; factQty: number }>;
    };
    await client.audit.saveDraft.mutate(payload);
    return;
  }
  if (mutation.kind === "TASK_STATUS") {
    const payload = mutation.payload as {
      taskId: string;
      status: "IN_PROGRESS" | "DONE" | "CANCELLED";
    };
    await client.cleaning.setStatus.mutate(payload);
    return;
  }
  const payload = mutation.payload as { sessionId: string };
  await client.audit.applyAudit.mutate(payload);
}

export interface FlushResult {
  sent: number;
  conflicts: number;
  retries: number;
  failed: number;
}

/** Отправляет готовые к отправке записи; не бросает исключение наружу. */
export async function flushQueue(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, conflicts: 0, retries: 0, failed: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return result;

  const pending = await listMutations();
  for (const mutation of pending) {
    if (mutation.status !== "pending" || mutation.nextAttemptAt > Date.now()) continue;
    try {
      await send(mutation);
      await removeMutation(mutation.id);
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      // Повтор уже проведённой инвентаризации — это успех (идемпотентность по audit-<id>).
      if (mutation.kind === "APPLY_AUDIT" && isAlreadyApplied(message)) {
        await removeMutation(mutation.id);
        result.sent += 1;
        continue;
      }
      const code =
        error instanceof TRPCClientError
          ? ((error.data as { code?: string } | undefined)?.code ?? null)
          : null;
      const decision = nextRetryState({
        attempts: mutation.attempts,
        now: Date.now(),
        failure: classifyFailure({ code, message }),
        message,
      });
      await updateMutation(mutation.id, {
        ...decision,
        lastError: message ?? "Неизвестная ошибка",
      });
      if (decision.status === "conflict") result.conflicts += 1;
      else if (decision.status === "failed") result.failed += 1;
      else result.retries += 1;
    }
  }
  return result;
}

/** Ручной повтор записи после разбора конфликта. */
export async function retryMutation(id: string): Promise<FlushResult> {
  await updateMutation(id, {
    status: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    lastError: undefined,
  });
  return flushQueue();
}
