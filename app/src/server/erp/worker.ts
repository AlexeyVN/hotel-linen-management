/**
 * Фоновый воркер интеграции: раз в минуту досылает очередь и обновляет
 * номенклатуру по интервалу из настроек. При выключенной интеграции — no-op.
 * Запускается из instrumentation.ts одного процесса Node (single-node ТЗ §10.3).
 */
import { logger } from "@/lib/logger";
import { getIntegrationConfig, getRoomStatusConfig, recordSyncError } from "./config";
import { pushPending, syncItems } from "./sync";
import { pushRoomStatuses } from "./room-status";

let timer: NodeJS.Timeout | null = null;
const globalRef = globalThis as { __erpWorkerStarted?: boolean };

export function startErpWorker(intervalMs = 60_000): void {
  if (timer) return;
  timer = setInterval(() => {
    void workerTick();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "1С-воркер запущен");
}

/** Ленивый запуск: процесс Node, а не edge-сборка (instrumentation не используем). */
export function ensureWorkerStarted(intervalMs = 60_000): void {
  if (globalRef.__erpWorkerStarted) return;
  globalRef.__erpWorkerStarted = true;
  startErpWorker(intervalMs);
}

export function stopErpWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function workerTick(): Promise<void> {
  try {
    const config = await getIntegrationConfig();
    if (!config.enabled) return;

    await pushPending(10);

    const roomStatus = await getRoomStatusConfig();
    if (roomStatus.enabled) await pushRoomStatuses(10);

    const lastSync = config.lastSyncAt ? new Date(config.lastSyncAt).getTime() : 0;
    if (Date.now() - lastSync >= config.syncIntervalMinutes * 60_000) {
      await syncItems();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка синхронизации с 1С";
    logger.error({ err: message }, "1С-воркер: ошибка");
    try {
      await recordSyncError(message);
    } catch {
      // Настройки недоступны — писать ошибку некуда.
    }
  }
}
