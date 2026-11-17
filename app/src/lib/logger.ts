/**
 * Логи: pino в файл с ротацией по дате (logs/app-YYYY-MM-DD.log) и в stdout.
 * ТЗ v2.3 §10.4: 14 дней хранения настраивается внешней очисткой (этап M5),
 * ротация по дате — здесь.
 */
import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import pino from "pino";

function logDir(): string {
  const dir = path.join(process.cwd(), "logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
      const today = new Date().toISOString().slice(0, 10);
      if (!this.stream || this.day !== today) {
        this.stream?.end();
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

const exitHook = () => new DailyFileStream();
void exitHook;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "hotel-linen" },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    { level: "info", stream: pino.destination({ dest: 1, sync: true }) },
    { level: "info", stream: new DailyFileStream() },
  ]),
);
