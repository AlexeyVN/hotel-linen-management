/**
 * Фотофиксация: проверка типа по сигнатуре, хранение вне public (ТЗ §10.3).
 * Отдача — только через авторизованный route handler.
 */
import path from "node:path";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export type PhotoExt = "jpg" | "png" | "webp";

/** Тип определяется сигнатурой, а не расширением/Content-Type от клиента. */
export function sniffImage(bytes: Uint8Array): PhotoExt | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function extensionToMime(ext: PhotoExt): string {
  if (ext === "jpg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return "image/webp";
}

/** Каталог текущего месяца внутри storage/photos (вне public). */
export function photosDir(now: Date = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return path.join(process.cwd(), "storage", "photos", year, month);
}

/** Относительный путь для БД: YYYY/MM/имя.файла (разделитель — прямой слэш). */
export function relativePhotoPath(fileName: string, now: Date = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${fileName}`;
}

export function absolutePhotoPath(fileName: string): string {
  return path.join(process.cwd(), "storage", "photos", fileName);
}
