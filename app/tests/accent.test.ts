import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCENT_COLORS,
  contrastWithWhite,
  hexToHsl,
  normalizeHex,
} from "../src/lib/accent-colors";

test("палитра проходит контраст с белым текстом", () => {
  for (const color of ACCENT_COLORS) {
    assert.ok(contrastWithWhite(color.hex) >= 4.5, `${color.label}: контраст ниже AA`);
  }
});

test("HEX нормализуется и переводится в HSL", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("#2563EB"), "#2563eb");
  assert.equal(normalizeHex("2563EB"), null);
  assert.equal(normalizeHex("#xyz"), null);
  assert.equal(hexToHsl("#ffffff"), "0 0% 100%");
  assert.equal(hexToHsl("#000000"), "0 0% 0%");
});
