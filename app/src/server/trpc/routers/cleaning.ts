import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  canTransition,
  sortTasks,
  summarizeCleaning,
} from "@/lib/domain/cleaning";
import { maidWorkStatus, summarizeMaidPlan } from "@/lib/domain/maids";
import {
  CHECKLIST_ANSWERS,
  computeChecklistProgress,
} from "@/lib/domain/checklist";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { enqueueRoomStatus, localRoomStatusData, type RoomStatusValue } from "@/server/erp/room-status";
import { permissionProcedure, router } from "../trpc";

const typeSchema = z.enum(["DAILY", "ON_DEMAND", "GENERAL"]);
const prioritySchema = z.enum(["URGENT", "MEDIUM", "LOW"]);
const transitionSchema = z.enum(["IN_PROGRESS", "DONE", "CANCELLED"]);
const roomStatusSchema = z.enum(["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"]);
const listStatusSchema = z.enum(["NEW", "IN_PROGRESS", "DONE", "CANCELLED"]);

function roomFloorLabel(floor: number | null, floorName: string | null): string {
  return floorName ?? (floor === null ? "—" : String(floor));
}

async function queueRoomStatus(roomId: string, status: RoomStatusValue): Promise<void> {
  try {
    await enqueueRoomStatus(roomId, status);
  } catch (error) {
    logger.error({ error }, "не удалось поставить статус номера в очередь 1С");
  }
}

async function ensureMaid(assigneeId: string): Promise<void> {
  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    include: { role: true },
  });
  if (!assignee || !assignee.isActive || assignee.role.code !== "MAID") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Исполнителем может быть только активная горничная",
    });
  }
}

async function taskChecklistProgress(taskId: string, templateId: string | null) {
  if (!templateId) {
    return { total: 0, answered: 0, complete: true, missingPhotoIds: [] as string[] };
  }
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { select: { id: true, text: true, photoRequired: true } } },
  });
  const answers = await prisma.checklistAnswer.findMany({ where: { taskId } });
  return computeChecklistProgress(template?.items ?? [], answers);
}

export const cleaningRouter = router({
  /** Задачи текущей горничной: активные, выполненные или все (ТЗ v2.4–v2.5). */
  listMine: permissionProcedure("cleaning.execute")
    .input(z.object({ view: z.enum(["ACTIVE", "DONE", "ALL"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
    const view = input?.view ?? "ACTIVE";
    const tasks = await prisma.cleaningTask.findMany({
      where: {
        assigneeId: ctx.user.id,
        ...(view === "ACTIVE"
          ? { status: { in: ["NEW", "IN_PROGRESS"] } }
          : view === "DONE"
            ? { status: "DONE" }
            : {}),
      },
      include: {
        room: { select: { number: true, floor: true, floorName: true, cleaningStatus: true } },
        checklistTemplate: {
          include: { items: { select: { id: true, text: true, photoRequired: true } } },
        },
        answers: { select: { itemId: true, answer: true, photoFileName: true } },
      },
    });
    return sortTasks(tasks).map((task) => {
      const items = task.checklistTemplate?.items ?? [];
      const progress = computeChecklistProgress(items, task.answers);
      return {
        id: task.id,
        roomNumber: task.room.number,
        floor: task.room.floor,
        floorLabel: roomFloorLabel(task.room.floor, task.room.floorName),
        roomStatus: task.room.cleaningStatus,
        type: task.type,
        priority: task.priority,
        status: task.status,
        plannedMinutes: task.plannedMinutes,
        comment: task.comment,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        createdAt: task.createdAt,
        checklist: task.checklistTemplate
          ? {
              name: task.checklistTemplate.name,
              total: progress.total,
              answered: progress.answered,
              complete: progress.complete,
            }
          : null,
      };
    });
  }),

  list: permissionProcedure("cleaning.manage")
    .input(
      z
        .object({
          status: listStatusSchema.optional(),
          assigneeId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const tasks = await prisma.cleaningTask.findMany({
        where: {
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.assigneeId ? { assigneeId: input.assigneeId } : {}),
        },
        include: {
          room: { select: { number: true, floor: true, floorName: true, cleaningStatus: true } },
          assignee: { select: { fullName: true } },
          checklistTemplate: { select: { id: true, name: true } },
          answers: { select: { itemId: true, answer: true, photoFileName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return tasks.map((task) => ({
        id: task.id,
        roomNumber: task.room.number,
        floor: task.room.floor,
        floorLabel: roomFloorLabel(task.room.floor, task.room.floorName),
        roomStatus: task.room.cleaningStatus,
        type: task.type,
        priority: task.priority,
        status: task.status,
        assigneeId: task.assigneeId,
        assigneeName: task.assignee?.fullName ?? null,
        plannedMinutes: task.plannedMinutes,
        comment: task.comment,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        createdAt: task.createdAt,
        checklist: task.checklistTemplate
          ? {
              templateId: task.checklistTemplate.id,
              name: task.checklistTemplate.name,
              answered: task.answers.length,
            }
          : null,
      }));
    }),

  assignees: permissionProcedure("cleaning.manage").query(async () => {
    return prisma.user.findMany({
      where: { isActive: true, role: { code: "MAID" } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
  }),

  rooms: permissionProcedure("cleaning.manage").query(async () => {
    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      include: { roomType: { select: { name: true } } },
      orderBy: [{ floor: "asc" }, { floorName: "asc" }, { number: "asc" }],
    });
    return rooms.map((room) => ({
      id: room.id,
      number: room.number,
      floor: room.floor,
      floorLabel: roomFloorLabel(room.floor, room.floorName),
      roomTypeName: room.roomType.name,
      cleaningStatus: room.cleaningStatus,
    }));
  }),

  create: permissionProcedure("cleaning.manage")
    .input(
      z.object({
        roomId: z.string().min(1),
        type: typeSchema,
        priority: prioritySchema,
        assigneeId: z.string().min(1).optional(),
        plannedMinutes: z.number().int().min(5).max(600).optional(),
        comment: z.string().max(300).optional(),
        checklistTemplateId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await prisma.room.findUnique({ where: { id: input.roomId } });
      if (!room || !room.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Номер не найден или деактивирован" });
      }
      if (input.assigneeId) await ensureMaid(input.assigneeId);
      if (input.checklistTemplateId) {
        const template = await prisma.checklistTemplate.findUnique({
          where: { id: input.checklistTemplateId },
        });
        if (!template || !template.isActive) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Чек-лист не найден или выключен",
          });
        }
      }

      const task = await prisma.cleaningTask.create({
        data: {
          roomId: room.id,
          type: input.type,
          priority: input.priority,
          assigneeId: input.assigneeId ?? null,
          createdById: ctx.user.id,
          plannedMinutes: input.plannedMinutes ?? null,
          comment: input.comment ?? null,
          checklistTemplateId: input.checklistTemplateId ?? null,
        },
        select: { id: true },
      });

      if (room.cleaningStatus !== "OUT_OF_ORDER") {
        await prisma.room.update({
          where: { id: room.id },
          data: localRoomStatusData("DIRTY"),
        });
        await queueRoomStatus(room.id, "DIRTY");
      }
      return { id: task.id };
    }),

  assign: permissionProcedure("cleaning.manage")
    .input(z.object({ taskId: z.string().min(1), assigneeId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const task = await prisma.cleaningTask.findUnique({ where: { id: input.taskId } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      if (task.status !== "NEW") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Переназначить можно только новую задачу",
        });
      }
      if (input.assigneeId) await ensureMaid(input.assigneeId);
      await prisma.cleaningTask.update({
        where: { id: task.id },
        data: { assigneeId: input.assigneeId },
      });
      return { ok: true };
    }),

  /** Горничная двигает свою задачу; менеджер может отменить чужую. */
  setStatus: permissionProcedure("cleaning.execute")
    .input(z.object({ taskId: z.string().min(1), status: transitionSchema }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.cleaningTask.findUnique({
        where: { id: input.taskId },
        include: { room: { select: { cleaningStatus: true } } },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });

      const canManage = hasPermission(ctx.user, "cleaning.manage");
      if (!canManage && task.assigneeId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Задача назначена другой горничной" });
      }

      // Идемпотентность: повтор из офлайн-очереди не ломает состояние.
      if (task.status === input.status) return { ok: true, already: true };
      if (!canTransition(task.status, input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Переход ${task.status} → ${input.status} недопустим`,
        });
      }

      if (input.status === "DONE") {
        const progress = await taskChecklistProgress(task.id, task.checklistTemplateId);
        if (!progress.complete) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              `Чек-лист не завершён: отмечено ${progress.answered} из ${progress.total}` +
              (progress.missingPhotoIds.length > 0
                ? `, нет фото в пунктах: ${progress.missingPhotoIds.length}`
                : ""),
          });
        }
      }

      const now = new Date();
      const data: { status: string; startedAt?: Date; finishedAt?: Date } = {
        status: input.status,
      };
      if (input.status === "IN_PROGRESS" && !task.startedAt) data.startedAt = now;
      if (input.status === "DONE") {
        if (!task.startedAt) data.startedAt = now;
        data.finishedAt = now;
      }

      const previousRoomStatus = task.room.cleaningStatus;
      await prisma.$transaction(async (tx) => {
        await tx.cleaningTask.update({ where: { id: task.id }, data });
        if (previousRoomStatus !== "OUT_OF_ORDER") {
          if (input.status === "IN_PROGRESS") {
            await tx.room.update({
              where: { id: task.roomId },
              data: localRoomStatusData("DIRTY"),
            });
          }
          if (input.status === "DONE") {
            await tx.room.update({
              where: { id: task.roomId },
              data: localRoomStatusData("CLEAN"),
            });
          }
        }
      });

      if (previousRoomStatus !== "OUT_OF_ORDER" && input.status === "IN_PROGRESS") {
        await queueRoomStatus(task.roomId, "DIRTY");
      }
      if (previousRoomStatus !== "OUT_OF_ORDER" && input.status === "DONE") {
        await queueRoomStatus(task.roomId, "CLEAN");
      }

      return { ok: true, already: false };
    }),

  setRoomStatus: permissionProcedure("cleaning.manage")
    .input(z.object({ roomId: z.string().min(1), status: roomStatusSchema }))
    .mutation(async ({ input }) => {
      await prisma.room.update({
        where: { id: input.roomId },
        data: localRoomStatusData(input.status),
      });
      await queueRoomStatus(input.roomId, input.status);
      return { ok: true };
    }),

  /** Детали задачи для горничной: чек-лист, ответы, фото. */
  get: permissionProcedure("cleaning.execute")
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const task = await prisma.cleaningTask.findUnique({
        where: { id: input.taskId },
        include: {
          room: {
            select: {
              number: true,
              floor: true,
              floorName: true,
              cleaningStatus: true,
              roomType: { select: { name: true } },
            },
          },
          assignee: { select: { fullName: true } },
          checklistTemplate: { include: { items: { orderBy: { sortOrder: "asc" } } } },
          answers: { include: { answeredBy: { select: { fullName: true } } } },
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });

      const canManage = hasPermission(ctx.user, "cleaning.manage");
      if (!canManage && task.assigneeId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Задача назначена другой горничной" });
      }

      const items = task.checklistTemplate?.items ?? [];
      const answers = new Map(task.answers.map((answer) => [answer.itemId, answer]));
      const progress = computeChecklistProgress(items, task.answers);

      return {
        id: task.id,
        roomNumber: task.room.number,
        floor: task.room.floor,
        floorLabel: roomFloorLabel(task.room.floor, task.room.floorName),
        roomTypeName: task.room.roomType.name,
        roomStatus: task.room.cleaningStatus,
        type: task.type,
        priority: task.priority,
        status: task.status,
        plannedMinutes: task.plannedMinutes,
        comment: task.comment,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        createdAt: task.createdAt,
        assigneeName: task.assignee?.fullName ?? null,
        canManage,
        checklist: task.checklistTemplate
          ? {
              templateId: task.checklistTemplate.id,
              name: task.checklistTemplate.name,
              progress,
              items: items.map((item) => {
                const answer = answers.get(item.id);
                return {
                  id: item.id,
                  text: item.text,
                  photoRequired: item.photoRequired,
                  extraOptionText: item.extraOptionText,
                  answer: answer?.answer ?? null,
                  comment: answer?.comment ?? null,
                  answeredByName: answer?.answeredBy.fullName ?? null,
                  photoUrl: answer?.photoFileName
                    ? `/api/cleaning/answers/${answer.id}/photo`
                    : null,
                };
              }),
            }
          : null,
      };
    }),

  answer: permissionProcedure("cleaning.execute")
    .input(
      z.object({
        taskId: z.string().min(1),
        itemId: z.string().min(1),
        answer: z.enum(["YES", "NO", "EXTRA"]),
        comment: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.cleaningTask.findUnique({
        where: { id: input.taskId },
        include: {
          checklistTemplate: {
            include: { items: { select: { id: true, text: true, photoRequired: true } } },
          },
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });

      const canManage = hasPermission(ctx.user, "cleaning.manage");
      if (!canManage && task.assigneeId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Задача назначена другой горничной" });
      }
      if (task.status === "DONE" || task.status === "CANCELLED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Задача уже закрыта" });
      }

      const items = task.checklistTemplate?.items ?? [];
      if (!items.some((item) => item.id === input.itemId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Пункт не относится к чек-листу этой задачи",
        });
      }

      await prisma.checklistAnswer.upsert({
        where: { taskId_itemId: { taskId: task.id, itemId: input.itemId } },
        create: {
          taskId: task.id,
          itemId: input.itemId,
          answer: input.answer,
          comment: input.comment ?? null,
          answeredById: ctx.user.id,
        },
        update: {
          answer: input.answer,
          comment: input.comment ?? null,
          answeredById: ctx.user.id,
          answeredAt: new Date(),
        },
      });

      const answers = await prisma.checklistAnswer.findMany({ where: { taskId: task.id } });
      return { ok: true, progress: computeChecklistProgress(items, answers) };
    }),

  addComment: permissionProcedure("cleaning.execute")
    .input(z.object({ taskId: z.string().min(1), comment: z.string().max(300) }))
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.cleaningTask.findUnique({ where: { id: input.taskId } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      const canManage = hasPermission(ctx.user, "cleaning.manage");
      if (!canManage && task.assigneeId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Задача назначена другой горничной" });
      }
      await prisma.cleaningTask.update({
        where: { id: task.id },
        data: { comment: input.comment },
      });
      return { ok: true };
    }),

  /** Дашборд горничной: мои задачи и статусы назначенных номеров. */
  dashboard: permissionProcedure("cleaning.execute").query(async ({ ctx }) => {
    const [taskRows, userRooms] = await Promise.all([
      prisma.cleaningTask.findMany({
        where: { assigneeId: ctx.user.id },
        select: { status: true },
      }),
      prisma.userRoom.findMany({
        where: { userId: ctx.user.id },
        select: { roomId: true },
      }),
    ]);
    const roomIds = userRooms.map((row) => row.roomId);
    const rooms = roomIds.length
      ? await prisma.room.findMany({
          where: { id: { in: roomIds }, isActive: true },
          select: { cleaningStatus: true },
        })
      : [];

    const taskCounts = { new: 0, inProgress: 0, done: 0, cancelled: 0 };
    for (const task of taskRows) {
      if (task.status === "NEW") taskCounts.new += 1;
      else if (task.status === "IN_PROGRESS") taskCounts.inProgress += 1;
      else if (task.status === "DONE") taskCounts.done += 1;
      else taskCounts.cancelled += 1;
    }
    const roomCounts = { clean: 0, dirty: 0, inspected: 0, outOfOrder: 0 };
    for (const room of rooms) {
      if (room.cleaningStatus === "CLEAN") roomCounts.clean += 1;
      else if (room.cleaningStatus === "DIRTY") roomCounts.dirty += 1;
      else if (room.cleaningStatus === "INSPECTED") roomCounts.inspected += 1;
      else roomCounts.outOfOrder += 1;
    }
    return { tasks: taskCounts, rooms: roomCounts, myRooms: rooms.length };
  }),

  /** Мои номера (как вкладка «Номера» в TL Extranet). */
  myRooms: permissionProcedure("cleaning.execute").query(async ({ ctx }) => {
    const userRooms = await prisma.userRoom.findMany({
      where: { userId: ctx.user.id },
      select: { roomId: true },
    });
    const roomIds = userRooms.map((row) => row.roomId);
    if (roomIds.length === 0) return [];
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds }, isActive: true },
      include: {
        roomType: { select: { name: true } },
        cleaningTasks: {
          where: { status: { in: ["NEW", "IN_PROGRESS"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, type: true, priority: true, assigneeId: true },
        },
      },
      orderBy: [{ floor: "asc" }, { floorName: "asc" }, { number: "asc" }],
    });
    return rooms.map((room) => ({
      id: room.id,
      number: room.number,
      floor: room.floor,
      floorLabel: roomFloorLabel(room.floor, room.floorName),
      roomTypeName: room.roomType.name,
      cleaningStatus: room.cleaningStatus,
      activeTask: room.cleaningTasks[0]
        ? {
            id: room.cleaningTasks[0].id,
            status: room.cleaningTasks[0].status,
            type: room.cleaningTasks[0].type,
            priority: room.cleaningTasks[0].priority,
            mine: room.cleaningTasks[0].assigneeId === ctx.user.id,
          }
        : null,
    }));
  }),

  report: permissionProcedure("cleaning.manage")
    .input(z.object({ from: z.string().min(1), to: z.string().min(1) }))
    .query(async ({ input }) => {
      const from = new Date(`${input.from}T00:00:00`);
      const to = new Date(`${input.to}T23:59:59`);
      const tasks = await prisma.cleaningTask.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { assignee: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      });

      const groups = new Map<string, {
        assigneeName: string;
        tasks: Array<{ status: string; startedAt: Date | null; finishedAt: Date | null }>;
      }>();
      for (const task of tasks) {
        const key = task.assigneeId ?? "unassigned";
        const group = groups.get(key) ?? {
          assigneeName: task.assignee?.fullName ?? "Не назначено",
          tasks: [],
        };
        group.tasks.push({
          status: task.status,
          startedAt: task.startedAt,
          finishedAt: task.finishedAt,
        });
        groups.set(key, group);
      }

      return [...groups.entries()].map(([assigneeId, group]) => ({
        assigneeId,
        assigneeName: group.assigneeName,
        ...summarizeCleaning(group.tasks),
      }));
    }),

  /** Сводка по горничным за дату: смена, номера, план, текущая задача. */
  maidsOverview: permissionProcedure("cleaning.manage")
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(async ({ input }) => {
      const local = new Date();
      const dateStr =
        input?.date ??
        new Date(local.getTime() - local.getTimezoneOffset() * 60_000)
          .toISOString()
          .slice(0, 10);
      const from = new Date(`${dateStr}T00:00:00`);
      const to = new Date(`${dateStr}T23:59:59.999`);

      const maids = await prisma.user.findMany({
        where: { role: { code: "MAID" } },
        include: {
          rooms: {
            include: {
              room: { select: { id: true, number: true, floor: true, floorName: true, cleaningStatus: true } },
            },
            orderBy: { room: { number: "asc" } },
          },
          shifts: {
            where: { endedAt: null },
            orderBy: { startedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { fullName: "asc" },
      });

      const maidIds = maids.map((maid) => maid.id);
      if (maidIds.length === 0) return { date: dateStr, maids: [] };

      const [planTasks, activeTasks] = await Promise.all([
        prisma.cleaningTask.findMany({
          where: { assigneeId: { in: maidIds }, createdAt: { gte: from, lte: to } },
          select: {
            assigneeId: true,
            status: true,
            roomId: true,
            startedAt: true,
            finishedAt: true,
          },
        }),
        prisma.cleaningTask.findMany({
          where: { assigneeId: { in: maidIds }, status: "IN_PROGRESS" },
          include: { room: { select: { number: true } } },
          orderBy: { startedAt: "desc" },
          take: 50,
        }),
      ]);

      const tasksByMaid = new Map<string, typeof planTasks>();
      for (const task of planTasks) {
        if (!task.assigneeId) continue;
        const list = tasksByMaid.get(task.assigneeId) ?? [];
        list.push(task);
        tasksByMaid.set(task.assigneeId, list);
      }
      const activeByMaid = new Map<string, (typeof activeTasks)[number]>();
      for (const task of activeTasks) {
        if (task.assigneeId && !activeByMaid.has(task.assigneeId)) {
          activeByMaid.set(task.assigneeId, task);
        }
      }

      const now = Date.now();
      return {
        date: dateStr,
        maids: maids.map((maid) => {
          const shift = maid.shifts[0];
          const current = activeByMaid.get(maid.id);
          const summary = summarizeMaidPlan(tasksByMaid.get(maid.id) ?? []);
          const shiftStartedAt = shift?.startedAt ?? null;
          return {
            id: maid.id,
            login: maid.login,
            fullName: maid.fullName,
            isActive: maid.isActive,
            status: maidWorkStatus({
              isActive: maid.isActive,
              hasOpenShift: Boolean(shift),
              hasInProgress: Boolean(current),
            }),
            shift: {
              active: Boolean(shift),
              startedAt: shiftStartedAt,
              overdue:
                shiftStartedAt !== null &&
                now - shiftStartedAt.getTime() > 12 * 60 * 60 * 1000,
            },
            rooms: maid.rooms.map((row) => ({
              id: row.room.id,
              number: row.room.number,
              floor: row.room.floor,
              floorLabel: roomFloorLabel(row.room.floor, row.room.floorName),
              cleaningStatus: row.room.cleaningStatus,
            })),
            plan: summary,
            currentTask: current
              ? {
                  id: current.id,
                  roomNumber: current.room.number,
                  type: current.type,
                  startedAt: current.startedAt,
                }
              : null,
          };
        }),
      };
    }),

  /** Архив заданий горничных по датам (создание задачи). */
  maidArchive: permissionProcedure("cleaning.manage")
    .input(
      z.object({
        maidId: z.string().optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["NEW", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
      }),
    )
    .query(async ({ input }) => {
      const from = new Date(`${input.from}T00:00:00`);
      const to = new Date(`${input.to}T23:59:59.999`);
      const tasks = await prisma.cleaningTask.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(input.maidId
            ? { assigneeId: input.maidId }
            : { assignee: { role: { code: "MAID" } } }),
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          room: { select: { number: true, floor: true, floorName: true } },
          assignee: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      return {
        summary: summarizeCleaning(tasks),
        tasks: tasks.map((task) => ({
          id: task.id,
          createdAt: task.createdAt,
          roomNumber: task.room.number,
          floor: task.room.floor,
          floorLabel: roomFloorLabel(task.room.floor, task.room.floorName),
          maidId: task.assignee?.id ?? null,
          maidName: task.assignee?.fullName ?? "Не назначено",
          type: task.type,
          priority: task.priority,
          status: task.status,
          plannedMinutes: task.plannedMinutes,
          durationMinutes:
            task.startedAt && task.finishedAt
              ? Math.max(
                  0,
                  Math.round((task.finishedAt.getTime() - task.startedAt.getTime()) / 60_000),
                )
              : null,
          startedAt: task.startedAt,
          finishedAt: task.finishedAt,
        })),
      };
    }),

  shiftStatus: permissionProcedure("cleaning.execute").query(async ({ ctx }) => {
    const open = await prisma.shift.findFirst({
      where: { userId: ctx.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    return { active: Boolean(open), startedAt: open?.startedAt ?? null };
  }),

  startShift: permissionProcedure("cleaning.execute").mutation(async ({ ctx }) => {
    const open = await prisma.shift.findFirst({
      where: { userId: ctx.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (open) return { startedAt: open.startedAt, already: true };
    const shift = await prisma.shift.create({
      data: { userId: ctx.user.id },
      select: { startedAt: true },
    });
    return { startedAt: shift.startedAt, already: false };
  }),

  endShift: permissionProcedure("cleaning.execute").mutation(async ({ ctx }) => {
    const open = await prisma.shift.findFirst({
      where: { userId: ctx.user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (!open) return { closed: false };
    await prisma.shift.update({ where: { id: open.id }, data: { endedAt: new Date() } });
    return { closed: true };
  }),
});
