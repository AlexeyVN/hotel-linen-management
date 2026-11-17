import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatKopecks,
  kopecksToInput,
  parseRublesToKopecks,
} from "../src/lib/money";

test("форматирование копеек в рубли", () => {
  assert.equal(formatKopecks(185000).replace(/\u00a0/g, " "), "1 850,00 ₽");
  assert.equal(formatKopecks(0).replace(/\u00a0/g, " "), "0,00 ₽");
});

test("разбор рублей из формы", () => {
  assert.equal(parseRublesToKopecks("1850"), 185000);
  assert.equal(parseRublesToKopecks("1 850,50"), 185050);
  assert.equal(parseRublesToKopecks("1850.5"), 185050);
  assert.equal(parseRublesToKopecks(""), null);
  assert.equal(parseRublesToKopecks("abc"), null);
  assert.equal(parseRublesToKopecks("-5"), null);
});

test("обратное преобразование для input", () => {
  assert.equal(kopecksToInput(185050), "1850.50");
});
