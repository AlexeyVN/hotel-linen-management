process.env.NEXTAUTH_SECRET = "test-secret-for-erp-tests";

import { test } from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret } from "../src/server/erp/secret";
import { parseItemsResponse } from "../src/server/erp/adapters/onec";

test("пароль 1С шифруется и расшифровывается обратно", () => {
  const plain = "Пароль-1С-$ecure";
  const token = encryptSecret(plain);
  assert.notEqual(token, plain);
  assert.ok(token.startsWith("v1:"));
  assert.equal(decryptSecret(token), plain);
});

test("два шифрования одного пароля дают разные строки (случайный IV)", () => {
  const first = encryptSecret("same-password");
  const second = encryptSecret("same-password");
  assert.notEqual(first, second);
  assert.equal(decryptSecret(first), "same-password");
  assert.equal(decryptSecret(second), "same-password");
});

test("подмена шифротекста обнаруживается", () => {
  const token = encryptSecret("secret");
  const parts = token.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptSecret(parts.join(":")));
});

test("номенклатура 1С: числовой код приводится к строке", () => {
  const items = parseItemsResponse([
    { code: 101, name: "Комплект белья", unit: "компл", category: "LINEN" },
    { code: "1C-2", name: "Халат", extra: "игнорируется" },
  ]);
  assert.deepEqual(items, [
    { externalId: "101", name: "Комплект белья", unit: "компл", categoryCode: "LINEN" },
    { externalId: "1C-2", name: "Халат", unit: undefined, categoryCode: undefined },
  ]);
});

test("некорректная структура ответа отклоняется", () => {
  assert.throws(() => parseItemsResponse({ items: [] }));
  assert.throws(() => parseItemsResponse([{ name: "без кода" }]));
});
