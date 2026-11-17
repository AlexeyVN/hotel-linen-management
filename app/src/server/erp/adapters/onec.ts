/**
 * Адаптер 1С Отель: HTTP-сервис, опубликованный на стороне 1С.
 *
 * Ожидаемый протокол (должен быть опубликован в 1С, ТЗ §8.4):
 *   GET  {base}/hs/hotel/ping                                  → 2xx
 *   GET  {base}/hs/hotel/items?since=<ISO>                     → [{ code, name, unit?, category? }]
 *   POST {base}/hs/hotel/operations  (JSON ErpOperationDto)    → { ok?: boolean, ref?: string }
 *
 * Авторизация — Basic (логин/пароль из настроек). Пароль не логируется.
 */
import { z } from "zod";
import {
  ErpError,
  type ErpAdapter,
  type ErpItemDto,
  type ErpOperationDto,
  type ErpPingResult,
  type ErpPushResult,
  type ErpRoomStatusDto,
} from "../contract";

export const PING_PATH = "/hs/hotel/ping";
export const ITEMS_PATH = "/hs/hotel/items";
export const OPERATIONS_PATH = "/hs/hotel/operations";
export const DEFAULT_ROOM_STATUS_PATH = "/hs/Housekeeping/v1/SetRoomStatus";

const itemSchema = z
  .object({
    code: z.union([z.string(), z.number()]),
    name: z.string().min(1),
    unit: z.string().optional(),
    category: z.string().optional(),
  })
  .passthrough();

const itemsSchema = z.array(itemSchema);

/** Ответ 1С → DTO; бросает ошибку, если структура неожиданная. */
export function parseItemsResponse(json: unknown): ErpItemDto[] {
  const rows = itemsSchema.parse(json);
  return rows.map((row) => ({
    externalId: String(row.code),
    name: row.name,
    unit: row.unit,
    categoryCode: row.category,
  }));
}

export interface OneCConfig {
  baseUrl: string;
  login: string;
  password: string;
  timeoutMs?: number;
  roomStatusPath?: string;
  roomStatusMethod?: "POST" | "PUT";
}

export class OneCAdapter implements ErpAdapter {
  readonly name = "onec";
  private readonly timeoutMs: number;

  constructor(private readonly config: OneCConfig) {
    this.timeoutMs = config.timeoutMs ?? 8000;
  }

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/+$/, "")}${path}`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${this.config.login}:${this.config.password}`).toString("base64")}`,
    );

    try {
      return await fetch(this.url(path), {
        ...init,
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "сеть недоступна";
      throw new ErpError(`Не удалось связаться с 1С: ${message}`);
    }
  }

  async ping(): Promise<ErpPingResult> {
    try {
      const response = await this.request(PING_PATH, { method: "GET" });
      return {
        ok: response.ok,
        details: response.ok ? "1С ответила" : `1С вернула HTTP ${response.status}`,
      };
    } catch (error) {
      return { ok: false, details: error instanceof Error ? error.message : "Ошибка связи" };
    }
  }

  async pullItems(since?: string): Promise<ErpItemDto[]> {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    const response = await this.request(`${ITEMS_PATH}${query}`, { method: "GET" });
    if (!response.ok) {
      throw new ErpError(`1С вернула HTTP ${response.status} на запрос номенклатуры`, response.status);
    }
    const json = (await response.json()) as unknown;
    return parseItemsResponse(json);
  }

  async pushOperation(operation: ErpOperationDto): Promise<ErpPushResult> {
    const response = await this.request(OPERATIONS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operation),
    });
    if (!response.ok) {
      throw new ErpError(`1С отклонила операцию: HTTP ${response.status}`, response.status);
    }
    let externalRef: string | undefined;
    try {
      const payload = (await response.json()) as { ok?: boolean; ref?: string };
      externalRef = typeof payload.ref === "string" ? payload.ref : undefined;
      if (payload.ok === false) {
        return { ok: false, error: "1С вернула ok: false" };
      }
    } catch {
      // 2xx без тела — считаем успехом, внешнюю ссылку не получаем.
    }
    return { ok: true, externalRef };
  }

  async pushRoomStatus(status: ErpRoomStatusDto): Promise<ErpPushResult> {
    const path = this.config.roomStatusPath || DEFAULT_ROOM_STATUS_PATH;
    const response = await this.request(path, {
      method: this.config.roomStatusMethod ?? "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: status.eventId,
        roomNumber: status.roomNumber,
        status: status.status,
        occurredAt: status.occurredAt,
        source: "hotel-linen",
      }),
    });
    if (!response.ok) {
      throw new ErpError(`1С отклонила статус номера: HTTP ${response.status}`, response.status);
    }
    let externalRef: string | undefined;
    try {
      const payload = (await response.json()) as { ok?: boolean; ref?: string };
      externalRef = typeof payload.ref === "string" ? payload.ref : undefined;
      if (payload.ok === false) {
        return { ok: false, error: "1С вернула ok: false" };
      }
    } catch {
      // 2xx без тела — успех.
    }
    return { ok: true, externalRef };
  }
}
