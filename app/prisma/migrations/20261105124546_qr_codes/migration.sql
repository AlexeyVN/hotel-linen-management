-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectType" TEXT NOT NULL,
    "roomId" TEXT,
    "itemId" TEXT,
    "code" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "payloadFormat" TEXT NOT NULL,
    "imageFormat" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "baseUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QrCode_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QrCode_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_roomId_key" ON "QrCode"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_itemId_key" ON "QrCode"("itemId");

-- CreateIndex
CREATE INDEX "QrCode_objectType_code_idx" ON "QrCode"("objectType", "code");
