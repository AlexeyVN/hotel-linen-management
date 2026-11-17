/**
 * QR-коды: полезная нагрузка и разбор. Поддерживаются три формата записи
 * (url / json / text) и три варианта «сырого» кода — печать и сканирование
 * не зависят от того, каким из них метка была создана.
 */

export type QrObjectType = "room" | "item";
export type QrPayloadFormat = "url" | "json" | "text";

export const QR_PAYLOAD_VERSION = 1;
export const MAX_QR_CODE_LENGTH = 100;

export interface QrBuildInput {
  type: QrObjectType;
  code: string;
  id?: string;
  /** Базовый URL для формата url (например, https://hotel-linen-management). */
  baseUrl?: string;
  format: QrPayloadFormat;
}

export interface ParsedQr {
  /** null — формат не указал тип, разбирать по базе. */
  declaredType: QrObjectType | null;
  code: string;
}

function normalizeCode(code: string): string {
  return code.trim().slice(0, MAX_QR_CODE_LENGTH);
}

export function buildQrPayload(input: QrBuildInput): string {
  const code = normalizeCode(input.code);
  const prefix = input.baseUrl?.replace(/\/+$/, "") ?? "";

  if (input.format === "json") {
    return JSON.stringify({
      v: QR_PAYLOAD_VERSION,
      type: input.type,
      code,
      ...(input.id ? { id: input.id } : {}),
    });
  }

  if (input.format === "text") {
    return `HOTEL:${input.type.toUpperCase()}:${code}`;
  }

  const path = input.type === "room" ? "r" : "i";
  return `${prefix}/${path}/${encodeURIComponent(code)}`;
}

/** Разбор любого поддерживаемого формата. Возвращает null для мусора. */
export function parseQrPayload(raw: string): ParsedQr | null {
  const text = raw.trim();
  if (!text || text.length > 2000) return null;

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { type?: unknown; code?: unknown };
      if (
        (parsed.type === "room" || parsed.type === "item") &&
        typeof parsed.code === "string" &&
        parsed.code.trim()
      ) {
        return { declaredType: parsed.type, code: normalizeCode(parsed.code) };
      }
      return null;
    } catch {
      return null;
    }
  }

  const textMatch = text.match(/^(?:HOTEL:)?(ROOM|ITEM):(.+)$/i);
  if (textMatch) {
    return {
      declaredType: textMatch[1].toLowerCase() === "room" ? "room" : "item",
      code: normalizeCode(textMatch[2]),
    };
  }

  if (/^(https?:)?\/\//i.test(text) || text.startsWith("/")) {
    try {
      const url = new URL(text, "http://local");
      const roomParam = url.searchParams.get("room");
      if (roomParam) return { declaredType: "room", code: normalizeCode(roomParam) };
      const itemParam = url.searchParams.get("item");
      if (itemParam) return { declaredType: "item", code: normalizeCode(itemParam) };
      const pathMatch = url.pathname.match(/^\/([ri])\/([^/]+)\/?$/);
      if (pathMatch) {
        return {
          declaredType: pathMatch[1] === "r" ? "room" : "item",
          code: normalizeCode(decodeURIComponent(pathMatch[2])),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Голый код: тип не указан, сервер попробует номер, затем позицию.
  return { declaredType: null, code: normalizeCode(text) };
}
