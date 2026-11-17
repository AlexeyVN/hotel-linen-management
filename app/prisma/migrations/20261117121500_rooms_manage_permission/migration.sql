-- Настройки номеров/типов доступны только ADMIN (rooms.manage).
INSERT OR IGNORE INTO "Permission" ("id", "code", "description")
VALUES ('perm_rooms_manage', 'rooms.manage', 'Настройки номеров и типов (только ADMIN)');

INSERT OR IGNORE INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r, "Permission" p
WHERE r."code" = 'ADMIN' AND p."code" = 'rooms.manage';

DELETE FROM "RolePermission"
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "code" = 'MANAGER')
  AND "permissionId" IN (SELECT "id" FROM "Permission" WHERE "code" IN ('rooms.write', 'rooms.manage'));
