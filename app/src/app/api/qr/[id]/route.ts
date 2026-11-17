import fs from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { qrAbsolutePath } from "@/lib/qr-storage";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Отдача сохранённого QR-файла только с правом rooms.read. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  if (!hasPermission(user, "rooms.read")) {
    return Response.json({ error: "Нет права rooms.read" }, { status: 403 });
  }

  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({
    where: { id },
    select: {
      fileName: true,
      mimeType: true,
      imageFormat: true,
      code: true,
      objectType: true,
    },
  });
  if (!qr?.fileName) {
    return Response.json({ error: "QR не найден" }, { status: 404 });
  }

  try {
    const data = await fs.readFile(qrAbsolutePath(qr.fileName));
    const download = request.nextUrl.searchParams.get("download") === "1";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": qr.mimeType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="qr-${qr.objectType.toLowerCase()}-${encodeURIComponent(
                qr.code,
              )}.${qr.imageFormat}"`,
            }
          : {}),
      },
    });
  } catch {
    return Response.json({ error: "Файл QR отсутствует" }, { status: 404 });
  }
}
