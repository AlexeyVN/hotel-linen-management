import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parseQrPayload } from "@/lib/domain/qr";
import { prisma } from "@/lib/prisma";
import { generateQr, getObjectCode, isQrStale, fileExists } from "@/server/services/qr";
import { permissionProcedure, router } from "../trpc";

const objectTypeSchema = z.enum(["room", "item"]);
const payloadFormatSchema = z.enum(["url", "json", "text"]);
const imageFormatSchema = z.enum(["png", "svg"]);

function currentBaseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
}

export const qrRouter = router({
  generate: permissionProcedure("rooms.read")
    .input(
      z.object({
        objectType: objectTypeSchema,
        id: z.string().min(1),
        payloadFormat: payloadFormatSchema,
        imageFormat: imageFormatSchema,
        size: z.number().int().min(128).max(1024).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const generated = await generateQr(input);
        return {
          id: generated.record.id,
          payload: generated.payload,
          dataUrl: generated.dataUrl,
          imageUrl: `/api/qr/${generated.record.id}`,
          payloadFormat: generated.record.payloadFormat,
          imageFormat: generated.record.imageFormat,
          code: generated.record.code,
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Не удалось сгенерировать QR",
        });
      }
    }),

  status: permissionProcedure("rooms.read")
    .input(z.object({ objectType: objectTypeSchema, id: z.string().min(1) }))
    .query(async ({ input }) => {
      const code = await getObjectCode(input.objectType, input.id);
      if (!code) return null;
      const record = await prisma.qrCode.findFirst({
        where: input.objectType === "room" ? { roomId: input.id } : { itemId: input.id },
      });
      if (!record) return null;
      return {
        id: record.id,
        code: record.code,
        payload: record.payload,
        payloadFormat: record.payloadFormat,
        imageFormat: record.imageFormat,
        createdAt: record.createdAt,
        imageUrl: `/api/qr/${record.id}`,
        stale:
          isQrStale(record, code, currentBaseUrl()) ||
          !(await fileExists(record.fileName)),
      };
    }),

  /** Проверка отсканированного кода любого поддерживаемого формата. */
  resolve: permissionProcedure("rooms.read")
    .input(z.object({ payload: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const parsed = parseQrPayload(input.payload);
      if (!parsed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Код не распознан" });
      }

      const findRoom = () =>
        prisma.room.findFirst({
          where: { OR: [{ id: parsed.code }, { number: parsed.code }] },
          select: { id: true, number: true, roomType: { select: { name: true } } },
        });

      const findItem = () =>
        prisma.item.findFirst({
          where: {
            OR: [{ id: parsed.code }, { externalId: parsed.code }, { name: parsed.code }],
          },
          select: { id: true, name: true, unit: true },
        });

      if (parsed.declaredType === "room") {
        const room = await findRoom();
        if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Номер не найден" });
        return {
          type: "room" as const,
          id: room.id,
          label: `Номер ${room.number} · ${room.roomType.name}`,
          roomId: room.id,
          itemId: null,
        };
      }

      if (parsed.declaredType === "item") {
        const item = await findItem();
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Позиция не найдена" });
        return {
          type: "item" as const,
          id: item.id,
          label: `${item.name} (${item.unit})`,
          roomId: null,
          itemId: item.id,
        };
      }

      // Тип не заявлен: сначала номер, затем позиция.
      const room = await findRoom();
      if (room) {
        return {
          type: "room" as const,
          id: room.id,
          label: `Номер ${room.number} · ${room.roomType.name}`,
          roomId: room.id,
          itemId: null,
        };
      }
      const item = await findItem();
      if (item) {
        return {
          type: "item" as const,
          id: item.id,
          label: `${item.name} (${item.unit})`,
          roomId: null,
          itemId: item.id,
        };
      }
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Код не соответствует ни номеру, ни позиции",
      });
    }),
});
