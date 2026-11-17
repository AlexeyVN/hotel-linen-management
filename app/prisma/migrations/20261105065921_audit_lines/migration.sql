-- CreateTable
CREATE TABLE "AuditLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditSessionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "factQty" INTEGER NOT NULL,
    CONSTRAINT "AuditLine_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "AuditSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuditLine_itemId_idx" ON "AuditLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLine_auditSessionId_itemId_key" ON "AuditLine"("auditSessionId", "itemId");
