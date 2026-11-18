import assert from "node:assert/strict";
import { test } from "node:test";

import {
  moduleForPath,
  sanitizeMetadata,
  serializeMetadata,
} from "../src/server/services/logging";

test("log metadata redacts secrets at any nesting level", () => {
  const clean = sanitizeMetadata({
    password: "plain",
    token: "abc",
    nested: { secret: "hidden", authorization: "Bearer x", ok: "visible" },
    list: [{ cookie: "session", value: "keep" }],
  });
  assert.deepEqual(clean, {
    password: "[redacted]",
    token: "[redacted]",
    nested: { secret: "[redacted]", authorization: "[redacted]", ok: "visible" },
    list: [{ cookie: "[redacted]", value: "keep" }],
  });
});

test("log metadata is bounded and serializable", () => {
  const serialized = serializeMetadata({ message: "x".repeat(1000), count: 3 });
  assert.ok(serialized);
  assert.ok(serialized.length <= 4001);
  assert.equal(JSON.parse(serialized).count, 3);
});

test("tRPC paths map to stable logging modules", () => {
  assert.equal(moduleForPath("auth.me"), "auth");
  assert.equal(moduleForPath("users.updateProfile"), "users");
  assert.equal(moduleForPath("catalog.create"), "catalog");
  assert.equal(moduleForPath("operations.receive"), "warehouse");
  assert.equal(moduleForPath("audit.start"), "audit");
  assert.equal(moduleForPath("cleaning.create"), "cleaning");
  assert.equal(moduleForPath("checklists.list"), "checklists");
  assert.equal(moduleForPath("qr.generate"), "qr");
  assert.equal(moduleForPath("reports.export"), "reports");
  assert.equal(moduleForPath("integration.save"), "integration");
  assert.equal(moduleForPath("settings.get"), "settings");
  assert.equal(moduleForPath("unknown.path"), "system");
});
