/**
 * Настройки интеграции в таблице Setting: пароль шифруется (secret.ts),
 * наружу отдаётся только признак «задан» (ТЗ §8.2).
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { IntegrationMode } from "./contract";
import { decryptSecret, encryptSecret } from "./secret";

const KEYS = {
  enabled: "integration.enabled",
  mode: "integration.mode",
  baseUrl: "integration.baseUrl",
  login: "integration.login",
  password: "integration.password",
  interval: "integration.syncIntervalMinutes",
  roomStatusEnabled: "integration.roomStatusEnabled",
  roomStatusPath: "integration.roomStatusPath",
  roomStatusMethod: "integration.roomStatusMethod",
  roomStatusToken: "integration.roomStatusToken",
  lastSyncAt: "integration.lastSyncAt",
  lastError: "integration.lastError",
} as const;

export interface IntegrationConfig {
  enabled: boolean;
  mode: IntegrationMode;
  baseUrl: string;
  login: string;
  password: string;
  passwordSet: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface IntegrationStatus {
  enabled: boolean;
  mode: IntegrationMode;
  baseUrl: string;
  login: string;
  passwordSet: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastError: string | null;
  outbox: { pending: number; sent: number; failed: number };
}

async function readSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export function toBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true";
}

export function parseInterval(value: string | undefined, fallback = 5): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1440) return fallback;
  return Math.round(parsed);
}

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  const settings = await readSettings();
  const token = settings[KEYS.password] ?? "";
  let password = "";
  let passwordSet = false;
  if (token) {
    passwordSet = true;
    try {
      password = decryptSecret(token);
    } catch {
      password = "";
    }
  }

  return {
    enabled: toBool(settings[KEYS.enabled]),
    mode: settings[KEYS.mode] === "onec" ? "onec" : "stub",
    baseUrl: settings[KEYS.baseUrl] ?? "",
    login: settings[KEYS.login] ?? "",
    password,
    passwordSet,
    syncIntervalMinutes: parseInterval(settings[KEYS.interval]),
    lastSyncAt: settings[KEYS.lastSyncAt] || null,
    lastError: settings[KEYS.lastError] || null,
  };
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export interface SaveIntegrationInput {
  enabled: boolean;
  mode: IntegrationMode;
  baseUrl?: string;
  login?: string;
  /** undefined — не менять; "" — очистить. */
  password?: string;
  syncIntervalMinutes: number;
}

export async function saveIntegrationConfig(input: SaveIntegrationInput): Promise<void> {
  await setSetting(KEYS.enabled, String(input.enabled));
  await setSetting(KEYS.mode, input.mode);
  if (input.baseUrl !== undefined) {
    await setSetting(KEYS.baseUrl, input.baseUrl.trim());
  }
  if (input.login !== undefined) {
    await setSetting(KEYS.login, input.login.trim());
  }
  if (input.password !== undefined) {
    await setSetting(
      KEYS.password,
      input.password === "" ? "" : encryptSecret(input.password),
    );
  }
  await setSetting(KEYS.interval, String(parseInterval(String(input.syncIntervalMinutes))));
}

export async function recordSyncError(message: string): Promise<void> {
  await setSetting(KEYS.lastError, message.slice(0, 500));
}

export type RoomStatusMethod = "POST" | "PUT";

export interface RoomStatusConfig {
  enabled: boolean;
  path: string;
  method: RoomStatusMethod;
  token: string;
  tokenSet: boolean;
}

export const DEFAULT_ROOM_STATUS_PATH = "/hs/Housekeeping/v1/SetRoomStatus";

export async function getRoomStatusConfig(): Promise<RoomStatusConfig> {
  const settings = await readSettings();
  const encrypted = settings[KEYS.roomStatusToken] ?? "";
  let token = "";
  if (encrypted) {
    try {
      token = decryptSecret(encrypted);
    } catch {
      token = "";
    }
  }
  const method = settings[KEYS.roomStatusMethod] === "PUT" ? "PUT" : "POST";
  return {
    enabled: toBool(settings[KEYS.roomStatusEnabled]),
    path: settings[KEYS.roomStatusPath] || DEFAULT_ROOM_STATUS_PATH,
    method,
    token,
    tokenSet: Boolean(token),
  };
}

export async function saveRoomStatusConfig(input: {
  enabled: boolean;
  path: string;
  method: RoomStatusMethod;
}): Promise<void> {
  await setSetting(KEYS.roomStatusEnabled, String(input.enabled));
  await setSetting(KEYS.roomStatusPath, input.path.trim());
  await setSetting(KEYS.roomStatusMethod, input.method);
}

/** Возвращает открытый токен один раз; в БД хранится только шифртекст. */
export async function regenerateRoomStatusToken(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await setSetting(KEYS.roomStatusToken, encryptSecret(token));
  return token;
}

export async function integrationStatus(): Promise<IntegrationStatus> {
  const config = await getIntegrationConfig();
  const [pending, sent, failed] = await Promise.all([
    prisma.outboxEntry.count({ where: { status: "PENDING" } }),
    prisma.outboxEntry.count({ where: { status: "SENT" } }),
    prisma.outboxEntry.count({ where: { status: "FAILED" } }),
  ]);

  return {
    enabled: config.enabled,
    mode: config.mode,
    baseUrl: config.baseUrl,
    login: config.login,
    passwordSet: config.passwordSet,
    syncIntervalMinutes: config.syncIntervalMinutes,
    lastSyncAt: config.lastSyncAt,
    lastError: config.lastError,
    outbox: { pending, sent, failed },
  };
}
