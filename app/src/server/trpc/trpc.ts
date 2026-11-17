import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type PermissionCode, type SessionUser } from "@/lib/rbac";

export interface Context {
  user: SessionUser | null;
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
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
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
