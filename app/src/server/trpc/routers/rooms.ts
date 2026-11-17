import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { removeQrFile } from "@/lib/qr-storage";
import { permissionProcedure, router } from "../trpc";

const listInput = z
  .object({
    floor: z.number().int().positive().optional(),
    floorName: z.string().min(1).max(40).optional(),
    roomTypeId: z.string().min(1).optional(),
  })
  .optional();

const typeCodeSchema = z
  .string()
  .min(2)
  .max(20)
  .regex(/^[A-Z0-9_]+$/, "Код типа: заглавные латинские буквы, цифры, подчёркивание");

const floorNumberSchema = z.number().int().min(1).max(99);
const floorNameSchema = z.string().trim().min(1).max(40);

function floorLabel(room: { floor: number | null; floorName: string | null }): string {
  return room.floorName ?? (room.floor === null ? "—" : String(room.floor));
}

function compareFloor(a: string, b: string): number {
  const an = /^\d+$/.test(a) ? Number(a) : NaN;
  const bn = /^\d+$/.test(b) ? Number(b) : NaN;
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  if (Number.isFinite(an)) return -1;
  if (Number.isFinite(bn)) return 1;
  return a.localeCompare(b, "ru");
}

function customTypeCode(): string {
  return `CUSTOM_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
    .toUpperCase()
    .slice(0, 20);
}

async function resolveRoomType(input: {
  roomTypeId?: string;
  newTypeName?: string;
}): Promise<string> {
  if (input.roomTypeId && input.newTypeName) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Укажите существующий тип или новое название, но не оба",
    });
  }
  if (input.newTypeName) {
    const name = input.newTypeName.trim();
    const existing = await prisma.roomType.findFirst({ where: { name, isActive: true } });
    if (existing) return existing.id;
    const created = await prisma.roomType.create({
      data: { code: customTypeCode(), name },
      select: { id: true },
    });
    return created.id;
  }
  if (!input.roomTypeId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Выберите тип комнаты" });
  }
  const type = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!type || !type.isActive) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Тип комнаты не найден или деактивирован" });
  }
  return type.id;
}

const numberSchema = z
  .string()
  .min(1)
  .max(10)
  .regex(/^[0-9A-Za-zА-Яа-я-]+$/, "Номер: цифры, буквы или дефис");

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export const roomsRouter = router({
  list: permissionProcedure("rooms.read")
    .input(listInput)
    .query(async ({ ctx, input }) => {
      // Горничная видит только назначенные номера (ТЗ §6.2).
      const roomFilter =
        ctx.user.roleCode === "MAID" ? { id: { in: ctx.user.roomIds } } : {};

      const rooms = await prisma.room.findMany({
        where: {
          isActive: true,
          ...roomFilter,
          ...(input?.floor ? { floor: input.floor } : {}),
          ...(input?.floorName ? { floorName: input.floorName } : {}),
          ...(input?.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
        },
        include: { roomType: true },
        orderBy: [{ floor: "asc" }, { floorName: "asc" }, { number: "asc" }],
      });

      return rooms.map((room) => ({
        id: room.id,
        number: room.number,
        floor: room.floor,
        floorName: room.floorName,
        floorLabel: floorLabel(room),
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomType.name,
      }));
    }),

  types: permissionProcedure("rooms.read").query(async () => {
    return prisma.roomType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });
  }),

  floors: permissionProcedure("rooms.read").query(async () => {
    const rows = await prisma.room.findMany({
      where: { isActive: true },
      select: { floor: true, floorName: true },
    });
    return [...new Set(rows.map(floorLabel))].sort(compareFloor);
  }),

  /** Полный список для администрирования (включая деактивированные). */
  all: permissionProcedure("rooms.read").query(async () => {
    const rooms = await prisma.room.findMany({
      include: { roomType: true },
      orderBy: [{ floor: "asc" }, { floorName: "asc" }, { number: "asc" }],
    });
    return rooms.map((room) => ({
      id: room.id,
      number: room.number,
      floor: room.floor,
      floorName: room.floorName,
      floorLabel: floorLabel(room),
      roomTypeId: room.roomTypeId,
      roomTypeName: room.roomType.name,
      isActive: room.isActive,
    }));
  }),

  allTypes: permissionProcedure("rooms.read").query(async () => {
    return prisma.roomType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, isActive: true },
    });
  }),

  createType: permissionProcedure("rooms.manage")
    .input(z.object({ code: typeCodeSchema, name: z.string().min(2).max(60) }))
    .mutation(async ({ input }) => {
      try {
        return await prisma.roomType.create({
          data: { code: input.code.toUpperCase(), name: input.name },
          select: { id: true },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: "CONFLICT", message: "Тип с таким кодом уже есть" });
        }
        throw error;
      }
    }),

  updateType: permissionProcedure("rooms.manage")
    .input(z.object({ id: z.string().min(1), name: z.string().min(2).max(60) }))
    .mutation(async ({ input }) => {
      await prisma.roomType.update({ where: { id: input.id }, data: { name: input.name } });
      return { ok: true };
    }),

  setTypeActive: permissionProcedure("rooms.manage")
    .input(z.object({ id: z.string().min(1), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      if (!input.isActive) {
        const activeRooms = await prisma.room.count({
          where: { roomTypeId: input.id, isActive: true },
        });
        if (activeRooms > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `В типе ${activeRooms} активных номеров — сначала деактивируйте их`,
          });
        }
      }
      await prisma.roomType.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      return { ok: true };
    }),

  createRoom: permissionProcedure("rooms.manage")
    .input(
      z
        .object({
          number: numberSchema,
          floor: floorNumberSchema.optional(),
          floorName: floorNameSchema.optional(),
          roomTypeId: z.string().min(1).optional(),
          newTypeName: z.string().trim().min(2).max(60).optional(),
        })
        .superRefine((input, ctx) => {
          if ((input.floor === undefined) === (input.floorName === undefined)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Укажите число или название этажа" });
          }
          if ((input.roomTypeId === undefined) === (input.newTypeName === undefined)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Выберите тип или укажите новый" });
          }
        }),
    )
    .mutation(async ({ input }) => {
      const roomTypeId = await resolveRoomType(input);
      try {
        return await prisma.room.create({
          data: {
            number: input.number.trim(),
            floor: input.floor ?? null,
            floorName: input.floorName ?? null,
            roomTypeId,
          },
          select: { id: true },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: "CONFLICT", message: "Номер с таким значением уже есть" });
        }
        throw error;
      }
    }),

  updateRoom: permissionProcedure("rooms.manage")
    .input(
      z
        .object({
          id: z.string().min(1),
          number: numberSchema.optional(),
          floor: floorNumberSchema.nullable().optional(),
          floorName: floorNameSchema.nullable().optional(),
          roomTypeId: z.string().min(1).optional(),
          newTypeName: z.string().trim().min(2).max(60).optional(),
        })
        .superRefine((input, ctx) => {
          if (input.floor !== undefined && input.floorName !== undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Этаж задаётся числом или названием" });
          }
          if (input.roomTypeId && input.newTypeName) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Тип задаётся одним способом" });
          }
        }),
    )
    .mutation(async ({ input }) => {
      const roomTypeId =
        input.roomTypeId || input.newTypeName
          ? await resolveRoomType({ roomTypeId: input.roomTypeId, newTypeName: input.newTypeName })
          : undefined;
      try {
        await prisma.room.update({
          where: { id: input.id },
          data: {
            ...(input.number ? { number: input.number.trim() } : {}),
            ...(input.floor !== undefined ? { floor: input.floor, floorName: null } : {}),
            ...(input.floorName !== undefined ? { floor: null, floorName: input.floorName } : {}),
            ...(roomTypeId ? { roomTypeId } : {}),
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: "CONFLICT", message: "Номер с таким значением уже есть" });
        }
        throw error;
      }
      return { ok: true };
    }),

  deleteRoom: permissionProcedure("rooms.manage")
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const room = await prisma.room.findUnique({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              inventories: true,
              operations: true,
              auditSessions: true,
              cleaningTasks: true,
            },
          },
        },
      });
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Номер не найден" });

      const hasHistory =
        room._count.inventories > 0 ||
        room._count.operations > 0 ||
        room._count.auditSessions > 0 ||
        room._count.cleaningTasks > 0;
      if (hasHistory) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "У номера есть история (остатки, операции, инвентаризации или задачи уборки). " +
            "Удаление невозможно — деактивируйте номер.",
        });
      }

      const qr = await prisma.qrCode.findFirst({
        where: { roomId: input.id },
        select: { fileName: true },
      });
      await prisma.room.delete({ where: { id: input.id } });
      await removeQrFile(qr?.fileName);
      return { ok: true };
    }),

  setRoomActive: permissionProcedure("rooms.manage")
    .input(z.object({ id: z.string().min(1), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await prisma.room.update({ where: { id: input.id }, data: { isActive: input.isActive } });
      return { ok: true };
    }),
});
