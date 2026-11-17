import fs from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BRANDING_KEYS, BRANDING_LOGO_PATH } from "@/lib/branding";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 2000;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** PNG: сигнатура + ширина/высота из IHDR. */
function parsePng(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 33) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (signature.some((byte, index) => bytes[index] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Требуется вход", 401);
  if (!hasPermission(user, "settings.branding")) {
    return jsonError("Нет права settings.branding", 403);
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
  if (file.size > MAX_BYTES) return jsonError("Логотип больше 2 МБ", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = parsePng(bytes);
  if (!size) return jsonError("Допустим только PNG", 415);
  if (size.width < 16 || size.height < 16 || size.width > MAX_DIMENSION || size.height > MAX_DIMENSION) {
    return jsonError(`Размер логотипа: от 16 до ${MAX_DIMENSION} px`, 400);
  }

  await fs.mkdir(path.dirname(BRANDING_LOGO_PATH), { recursive: true });
  await fs.writeFile(BRANDING_LOGO_PATH, bytes);

  const version = String(Date.now());
  const data: Array<{ key: string; value: string }> = [
    { key: BRANDING_KEYS.logoVersion, value: version },
    { key: BRANDING_KEYS.logoWidth, value: String(size.width) },
    { key: BRANDING_KEYS.logoHeight, value: String(size.height) },
  ];
  await prisma.$transaction(
    data.map((entry) =>
      prisma.setting.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: entry,
      }),
    ),
  );

  logger.info({ login: user.login, width: size.width, height: size.height }, "логотип отеля обновлён");
  return Response.json({ ok: true, width: size.width, height: size.height, version });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Требуется вход", 401);
  if (!hasPermission(user, "settings.branding")) {
    return jsonError("Нет права settings.branding", 403);
  }

  try {
    await fs.unlink(BRANDING_LOGO_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ error }, "не удалось удалить файл логотипа");
    }
  }
  await prisma.setting.deleteMany({
    where: {
      key: {
        in: [
          BRANDING_KEYS.logoVersion,
          BRANDING_KEYS.logoWidth,
          BRANDING_KEYS.logoHeight,
        ],
      },
    },
  });
  return Response.json({ ok: true });
}
