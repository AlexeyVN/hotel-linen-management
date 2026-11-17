import fs from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absolutePhotoPath } from "@/lib/photos";
import { canAccessRoom, hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Фото отдаётся только авторизованному пользователю с правом photos.view и доступом к номеру. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  if (!hasPermission(user, "photos.view")) {
    return Response.json({ error: "Нет права photos.view" }, { status: 403 });
  }

  const { photoId } = await params;
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      fileName: true,
      mimeType: true,
      auditSession: { select: { roomId: true } },
    },
  });
  if (!photo) return Response.json({ error: "Фото не найдено" }, { status: 404 });
  if (!canAccessRoom(user, photo.auditSession.roomId)) {
    return Response.json({ error: "Нет доступа к номеру" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(absolutePhotoPath(photo.fileName));
    return new Response(data, {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Файл отсутствует на диске" }, { status: 404 });
  }
}
