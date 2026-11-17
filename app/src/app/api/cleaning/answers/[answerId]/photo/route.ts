import fs from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absolutePhotoPath } from "@/lib/photos";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Фото пункта чек-листа: только своей задачи или с правом управления. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ answerId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  if (!hasPermission(user, "cleaning.execute")) {
    return Response.json({ error: "Нет права cleaning.execute" }, { status: 403 });
  }

  const { answerId } = await params;
  const answer = await prisma.checklistAnswer.findUnique({
    where: { id: answerId },
    select: {
      photoFileName: true,
      photoMimeType: true,
      task: { select: { assigneeId: true } },
    },
  });
  if (!answer?.photoFileName) {
    return Response.json({ error: "Фото не найдено" }, { status: 404 });
  }

  const canManage = hasPermission(user, "cleaning.manage");
  if (!canManage && answer.task.assigneeId !== user.id) {
    return Response.json({ error: "Нет доступа к задаче" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(absolutePhotoPath(answer.photoFileName));
    return new Response(data, {
      headers: {
        "Content-Type": answer.photoMimeType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Файл отсутствует на диске" }, { status: 404 });
  }
}
