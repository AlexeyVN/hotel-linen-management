import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

const QR_ROOT = path.join(process.cwd(), "storage", "qr");

export function qrObjectDir(objectType: "room" | "item", objectId: string): string {
  return path.join(QR_ROOT, objectType, objectId);
}

export function qrRelativePath(
  objectType: "room" | "item",
  objectId: string,
  fileName: string,
): string {
  return `${objectType}/${objectId}/${fileName}`;
}

/** Защита от выхода за storage/qr через подставной относительный путь. */
export function qrAbsolutePath(relativePath: string): string {
  const absolute = path.resolve(QR_ROOT, relativePath);
  if (!absolute.startsWith(`${QR_ROOT}${path.sep}`)) {
    throw new Error("Некорректный путь QR-файла");
  }
  return absolute;
}

export async function ensureQrDir(objectType: "room" | "item", objectId: string): Promise<string> {
  const dir = qrObjectDir(objectType, objectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function removeQrFile(relativePath: string | null | undefined): Promise<boolean> {
  if (!relativePath) return false;
  try {
    await fs.unlink(qrAbsolutePath(relativePath));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    logger.warn({ relativePath, error }, "не удалось удалить QR-файл");
    return false;
  }
}

export function isFileInsideQrStorage(relativePath: string): boolean {
  try {
    qrAbsolutePath(relativePath);
    return true;
  } catch {
    return false;
  }
}
