-- CreateTable
CREATE TABLE "RoomStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "externalRef" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "nextAttemptAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoomStatusEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cleaningStatus" TEXT NOT NULL DEFAULT 'CLEAN',
    "cleaningStatusUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cleaningStatusSource" TEXT NOT NULL DEFAULT 'LOCAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("cleaningStatus", "createdAt", "floor", "id", "isActive", "number", "roomTypeId", "updatedAt") SELECT "cleaningStatus", "createdAt", "floor", "id", "isActive", "number", "roomTypeId", "updatedAt" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");
CREATE INDEX "Room_floor_idx" ON "Room"("floor");
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RoomStatusEvent_eventId_key" ON "RoomStatusEvent"("eventId");

-- CreateIndex
CREATE INDEX "RoomStatusEvent_direction_state_nextAttemptAt_idx" ON "RoomStatusEvent"("direction", "state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RoomStatusEvent_roomId_createdAt_idx" ON "RoomStatusEvent"("roomId", "createdAt");
