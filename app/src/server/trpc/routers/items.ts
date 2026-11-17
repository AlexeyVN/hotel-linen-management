import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { permissionProcedure, router } from "../trpc";

export const itemsRouter = router({
  list: permissionProcedure("warehouse.read")
    .input(z.object({ categoryId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const items = await prisma.item.findMany({
        where: {
          isActive: true,
          ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
        },
        include: { category: true, warehouse: true },
        orderBy: [{ name: "asc" }],
      });
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        categoryId: item.categoryId,
        categoryCode: item.category.code,
        categoryName: item.category.name,
        warehouseQty: item.warehouse?.qty ?? 0,
        priceKopecks: item.priceKopecks,
        note: item.note,
        lastReceiptAt: item.warehouse?.lastReceiptAt ?? null,
      }));
    }),

  categories: permissionProcedure("warehouse.read").query(async () => {
    return prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });
  }),

  /** Справочник причин списания — доступен только тому, кто вправе списывать. */
  writeOffReasons: permissionProcedure("writeoff.create").query(async () => {
    return prisma.writeOffReason.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    });
  }),
});
