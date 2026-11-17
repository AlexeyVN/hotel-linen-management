import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ensureWorkerStarted, workerTick } from "@/server/erp/worker";

export const dynamic = "force-dynamic";

/**
 * Внешний триггер воркера 1С (Task Scheduler или мониторинг).
 * Доступ: токен INTEGRATION_WORKER_TOKEN (Bearer) либо сессия с settings.integration.
 * Заодно «взводит» таймер воркера после перезапуска сервера.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.INTEGRATION_WORKER_TOKEN;

  if (expected) {
    if (request.headers.get("authorization") !== `Bearer ${expected}`) {
      return Response.json({ error: "Неверный токен" }, { status: 403 });
    }
  } else {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "settings.integration")) {
      return Response.json({ error: "Требуется вход с правом settings.integration" }, { status: 403 });
    }
  }

  ensureWorkerStarted();
  await workerTick();
  return Response.json({ ok: true });
}
