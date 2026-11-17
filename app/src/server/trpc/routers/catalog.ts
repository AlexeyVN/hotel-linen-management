import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { removeQrFile } from "@/lib/qr-storage";
import { permissionProcedure, router } from "../trpc";

const priceSchema = z.number().int().min(0).max(1_000_000_000_00);

const itemInput = z.object({
  name: z.string().min(1).max(120),
  categoryId: z.string().min(1),
  unit: z.string().min(1).max(20),
  priceKopecks: priceSchema,
  note: z.string().max(300).nullable().optional(),
});

/** Справочник позиций: цена, примечание, остаток; удаление только без истории. */
export const catalogRouter = router({
  list: permissionProcedure("warehouse.read").query(async () => {
    const items = await prisma.item.findMany({
      include: { category: true, warehouse: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      unit: item.unit,
      priceKopecks: item.priceKopecks,
      note: item.note,
      isActive: item.isActive,
      warehouseQty: item.warehouse?.qty ?? 0,
      lastReceiptAt: item.warehouse?.lastReceiptAt ?? null,
    }));
  }),

  create: permissionProcedure("catalog.manage")
    .input(itemInput)
    .mutation(async ({ input }) => {
      const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!category) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Категория не найдена" });
      }
      const item = await prisma.item.create({
        data: {
          name: input.name.trim(),
          categoryId: input.categoryId,
          unit: input.unit.trim(),
          priceKopecks: input.priceKopecks,
          note: input.note ?? null,
        },
        select: { id: true },
      });
      return { id: item.id };
    }),

  update: permissionProcedure("catalog.manage")
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(120).optional(),
        categoryId: z.string().min(1).optional(),
        unit: z.string().min(1).max(20).optional(),
        priceKopecks: priceSchema.optional(),
        note: z.string().max(300).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.item.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Позиция не найдена" });
      if (input.categoryId) {
        const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
        if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "Категория не найдена" });
      }
      await prisma.item.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.unit ? { unit: input.unit.trim() } : {}),
          ...(input.priceKopecks !== undefined ? { priceKopecks: input.priceKopecks } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      return { ok: true };
    }),

  delete: permissionProcedure("catalog.manage")
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const item = await prisma.item.findUnique({
        where: { id: input.id },
        include: {
          warehouse: true,
          _count: {
            select: { operationItems: true, roomInventories: true, auditLines: true },
          },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Позиция не найдена" });

      const history =
        (item.warehouse?.qty ?? 0) > 0
          ? "остаток на складе"
          : item._count.operationItems > 0
            ? "операции"
            : item._count.roomInventories > 0
              ? "остатки в номерах"
              : item._count.auditLines > 0
                ? "инвентаризации"
                : null;
      if (history) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Удалить нельзя: есть ${history}. Деактивируйте позицию.`,
        });
      }

      const qr = await prisma.qrCode.findFirst({
        where: { itemId: input.id },
        select: { fileName: true },
      });
      await prisma.item.delete({ where: { id: input.id } });
      await removeQrFile(qr?.fileName);
      return { ok: true };
    }),
});
