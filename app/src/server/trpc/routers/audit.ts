import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canAccessRoom, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { summarizeAudit, summarizeAuditValue } from "@/lib/domain/audit";
import {
  OperationValidationError,
  createOperation,
} from "@/server/services/operations";
import { permissionProcedure, router } from "../trpc";

async function loadSession(sessionId: string) {
  const session = await prisma.auditSession.findUnique({
    where: { id: sessionId },
    include: {
      room: { select: { id: true, number: true } },
      user: { select: { fullName: true } },
      lines: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              unit: true,
              priceKopecks: true,
              warehouse: { select: { lastReceiptAt: true } },
            },
          },
        },
      },
      photos: { select: { id: true, mimeType: true, createdAt: true } },
    },
  });
  if (!session) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Инвентаризация не найдена" });
  }
  return session;
}

function assertAccess(user: SessionUser, session: { roomId: string }): void {
  if (!canAccessRoom(user, session.roomId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Этот номер не назначен горничной" });
  }
}

function assertDraft(session: { status: string }): void {
  if (session.status !== "DRAFT") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Инвентаризация уже проведена — правки запрещены",
    });
  }
}

async function currentRoomQty(roomId: string): Promise<Map<string, number>> {
  const rows = await prisma.roomInventory.findMany({ where: { roomId } });
  return new Map(rows.map((row) => [row.itemId, row.qty]));
}

export const auditRouter = router({
  /** Черновик создаётся на все активные позиции; повтор для той же комнаты не плодит дубли. */
  start: permissionProcedure("audit.create")
    .input(z.object({ roomId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!canAccessRoom(ctx.user, input.roomId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Номер не назначен этой горничной" });
      }
      const room = await prisma.room.findUnique({ where: { id: input.roomId } });
      if (!room || !room.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Номер не найден или деактивирован" });
      }

      const existing = await prisma.auditSession.findFirst({
        where: { roomId: input.roomId, userId: ctx.user.id, status: "DRAFT" },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      if (existing) return { sessionId: existing.id, reused: true };

      const items = await prisma.item.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true },
      });
      const qty = await currentRoomQty(input.roomId);

      const session = await prisma.auditSession.create({
        data: {
          roomId: input.roomId,
          userId: ctx.user.id,
          lines: {
            create: items.map((item) => ({
              itemId: item.id,
              expectedQty: qty.get(item.id) ?? 0,
              factQty: qty.get(item.id) ?? 0,
            })),
          },
        },
        select: { id: true },
      });
      return { sessionId: session.id, reused: false };
    }),

  get: permissionProcedure("audit.create")
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const session = await loadSession(input.sessionId);
      assertAccess(ctx.user, session);

      // Черновик мог быть начат до движения остатков: обновляем учёт при открытии.
      if (session.status === "DRAFT") {
        const qty = await currentRoomQty(session.roomId);
        await prisma.$transaction(
          session.lines.map((line) => {
            const expectedQty = qty.get(line.itemId) ?? 0;
            line.expectedQty = expectedQty;
            return prisma.auditLine.update({
              where: {
                auditSessionId_itemId: { auditSessionId: session.id, itemId: line.itemId },
              },
              data: { expectedQty },
            });
          }),
        );
      }

      return {
        id: session.id,
        roomId: session.roomId,
        roomNumber: session.room.number,
        status: session.status,
        startedAt: session.startedAt,
        appliedAt: session.appliedAt,
        operationId: session.operationId,
        userFullName: session.user.fullName,
        lines: session.lines
          .map((line) => ({
            itemId: line.itemId,
            itemName: line.item.name,
            unit: line.item.unit,
            expectedQty: line.expectedQty,
            factQty: line.factQty,
            delta: line.factQty - line.expectedQty,
            priceKopecks: line.item.priceKopecks,
            lastReceiptAt: line.item.warehouse?.lastReceiptAt ?? null,
          }))
          .sort((a, b) => a.itemName.localeCompare(b.itemName, "ru")),
        photos: session.photos,
      };
    }),

  list: permissionProcedure("audit.create")
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const roomFilter =
        ctx.user.roleCode === "MAID" ? { roomId: { in: ctx.user.roomIds } } : {};
      const sessions = await prisma.auditSession.findMany({
        where: roomFilter,
        include: {
          room: { select: { number: true } },
          user: { select: { fullName: true } },
          _count: { select: { lines: true, photos: true } },
        },
        orderBy: { startedAt: "desc" },
        take: input?.limit ?? 20,
      });
      return sessions.map((session) => ({
        id: session.id,
        roomId: session.roomId,
        roomNumber: session.room.number,
        status: session.status,
        startedAt: session.startedAt,
        appliedAt: session.appliedAt,
        userFullName: session.user.fullName,
        photos: session._count.photos,
      }));
    }),

  saveDraft: permissionProcedure("audit.create")
    .input(
      z.object({
        sessionId: z.string().min(1),
        lines: z
          .array(z.object({ itemId: z.string().min(1), factQty: z.number().int().min(0) }))
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await loadSession(input.sessionId);
      assertAccess(ctx.user, session);
      assertDraft(session);

      const sessionItemIds = new Set(session.lines.map((line) => line.itemId));
      for (const line of input.lines) {
        if (!sessionItemIds.has(line.itemId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Позиция не относится к этой инвентаризации",
          });
        }
      }

      // Учётное количество обновляется перед сохранением: черновик показывает актуальный учёт.
      const qty = await currentRoomQty(session.roomId);
      await prisma.$transaction(
        input.lines.map((line) =>
          prisma.auditLine.update({
            where: { auditSessionId_itemId: { auditSessionId: session.id, itemId: line.itemId } },
            data: { expectedQty: qty.get(line.itemId) ?? 0, factQty: line.factQty },
          }),
        ),
      );
      return { ok: true, saved: input.lines.length };
    }),

  applyAudit: permissionProcedure("audit.create")
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = await loadSession(input.sessionId);
      assertAccess(ctx.user, session);
      assertDraft(session);

      const qty = await currentRoomQty(session.roomId);
      const auditItems = session.lines.map((line) => ({
        itemId: line.itemId,
        expectedQty: qty.get(line.itemId) ?? 0,
        factQty: line.factQty,
      }));

      try {
        const result = await createOperation({
          type: "AUDIT",
          userId: ctx.user.id,
          roomId: session.roomId,
          auditItems,
          clientOpId: `audit-${session.id}`,
        });
        await prisma.auditSession.update({
          where: { id: session.id },
          data: { status: "APPLIED", appliedAt: new Date(), operationId: result.operationId },
        });
        const summary = summarizeAudit(auditItems);
        const valueSummary = summarizeAuditValue(
          session.lines.map((line) => ({
            itemId: line.itemId,
            expectedQty: line.expectedQty,
            factQty: line.factQty,
            priceKopecks: line.item.priceKopecks,
          })),
        );
        return {
          operationId: result.operationId,
          idempotent: result.idempotent,
          summary: { ...summary, ...valueSummary },
        };
      } catch (error) {
        if (error instanceof OperationValidationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
});
