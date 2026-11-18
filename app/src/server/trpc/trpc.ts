import { randomUUID } from "node:crypto";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type PermissionCode, type SessionUser } from "@/lib/rbac";
import { logEvent, moduleForPath } from "@/server/services/logging";

export interface Context {
  user: SessionUser | null;
  requestId?: string;
}

export async function createContext(): Promise<Context> {
  return { user: await getCurrentUser() };
}

function zodMessage(cause: unknown): string | null {
  if (cause instanceof ZodError) {
    return cause.issues.map((issue) => issue.message).join("; ");
  }
  return null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const message = zodMessage(error.cause);
    return message ? { ...shape, message } : shape;
  },
});

export const router = t.router;

const loggingMiddleware = t.middleware(async ({ path, type, ctx, next }) => {
  const started = Date.now();
  const requestId = randomUUID();
  try {
    const result = await next({ ctx: { ...ctx, requestId } });
    if (type === "mutation") {
      await logEvent({
        module: moduleForPath(path),
        action: path,
        outcome: "success",
        requestId,
        user: ctx.user,
        durationMs: Date.now() - started,
      });
    }
    return result;
  } catch (error) {
    const code = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR";
    await logEvent({
      module: moduleForPath(path),
      action: path,
      level: "error",
      outcome: "failure",
      message: error instanceof Error ? error.message : String(error),
      errorCode: code,
      requestId,
      user: ctx.user,
      durationMs: Date.now() - started,
    });
    throw error;
  }
});

export const publicProcedure = t.procedure.use(loggingMiddleware);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется вход" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Право проверяется на сервере, не в UI (ТЗ §4, §6.2). */
export function permissionProcedure(code: PermissionCode) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!hasPermission(ctx.user, code)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Нет права ${code}` });
    }
    return next();
  });
}
