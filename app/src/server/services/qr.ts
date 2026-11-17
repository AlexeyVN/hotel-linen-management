import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { buildQrPayload, type QrPayloadFormat } from "@/lib/domain/qr";
import { qrAbsolutePath, qrRelativePath, ensureQrDir, removeQrFile } from "@/lib/qr-storage";
import { prisma } from "@/lib/prisma";

export type QrObjectType = "room" | "item";
export type QrImageFormat = "png" | "svg";

export interface GenerateQrInput {
  objectType: QrObjectType;
  id: string;
  payloadFormat: QrPayloadFormat;
  imageFormat: QrImageFormat;
  size?: number;
}

interface LoadedObject {
  id: string;
  code: string;
  isActive: boolean;
}

async function loadObject(objectType: QrObjectType, id: string): Promise<LoadedObject> {
  if (objectType === "room") {
    const room = await prisma.room.findUnique({
      where: { id },
      select: { id: true, number: true, isActive: true },
    });
    if (!room) throw new Error("Номер не найден");
    return { id: room.id, code: room.number, isActive: room.isActive };
  }
  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, externalId: true, isActive: true },
  });
  if (!item) throw new Error("Позиция не найдена");
  return { id: item.id, code: item.externalId ?? item.id, isActive: item.isActive };
}

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
}

async function renderQr(
  payload: string,
  imageFormat: QrImageFormat,
  size: number,
): Promise<{ bytes: Buffer; mimeType: string; extension: string }> {
  if (imageFormat === "svg") {
    const svg = await QRCode.toString(payload, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    return { bytes: Buffer.from(svg, "utf8"), mimeType: "image/svg+xml", extension: "svg" };
  }
  const bytes = await QRCode.toBuffer(payload, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return { bytes, mimeType: "image/png", extension: "png" };
}

/** Генерирует/перегенерирует метку и сохраняет файл + запись QrCode. */
export async function generateQr(input: GenerateQrInput) {
  const object = await loadObject(input.objectType, input.id);
  if (!object.isActive) throw new Error("Объект деактивирован");

  const payload = buildQrPayload({
    type: input.objectType,
    code: object.code,
    id: object.id,
    baseUrl: baseUrl(),
    format: input.payloadFormat,
  });
  const rendered = await renderQr(payload, input.imageFormat, input.size ?? 320);

  await ensureQrDir(input.objectType, object.id);
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${rendered.extension}`;
  const relativePath = qrRelativePath(input.objectType, object.id, fileName);
  await fs.writeFile(qrAbsolutePath(relativePath), rendered.bytes);

  const where = input.objectType === "room" ? { roomId: object.id } : { itemId: object.id };
  const existing = await prisma.qrCode.findFirst({ where });
  const data = {
    objectType: input.objectType.toUpperCase(),
    code: object.code,
    payload,
    payloadFormat: input.payloadFormat,
    imageFormat: input.imageFormat,
    fileName: relativePath,
    mimeType: rendered.mimeType,
    sizeBytes: rendered.bytes.length,
    baseUrl: baseUrl(),
    ...(input.objectType === "room" ? { roomId: object.id, itemId: null } : { itemId: object.id, roomId: null }),
  };

  const record = existing
    ? await prisma.qrCode.update({ where: { id: existing.id }, data })
    : await prisma.qrCode.create({ data });

  if (existing?.fileName && existing.fileName !== relativePath) {
    await removeQrFile(existing.fileName);
  }

  return { record, payload, dataUrl: await imageDataUrl({ fileName: relativePath, mimeType: rendered.mimeType, imageFormat: input.imageFormat }) };
}

/** Для печати: использует сохранённую метку, если формат и файл подходят. */
export async function ensureQr(input: GenerateQrInput) {
  const object = await loadObject(input.objectType, input.id);
  if (!object.isActive) throw new Error("Объект деактивирован");
  const existing = await prisma.qrCode.findFirst({
    where: input.objectType === "room" ? { roomId: object.id } : { itemId: object.id },
  });
  if (
    existing?.fileName &&
    existing.imageFormat === input.imageFormat &&
    existing.payloadFormat === input.payloadFormat
  ) {
    try {
      await fs.access(qrAbsolutePath(existing.fileName));
      return existing;
    } catch {
      // файла нет — перегенерируем
    }
  }
  const generated = await generateQr(input);
  return generated.record;
}

export async function imageDataUrl(record: {
  fileName: string | null;
  mimeType: string | null;
  imageFormat: string;
}): Promise<string> {
  if (!record.fileName) return "";
  const bytes = await fs.readFile(qrAbsolutePath(record.fileName));
  const mime = record.mimeType ?? (record.imageFormat === "svg" ? "image/svg+xml" : "image/png");
  if (mime === "image/svg+xml") {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bytes.toString("utf8"))}`;
  }
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** Актуальна ли сохранённая метка текущему коду и базовому URL. */
export function isQrStale(record: {
  code: string;
  baseUrl: string | null;
  payloadFormat: string;
  fileName: string | null;
}, currentCode: string, currentBaseUrl: string): boolean {
  return (
    record.code !== currentCode ||
    (record.baseUrl ?? "") !== currentBaseUrl ||
    !record.fileName
  );
}

export async function getObjectCode(objectType: QrObjectType, id: string): Promise<string | null> {
  try {
    return (await loadObject(objectType, id)).code;
  } catch {
    return null;
  }
}

export async function fileExists(fileName: string | null): Promise<boolean> {
  if (!fileName) return false;
  try {
    await fs.access(path.resolve(qrAbsolutePath(fileName)));
    return true;
  } catch {
    return false;
  }
}
