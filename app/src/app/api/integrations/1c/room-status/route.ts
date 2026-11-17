import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { getRoomStatusConfig } from "@/server/erp/config";
import {
  applyInboundRoomStatus,
  parseInboundRoomStatus,
  RoomStatusInputError,
} from "@/server/erp/room-status";

export const dynamic = "force-dynamic";

function sameToken(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const config = await getRoomStatusConfig();
  if (!config.enabled) {
    return Response.json({ error: "Обмен статусами выключен" }, { status: 503 });
  }
  if (!config.token) {
    return Response.json({ error: "Webhook-токен не настроен" }, { status: 503 });
  }
  const received = request.headers.get("x-webhook-token") ?? "";
  if (!received || !sameToken(received, config.token)) {
    logger.warn("webhook 1С: неверный или отсутствующий токен");
    return Response.json({ error: "Неверный токен" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  try {
    const input = parseInboundRoomStatus(json);
    const result = await applyInboundRoomStatus(input);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RoomStatusInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    logger.error({ error }, "webhook 1С: ошибка обработки статуса");
    return Response.json({ error: "Внутренняя ошибка обработки статуса" }, { status: 500 });
  }
}
