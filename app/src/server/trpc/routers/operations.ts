import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canAccessRoom } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  OperationValidationError,
  createOperation,
  type CreateOperationInput,
} from "@/server/services/operations";
import { permissionProcedure, router } from "../trpc";

const lineSchema = z.object({
  itemId: z.string().min(1),
  qty: z.number().int().positive(),
});

const commonFields = {
  comment: z.string().max(500).optional(),
  clientOpId: z.string().min(8).max(100).optional(),
  /** Дата документа YYYY-MM-DD; пусто — сегодня. */
  documentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .optional(),
};

function parseDocumentDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Ошибки домена превращаем в BAD_REQUEST с человеческим текстом, прочие — наверх. */
async function run(input: CreateOperationInput) {
  try {
    return await createOperation(input);
  } catch (error) {
    if (error instanceof OperationValidationError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
}

export const operationsRouter = router({
  /**
   * Позиции для раздачи горничной: узкий доступ вместо полного warehouse.read
   * (ТЗ §2 мобильная версия: выбор номера + количество).
   */
  distributableItems: permissionProcedure("distribution.create").query(async () => {
    const items = await prisma.item.findMany({
      where: { isActive: true },
      include: { warehouse: true },
      orderBy: { name: "asc" },
    });
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      warehouseQty: item.warehouse?.qty ?? 0,
    }));
  }),

  receive: permissionProcedure("warehouse.receive")
    .input(z.object({ items: z.array(lineSchema).min(1), ...commonFields }))
    .mutation(({ ctx, input }) =>
      run({
        type: "RECEIVE",
        userId: ctx.user.id,
        items: input.items,
        comment: input.comment,
        clientOpId: input.clientOpId,
        documentDate: parseDocumentDate(input.documentDate),
      }),
    ),

  distribute: permissionProcedure("distribution.create")
    .input(z.object({ roomId: z.string().min(1), items: z.array(lineSchema).min(1), ...commonFields }))
    .mutation(({ ctx, input }) => {
      if (!canAccessRoom(ctx.user, input.roomId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Номер не назначен этой горничной" });
      }
      return run({
        type: "DISTRIBUTE",
        userId: ctx.user.id,
        roomId: input.roomId,
        items: input.items,
        comment: input.comment,
        clientOpId: input.clientOpId,
        documentDate: parseDocumentDate(input.documentDate),
      });
    }),

  returnToWarehouse: permissionProcedure("return.create")
    .input(z.object({ roomId: z.string().min(1), items: z.array(lineSchema).min(1), ...commonFields }))
    .mutation(({ ctx, input }) => {
      if (!canAccessRoom(ctx.user, input.roomId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Номер не назначен этой горничной" });
      }
      return run({
        type: "RETURN",
        userId: ctx.user.id,
        roomId: input.roomId,
        items: input.items,
        comment: input.comment,
        clientOpId: input.clientOpId,
        documentDate: parseDocumentDate(input.documentDate),
      });
    }),

  writeOff: permissionProcedure("writeoff.create")
    .input(
      z
        .object({
          location: z.enum(["WAREHOUSE", "ROOM"]),
          roomId: z.string().optional(),
          reasonCode: z.string().optional(),
          reasonText: z.string().max(200).optional(),
          items: z.array(lineSchema).min(1),
          ...commonFields,
        })
        .refine(
          (data) => Boolean(data.reasonCode) || (data.reasonText ?? "").trim().length > 0,
          { message: "Причина списания обязательна" },
        )
        .refine((data) => data.location !== "ROOM" || Boolean(data.roomId), {
          message: "Для списания из номера выберите номер",
        }),
    )
    .mutation(({ ctx, input }) =>
      run({
        type: "WRITE_OFF",
        userId: ctx.user.id,
        location: input.location,
        roomId: input.location === "ROOM" ? input.roomId : null,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        items: input.items,
        comment: input.comment,
        clientOpId: input.clientOpId,
        documentDate: parseDocumentDate(input.documentDate),
      }),
    ),
});
