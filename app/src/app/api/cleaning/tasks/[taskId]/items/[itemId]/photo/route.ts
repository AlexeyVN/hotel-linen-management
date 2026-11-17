import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  PHOTO_MAX_BYTES,
  extensionToMime,
  photosDir,
  relativePhotoPath,
  sniffImage,
} from "@/lib/photos";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Фото к пункту чек-листа (ТЗ v2.5). Пункт должен быть уже отмечен. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; itemId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Требуется вход", 401);
  if (!hasPermission(user, "cleaning.execute")) {
    return jsonError("Нет права cleaning.execute", 403);
  }

  const { taskId, itemId } = await params;
  const task = await prisma.cleaningTask.findUnique({
    where: { id: taskId },
    include: { checklistTemplate: { include: { items: { select: { id: true } } } } },
  });
  if (!task) return jsonError("Задача не найдена", 404);

  const canManage = hasPermission(user, "cleaning.manage");
  if (!canManage && task.assigneeId !== user.id) {
    return jsonError("Задача назначена другой горничной", 403);
  }
  if (task.status === "DONE" || task.status === "CANCELLED") {
    return jsonError("Задача уже закрыта", 409);
  }
  const items = task.checklistTemplate?.items ?? [];
  if (!items.some((item) => item.id === itemId)) {
    return jsonError("Пункт не относится к чек-листу задачи", 400);
  }

  const answer = await prisma.checklistAnswer.findUnique({
    where: { taskId_itemId: { taskId: task.id, itemId } },
  });
  if (!answer) {
    return jsonError("Сначала отметьте пункт, затем добавьте фото", 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Ожидался multipart/form-data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Поле file обязательно", 400);
  if (file.size === 0) return jsonError("Пустой файл", 400);
  if (file.size > PHOTO_MAX_BYTES) return jsonError("Файл больше 5 МБ", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) return jsonError("Допустимы только JPEG, PNG или WebP", 415);

  const now = new Date();
  const dir = photosDir(now);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), bytes);

  await prisma.checklistAnswer.update({
    where: { id: answer.id },
    data: {
      photoFileName: relativePhotoPath(fileName, now),
      photoMimeType: extensionToMime(ext),
      photoSizeBytes: bytes.length,
    },
  });

  logger.info(
    { taskId: task.id, itemId, answerId: answer.id, bytes: bytes.length },
    "фото пункта чек-листа сохранено",
  );
  return Response.json({ ok: true });
}
