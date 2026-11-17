import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getRoomStatusConfig,
  integrationStatus,
  regenerateRoomStatusToken,
  saveIntegrationConfig,
  saveRoomStatusConfig,
  type RoomStatusMethod,
} from "@/server/erp/config";
import { buildAdapter, pushPending, syncItems } from "@/server/erp/sync";
import { pushRoomStatuses, roomStatusStats } from "@/server/erp/room-status";
import { ensureWorkerStarted } from "@/server/erp/worker";
import { permissionProcedure, router } from "../trpc";

function asBadRequest(error: unknown): never {
  const message = error instanceof Error ? error.message : "Ошибка интеграции";
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const integrationRouter = router({
  status: permissionProcedure("settings.integration").query(async () => {
    // Воркер взводится при первом открытии раздела «1С» после перезапуска сервера.
    ensureWorkerStarted();
    return integrationStatus();
  }),

  save: permissionProcedure("settings.integration")
    .input(
      z.object({
        enabled: z.boolean(),
        mode: z.enum(["stub", "onec"]),
        baseUrl: z.string().max(500).optional(),
        login: z.string().max(200).optional(),
        password: z.string().max(200).optional(),
        syncIntervalMinutes: z.number().int().min(1).max(1440),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.enabled && input.mode === "onec" && !input.baseUrl?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Для режима 1С укажите URL HTTP-сервиса",
        });
      }
      await saveIntegrationConfig(input);
      return integrationStatus();
    }),

  ping: permissionProcedure("settings.integration").mutation(async () => {
    try {
      const adapter = await buildAdapter();
      if (!adapter) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Интеграция выключена" });
      }
      return await adapter.ping();
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      return asBadRequest(error);
    }
  }),

  syncItemsNow: permissionProcedure("settings.integration").mutation(async () => {
    try {
      return await syncItems();
    } catch (error) {
      return asBadRequest(error);
    }
  }),

  pushNow: permissionProcedure("settings.integration").mutation(async () => {
    try {
      return await pushPending();
    } catch (error) {
      return asBadRequest(error);
    }
  }),

  roomStatusConfig: permissionProcedure("settings.integration").query(async () => {
    const config = await getRoomStatusConfig();
    const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
    return {
      enabled: config.enabled,
      path: config.path,
      method: config.method,
      tokenSet: config.tokenSet,
      webhookUrl: `${base}/api/integrations/1c/room-status`,
      stats: await roomStatusStats(),
    };
  }),

  saveRoomStatusConfig: permissionProcedure("settings.integration")
    .input(
      z.object({
        enabled: z.boolean(),
        path: z.string().min(1).max(300),
        method: z.enum(["POST", "PUT"]),
      }),
    )
    .mutation(async ({ input }) => {
      const path = input.path.trim();
      if (!path.startsWith("/") || /\s/.test(path)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Путь должен начинаться с / и не содержать пробелов",
        });
      }
      await saveRoomStatusConfig({
        enabled: input.enabled,
        path,
        method: input.method as RoomStatusMethod,
      });
      return { ok: true };
    }),

  generateRoomStatusToken: permissionProcedure("settings.integration").mutation(async () => {
    const token = await regenerateRoomStatusToken();
    return { token };
  }),

  pushRoomStatusesNow: permissionProcedure("settings.integration").mutation(async () => {
    try {
      return await pushRoomStatuses();
    } catch (error) {
      return asBadRequest(error);
    }
  }),
});
