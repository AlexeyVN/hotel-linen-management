-- CreateTable
CREATE TABLE "LogEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'info',
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT,
    "message" TEXT,
    "userId" TEXT,
    "userLogin" TEXT,
    "userRole" TEXT,
    "requestId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "metadata" TEXT
);

-- CreateIndex
CREATE INDEX "LogEvent_createdAt_idx" ON "LogEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LogEvent_module_createdAt_idx" ON "LogEvent"("module", "createdAt");

-- CreateIndex
CREATE INDEX "LogEvent_level_createdAt_idx" ON "LogEvent"("level", "createdAt");

-- CreateIndex
CREATE INDEX "LogEvent_userId_createdAt_idx" ON "LogEvent"("userId", "createdAt");

-- Seed the admin-only diagnostic log permission.
INSERT OR IGNORE INTO "Permission" ("id", "code", "description")
VALUES (lower(hex(randomblob(12))), 'logs.view', 'View operational event log');

INSERT OR IGNORE INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r, "Permission" p
WHERE r."code" = 'ADMIN' AND p."code" = 'logs.view';
