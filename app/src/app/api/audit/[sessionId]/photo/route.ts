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
import { canAccessRoom, hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Загрузка фото к черновику инвентаризации.
 * Проверки: вход, право audit.create, доступ к номеру, статус DRAFT,
 * размер ≤ 5 МБ, тип — по сигнатуре файла (ТЗ §10.3).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Требуется вход", 401);
  if (!hasPermission(user, "audit.create")) return jsonError("Нет права audit.create", 403);

  const { sessionId } = await params;
  const session = await prisma.auditSession.findUnique({
    where: { id: sessionId },
    select: { id: true, roomId: true, status: true },
  });
  if (!session) return jsonError("Инвентаризация не найдена", 404);
  if (!canAccessRoom(user, session.roomId)) return jsonError("Номер не назначен", 403);
  if (session.status !== "DRAFT") return jsonError("Инвентаризация уже проведена", 409);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Ожидался multipart/form-data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Поле file обязательно", 400);
  if (file.size === 0) return jsonError("Пустой файл", 400);
  if (file.size > PHOTO_MAX_BYTES) {
    return jsonError("Файл больше 5 МБ", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) return jsonError("Допустимы только JPEG, PNG или WebP", 415);

  const now = new Date();
  const dir = photosDir(now);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), bytes);

  const photo = await prisma.photo.create({
    data: {
      auditSessionId: session.id,
      fileName: relativePhotoPath(fileName, now),
      mimeType: extensionToMime(ext),
      sizeBytes: bytes.length,
    },
    select: { id: true },
  });

  logger.info(
    { photoId: photo.id, sessionId: session.id, bytes: bytes.length, mime: extensionToMime(ext) },
    "фото инвентаризации сохранено",
  );

  return Response.json({ id: photo.id });
}
