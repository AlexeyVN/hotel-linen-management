/**
 * Логи: pino в файл с ротацией по локальной дате и в stdout.
 * Файлы старше LOG_RETENTION_DAYS (14 по умолчанию) удаляются при старте и
 * при смене суток. Уровень управляется LOG_LEVEL (debug/info/warn/error).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Writable } from "node:stream";
import pino from "pino";

const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? 14);
const LOG_FILE_PATTERN = /^app-\d{4}-\d{2}-\d{2}\.log$/;

export function logDir(): string {
  const dir = path.join(process.cwd(), "logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function localDay(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function cleanupOldLogs(now = new Date()): number {
  const cutoff = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of fs.readdirSync(logDir())) {
    if (!LOG_FILE_PATTERN.test(name)) continue;
    const file = path.join(logDir(), name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) {
        fs.unlinkSync(file);
        removed += 1;
      }
    } catch {
      // Удаление лога не должно останавливать приложение.
    }
  }
  return removed;
}

class DailyFileStream extends Writable {
  private day = "";
  private stream: fs.WriteStream | null = null;

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    try {
      const today = localDay();
      if (!this.stream || this.day !== today) {
        this.stream?.end();
        cleanupOldLogs();
        this.stream = fs.createWriteStream(path.join(logDir(), `app-${today}.log`), {
          flags: "a",
        });
        this.day = today;
      }
      this.stream.write(chunk);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  override _final(callback: () => void): void {
    this.stream?.end();
    callback();
  }
}

cleanupOldLogs();

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "hotel-linen", pid: process.pid, hostname: os.hostname() },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    // Sinks must allow debug; the logger level above is the single filter.
    { level: "debug", stream: pino.destination({ dest: 1, sync: true }) },
    { level: "debug", stream: new DailyFileStream() },
  ]),
);
