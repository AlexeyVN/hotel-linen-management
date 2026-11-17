-- AlterTable
ALTER TABLE "WarehouseInventory" ADD COLUMN "lastReceiptAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "priceKopecks" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("categoryId", "createdAt", "externalId", "id", "isActive", "name", "unit", "updatedAt") SELECT "categoryId", "createdAt", "externalId", "id", "isActive", "name", "unit", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_externalId_key" ON "Item"("externalId");
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");
CREATE INDEX "Item_externalId_idx" ON "Item"("externalId");
CREATE TABLE "new_Operation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "roomId" TEXT,
    "userId" TEXT NOT NULL,
    "clientOpId" TEXT,
    "comment" TEXT,
    "reason" TEXT,
    "documentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Operation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Operation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Operation" ("clientOpId", "comment", "createdAt", "id", "reason", "roomId", "type", "userId") SELECT "clientOpId", "comment", "createdAt", "id", "reason", "roomId", "type", "userId" FROM "Operation";
DROP TABLE "Operation";
ALTER TABLE "new_Operation" RENAME TO "Operation";
CREATE UNIQUE INDEX "Operation_clientOpId_key" ON "Operation"("clientOpId");
CREATE INDEX "Operation_createdAt_idx" ON "Operation"("createdAt");
CREATE INDEX "Operation_type_idx" ON "Operation"("type");
CREATE INDEX "Operation_roomId_idx" ON "Operation"("roomId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
