import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogModule =
  | "auth"
  | "users"
  | "catalog"
  | "warehouse"
  | "operations"
  | "audit"
  | "cleaning"
  | "checklists"
  | "qr"
  | "reports"
  | "integration"
  | "settings"
  | "system";

export interface LogEventInput {
  module: LogModule;
  action: string;
  level?: LogLevel;
  outcome?: "success" | "failure" | "denied" | "skipped";
  message?: string;
  requestId?: string;
  user?: Pick<SessionUser, "id" | "login" | "roleCode"> | null;
  entityType?: string;
  entityId?: string;
  durationMs?: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|csrf|api[-_]?key|webhook/i;
const MAX_METADATA_LENGTH = 4000;

/** Remove secrets and bound free-form values before they ever reach disk. */
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = sanitizeMetadata(item, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function serializeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null;
  const text = JSON.stringify(sanitizeMetadata(metadata));
  return text.length > MAX_METADATA_LENGTH ? `${text.slice(0, MAX_METADATA_LENGTH)}…` : text;
}

export async function logEvent(input: LogEventInput): Promise<void> {
  const level = input.level ?? "info";
  const requestId = input.requestId ?? randomUUID();
  const record = {
    level,
    module: input.module,
    action: input.action,
    outcome: input.outcome ?? null,
    message: input.message ? input.message.slice(0, 500) : null,
    userId: input.user?.id ?? null,
    userLogin: input.user?.login ?? null,
    userRole: input.user?.roleCode ?? null,
    requestId,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    durationMs: input.durationMs ?? null,
    errorCode: input.errorCode ?? null,
    metadata: serializeMetadata(input.metadata),
  };

  // File log is always attempted; DB failure must not break the request.
  logger[level]({ ...record, metadata: undefined }, `${input.module}.${input.action}`);

  try {
    await prisma.logEvent.create({ data: record });
  } catch (error) {
    logger.warn(
      { module: "system", action: "log.persist.failed", requestId, error: String(error) },
      "system.log.persist.failed",
    );
  }
}

export async function cleanupOldLogEvents(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.logEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

export function moduleForPath(path: string): LogModule {
  const value = path.toLowerCase();
  if (value.startsWith("users.") || value.startsWith("auth.")) return value.startsWith("auth.") ? "auth" : "users";
  if (value.includes("catalog")) return "catalog";
  if (value.includes("warehouse") || value.includes("operations.receive")) return "warehouse";
  if (value.includes("operations") || value.includes("distribution") || value.includes("return") || value.includes("writeoff")) return "operations";
  if (value.includes("audit")) return "audit";
  if (value.includes("cleaning")) return "cleaning";
  if (value.includes("checklist")) return "checklists";
  if (value.includes("qr")) return "qr";
  if (value.includes("reports")) return "reports";
  if (value.includes("integration")) return "integration";
  if (value.includes("settings")) return "settings";
  return "system";
}
