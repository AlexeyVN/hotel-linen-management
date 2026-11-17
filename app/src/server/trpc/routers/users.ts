import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { permissionProcedure, router } from "../trpc";

const roleCodeSchema = z.enum(["ADMIN", "MANAGER", "MAID"]);

const passwordSchema = z
  .string()
  .min(8, "Пароль не короче 8 символов")
  .max(100);

const loginSchema = z
  .string()
  .min(4)
  .max(32)
  .regex(/^[a-z0-9._-]+$/, "Логин: латиница, цифры, точка, дефис, подчёркивание");

export const usersRouter = router({
  list: permissionProcedure("users.manage").query(async () => {
    const users = await prisma.user.findMany({
      include: {
        role: true,
        rooms: { include: { room: true }, orderBy: { room: { number: "asc" } } },
      },
      orderBy: { login: "asc" },
    });
    return users.map((user) => ({
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      roleCode: user.role.code,
      roleName: user.role.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      roomIds: user.rooms.map((row) => row.roomId),
      roomNumbers: user.rooms.map((row) => row.room.number),
    }));
  }),

  create: permissionProcedure("users.manage")
    .input(
      z.object({
        login: loginSchema,
        password: passwordSchema,
        fullName: z.string().min(2).max(120),
        roleCode: roleCodeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const role = await prisma.role.findUnique({ where: { code: input.roleCode } });
      if (!role) throw new TRPCError({ code: "BAD_REQUEST", message: "Роль не найдена" });

      const passwordHash = await bcrypt.hash(input.password, 12);
      try {
        const user = await prisma.user.create({
          data: {
            login: input.login.toLowerCase(),
            passwordHash,
            fullName: input.fullName,
            roleId: role.id,
          },
          select: { id: true },
        });
        logger.info({ login: input.login, role: input.roleCode }, "создан пользователь");
        return user;
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Пользователь с таким логином уже есть" });
        }
        throw error;
      }
    }),

  updateProfile: permissionProcedure("users.manage")
    .input(
      z
        .object({
          userId: z.string().min(1),
          login: loginSchema.optional(),
          fullName: z.string().trim().min(2, "ФИО: минимум 2 символа").max(120).optional(),
        })
        .refine((input) => input.login !== undefined || input.fullName !== undefined, {
          message: "Нужно передать логин или ФИО",
        }),
    )
    .mutation(async ({ input }) => {
      try {
        const user = await prisma.user.update({
          where: { id: input.userId },
          data: {
            ...(input.login !== undefined ? { login: input.login.toLowerCase() } : {}),
            ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          },
          select: { id: true, login: true, fullName: true },
        });
        logger.info(
          { userId: user.id, login: user.login, fullName: user.fullName },
          "профиль пользователя обновлён",
        );
        return { ok: true, user };
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Пользователь с таким логином уже есть" });
        }
        throw error;
      }
    }),

  updateRole: permissionProcedure("roles.manage")
    .input(z.object({ userId: z.string().min(1), roleCode: roleCodeSchema }))
    .mutation(async ({ input }) => {
      const role = await prisma.role.findUnique({ where: { code: input.roleCode } });
      if (!role) throw new TRPCError({ code: "BAD_REQUEST", message: "Роль не найдена" });
      await prisma.user.update({
        where: { id: input.userId },
        data: { roleId: role.id },
      });
      return { ok: true };
    }),

  setActive: permissionProcedure("users.manage")
    .input(z.object({ userId: z.string().min(1), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && !input.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Нельзя деактивировать самого себя",
        });
      }
      await prisma.user.update({
        where: { id: input.userId },
        data: { isActive: input.isActive },
      });
      return { ok: true };
    }),

  setRooms: permissionProcedure("users.manage")
    .input(z.object({ userId: z.string().min(1), roomIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        include: { role: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      if (user.role.code !== "MAID") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Номера назначаются только горничным",
        });
      }
      const rooms = await prisma.room.findMany({
        where: { id: { in: input.roomIds } },
        select: { id: true },
      });
      if (rooms.length !== input.roomIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Некоторые номера не найдены" });
      }
      await prisma.$transaction([
        prisma.userRoom.deleteMany({ where: { userId: input.userId } }),
        prisma.userRoom.createMany({
          data: input.roomIds.map((roomId) => ({ userId: input.userId, roomId })),
        }),
      ]);
      return { ok: true };
    }),

  resetPassword: permissionProcedure("users.manage")
    .input(z.object({ userId: z.string().min(1), password: passwordSchema }))
    .mutation(async ({ input }) => {
      const passwordHash = await bcrypt.hash(input.password, 12);
      await prisma.user.update({
        where: { id: input.userId },
        data: { passwordHash, failedLogins: 0, lockedUntil: null },
      });
      return { ok: true };
    }),
});
