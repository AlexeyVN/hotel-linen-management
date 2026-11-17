import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQrPayload, parseQrPayload } from "../src/lib/domain/qr";

test("url-формат: комната и позиция", () => {
  assert.equal(
    buildQrPayload({ type: "room", code: "101", format: "url", baseUrl: "https://hotel.local" }),
    "https://hotel.local/r/101",
  );
  assert.equal(
    buildQrPayload({ type: "item", code: "1C-201", format: "url", baseUrl: "https://hotel.local/" }),
    "https://hotel.local/i/1C-201",
  );
});

test("json-формат содержит версию, тип, код и id", () => {
  const payload = buildQrPayload({ type: "room", code: "101", id: "room-1", format: "json" });
  const parsed = JSON.parse(payload);
  assert.deepEqual(parsed, { v: 1, type: "room", code: "101", id: "room-1" });
});

test("text-формат: HOTEL:ROOM:101", () => {
  assert.equal(
    buildQrPayload({ type: "room", code: "101", format: "text" }),
    "HOTEL:ROOM:101",
  );
});

test("url разбирается в тип и код", () => {
  assert.deepEqual(parseQrPayload("https://hotel.local/r/101"), {
    declaredType: "room",
    code: "101",
  });
  assert.deepEqual(parseQrPayload("/i/1C-201"), { declaredType: "item", code: "1C-201" });
  assert.deepEqual(parseQrPayload("https://hotel.local/m/audit?room=101"), {
    declaredType: "room",
    code: "101",
  });
  assert.deepEqual(parseQrPayload("/m/distribute?item=abc"), { declaredType: "item", code: "abc" });
});

test("json и text разбираются", () => {
  assert.deepEqual(parseQrPayload('{"v":1,"type":"item","code":"1C-9"}'), {
    declaredType: "item",
    code: "1C-9",
  });
  assert.deepEqual(parseQrPayload("HOTEL:ITEM:1C-9"), { declaredType: "item", code: "1C-9" });
  assert.deepEqual(parseQrPayload("room:101"), { declaredType: "room", code: "101" });
});

test("голый код не приписывает тип", () => {
  assert.deepEqual(parseQrPayload("101"), { declaredType: null, code: "101" });
  assert.deepEqual(parseQrPayload("  1C-201  "), { declaredType: null, code: "1C-201" });
});

test("мусор отклоняется", () => {
  assert.equal(parseQrPayload(""), null);
  assert.equal(parseQrPayload("   "), null);
  assert.equal(parseQrPayload("{broken json"), null);
  assert.equal(parseQrPayload('{"type":"room"}'), null);
  assert.equal(parseQrPayload("https://hotel.local/unknown/path"), null);
});

test("сгенерированный payload читается обратно во всех форматах", () => {
  for (const format of ["url", "json", "text"] as const) {
    const payload = buildQrPayload({
      type: "room",
      code: "202",
      id: "r-202",
      format,
      baseUrl: "http://localhost:3000",
    });
    const parsed = parseQrPayload(payload);
    assert.equal(parsed?.declaredType, "room", format);
    assert.equal(parsed?.code, "202", format);
  }
});
