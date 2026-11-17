import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { permissionProcedure, router } from "../trpc";

const templateInput = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional(),
});

export const checklistsRouter = router({
  list: permissionProcedure("cleaning.manage").query(async () => {
    const templates = await prisma.checklistTemplate.findMany({
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      items: template.items.map((item) => ({
        id: item.id,
        text: item.text,
        photoRequired: item.photoRequired,
        extraOptionText: item.extraOptionText,
        sortOrder: item.sortOrder,
      })),
    }));
  }),

  createTemplate: permissionProcedure("cleaning.manage")
    .input(templateInput)
    .mutation(async ({ input }) => {
      const template = await prisma.checklistTemplate.create({
        data: { name: input.name, description: input.description ?? null },
        select: { id: true },
      });
      return { id: template.id };
    }),

  updateTemplate: permissionProcedure("cleaning.manage")
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(2).max(120).optional(),
        description: z.string().max(300).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.checklistTemplate.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Шаблон не найден" });
      await prisma.checklistTemplate.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      return { ok: true };
    }),

  addItem: permissionProcedure("cleaning.manage")
    .input(
      z.object({
        templateId: z.string().min(1),
        text: z.string().min(1).max(200),
        photoRequired: z.boolean().optional(),
        extraOptionText: z.string().max(60).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const template = await prisma.checklistTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Шаблон не найден" });
      const last = await prisma.checklistItem.findFirst({
        where: { templateId: template.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const item = await prisma.checklistItem.create({
        data: {
          templateId: template.id,
          text: input.text,
          photoRequired: input.photoRequired ?? false,
          extraOptionText: input.extraOptionText ?? null,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      });
      return { id: item.id };
    }),

  updateItem: permissionProcedure("cleaning.manage")
    .input(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1).max(200).optional(),
        photoRequired: z.boolean().optional(),
        extraOptionText: z.string().max(60).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const item = await prisma.checklistItem.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Пункт не найден" });
      await prisma.checklistItem.update({
        where: { id: input.id },
        data: {
          ...(input.text ? { text: input.text } : {}),
          ...(input.photoRequired !== undefined ? { photoRequired: input.photoRequired } : {}),
          ...(input.extraOptionText !== undefined
            ? { extraOptionText: input.extraOptionText }
            : {}),
        },
      });
      return { ok: true };
    }),

  removeItem: permissionProcedure("cleaning.manage")
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await prisma.checklistItem.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /** Прикрепить шаблон к задаче можно только до начала работы. */
  attachToTask: permissionProcedure("cleaning.manage")
    .input(z.object({ taskId: z.string().min(1), templateId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const task = await prisma.cleaningTask.findUnique({ where: { id: input.taskId } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Задача не найдена" });
      if (task.status !== "NEW") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Чек-лист можно прикрепить только к новой задаче",
        });
      }
      if (input.templateId) {
        const template = await prisma.checklistTemplate.findUnique({
          where: { id: input.templateId },
        });
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Шаблон не найден" });
      }
      await prisma.cleaningTask.update({
        where: { id: task.id },
        data: { checklistTemplateId: input.templateId },
      });
      return { ok: true };
    }),
});
