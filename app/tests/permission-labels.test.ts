import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION_LABELS } from "../src/lib/permission-labels";
import { PERMISSIONS } from "../src/lib/rbac";

test("каждое право имеет русскую подпись без английского fallback", () => {
  assert.deepEqual(
    Object.keys(PERMISSION_LABELS).sort(),
    [...PERMISSIONS].sort(),
  );
  for (const code of PERMISSIONS) {
    const label = PERMISSION_LABELS[code];
    assert.ok(label && label !== code, `${code}: нет русской подписи`);
    assert.match(label, /[А-Яа-яЁё]/, `${code}: подпись должна быть на русском`);
  }
});
