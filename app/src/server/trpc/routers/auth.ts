import { PERMISSIONS } from "@/lib/rbac";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    login: ctx.user.login,
    fullName: ctx.user.fullName,
    roleCode: ctx.user.roleCode,
    roleName: ctx.user.roleName,
    permissions: ctx.user.permissions,
    roomIds: ctx.user.roomIds,
  })),

  permissions: publicProcedure.query(() => PERMISSIONS),
});
