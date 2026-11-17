/**
 * Пароль интеграции хранится в БД зашифрованным (AES-256-GCM).
 * Ключ выводится из NEXTAUTH_SECRET — отдельного секрета не заводим.
 * Наружу пароль не отдаётся ни в API, ни в UI (только «задан/не задан»).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET не задан — шифрование пароля невозможно");
  return createHash("sha256").update(`erp:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(token: string): string {
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Неверный формат зашифрованного секрета");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
