import { test } from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath } from "../src/lib/safe-redirect";

test("callbackUrl: только внутренние пути", () => {
  assert.equal(safeInternalPath("/r/101"), "/r/101");
  assert.equal(safeInternalPath("/admin?x=1"), "/admin?x=1");
  assert.equal(safeInternalPath("//evil.example"), "/");
  assert.equal(safeInternalPath("https://evil.example"), "/");
  assert.equal(safeInternalPath(""), "/");
  assert.equal(safeInternalPath(undefined), "/");
});
