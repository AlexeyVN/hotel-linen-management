import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ROLE_PRESETS,
  canAccessRoom,
  defaultRouteForRole,
  hasPermission,
  type SessionUser,
} from "../src/lib/rbac";

function user(roleCode: string, permissions: SessionUser["permissions"], roomIds: string[] = []): SessionUser {
  return {
    id: "u1",
    login: "test",
    fullName: "Тест",
    roleCode,
    roleName: roleCode,
    permissions,
    roomIds,
  };
}

test("администратор имеет все права из пресета", () => {
  const admin = user("ADMIN", [...ROLE_PRESETS.ADMIN]);
  assert.equal(hasPermission(admin, "users.manage"), true);
  assert.equal(hasPermission(admin, "roles.manage"), true);
  assert.equal(hasPermission(admin, "settings.integration"), true);
});

test("менеджер не управляет пользователями и ролями", () => {
  const manager = user("MANAGER", [...ROLE_PRESETS.MANAGER]);
  assert.equal(hasPermission(manager, "users.manage"), false);
  assert.equal(hasPermission(manager, "roles.manage"), false);
  assert.equal(hasPermission(manager, "warehouse.receive"), true);
});

test("горничная не имеет складских прав", () => {
  const maid = user("MAID", [...ROLE_PRESETS.MAID]);
  assert.equal(hasPermission(maid, "warehouse.receive"), false);
  assert.equal(hasPermission(maid, "audit.create"), true);
  assert.equal(hasPermission(maid, "reports.view"), false);
});

test("горничная видит только назначенные номера", () => {
  const maid = user("MAID", [...ROLE_PRESETS.MAID], ["room-1"]);
  assert.equal(canAccessRoom(maid, "room-1"), true);
  assert.equal(canAccessRoom(maid, "room-2"), false);
});

test("администратор видит любой номер", () => {
  const admin = user("ADMIN", [...ROLE_PRESETS.ADMIN]);
  assert.equal(canAccessRoom(admin, "room-9"), true);
});

test("маршрут по умолчанию: горничная — /m, остальные — /admin", () => {
  assert.equal(defaultRouteForRole("MAID"), "/m");
  assert.equal(defaultRouteForRole("ADMIN"), "/admin");
  assert.equal(defaultRouteForRole("MANAGER"), "/admin");
});
