import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveWriteOffReason, type ReasonOption } from "../src/lib/domain/writeoff";

const reasons: ReasonOption[] = [
  { code: "DAMAGE", name: "Порча" },
  { code: "WEAR", name: "Износ" },
];

test("причина из справочника принимается", () => {
  const result = resolveWriteOffReason({ reasonCode: "DAMAGE" }, reasons);
  assert.deepEqual(result, { ok: true, reason: "Порча" });
});

test("свободный текст без справочника принимается", () => {
  const result = resolveWriteOffReason({ reasonText: "  Пятна от вина  " }, reasons);
  assert.deepEqual(result, { ok: true, reason: "Пятна от вина" });
});

test("справочник + текст сохраняются вместе", () => {
  const result = resolveWriteOffReason(
    { reasonCode: "WEAR", reasonText: "истёрлось после 40 стирок" },
    reasons,
  );
  assert.deepEqual(result, { ok: true, reason: "Износ: истёрлось после 40 стирок" });
});

test("пустая причина отклоняется", () => {
  const result = resolveWriteOffReason({}, reasons);
  assert.equal(result.ok, false);
});

test("причина из пробелов считается пустой", () => {
  const result = resolveWriteOffReason({ reasonText: "   " }, reasons);
  assert.equal(result.ok, false);
});

test("несуществующий код отклоняется", () => {
  const result = resolveWriteOffReason({ reasonCode: "UNKNOWN" }, reasons);
  assert.equal(result.ok, false);
});

test("слишком длинный текст отклоняется", () => {
  const result = resolveWriteOffReason({ reasonText: "x".repeat(201) }, reasons);
  assert.equal(result.ok, false);
});
