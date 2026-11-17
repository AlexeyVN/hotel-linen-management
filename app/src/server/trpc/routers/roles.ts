import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, type PermissionCode } from "@/lib/rbac";
import { permissionProcedure, router } from "../trpc";

const permissionSchema = z.enum(PERMISSIONS);
const MANDATORY_FOR_ADMIN: PermissionCode[] = ["users.manage", "roles.manage"];

export const rolesRouter = router({
  list: permissionProcedure("roles.manage").query(async () => {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { code: "asc" },
    });
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      permissionCodes: role.permissions.map((row) => row.permission.code),
    }));
  }),

  updatePermissions: permissionProcedure("roles.manage")
    .input(
      z.object({
        roleId: z.string().min(1),
        permissionCodes: z.array(permissionSchema),
      }),
    )
    .mutation(async ({ input }) => {
      const role = await prisma.role.findUnique({ where: { id: input.roleId } });
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Роль не найдена" });

      const codes = new Set<string>(input.permissionCodes);
      if (role.code === "ADMIN") {
        // Защита от самоблокировки администратора.
        for (const mandatory of MANDATORY_FOR_ADMIN) codes.add(mandatory);
      }

      const permissions = await prisma.permission.findMany({
        where: { code: { in: [...codes] } },
        select: { id: true, code: true },
      });
      if (permissions.length !== codes.size) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Неизвестный код права" });
      }

      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
        prisma.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
        }),
      ]);
      return { ok: true };
    }),
});
