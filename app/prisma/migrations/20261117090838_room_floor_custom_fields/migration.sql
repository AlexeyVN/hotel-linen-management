-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "floor" INTEGER,
    "floorName" TEXT,
    "roomTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cleaningStatus" TEXT NOT NULL DEFAULT 'CLEAN',
    "cleaningStatusUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cleaningStatusSource" TEXT NOT NULL DEFAULT 'LOCAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("cleaningStatus", "cleaningStatusSource", "cleaningStatusUpdatedAt", "createdAt", "floor", "id", "isActive", "number", "roomTypeId", "updatedAt") SELECT "cleaningStatus", "cleaningStatusSource", "cleaningStatusUpdatedAt", "createdAt", "floor", "id", "isActive", "number", "roomTypeId", "updatedAt" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");
CREATE INDEX "Room_floor_idx" ON "Room"("floor");
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
