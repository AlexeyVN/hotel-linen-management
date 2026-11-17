-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "extraOptionText" TEXT,
    CONSTRAINT "ChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "comment" TEXT,
    "photoFileName" TEXT,
    "photoMimeType" TEXT,
    "photoSizeBytes" INTEGER,
    "answeredById" TEXT NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistAnswer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CleaningTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistAnswer_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CleaningTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "plannedMinutes" INTEGER,
    "comment" TEXT,
    "checklistTemplateId" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CleaningTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CleaningTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CleaningTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CleaningTask_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CleaningTask" ("assigneeId", "comment", "createdAt", "createdById", "finishedAt", "id", "plannedMinutes", "priority", "roomId", "startedAt", "status", "type", "updatedAt") SELECT "assigneeId", "comment", "createdAt", "createdById", "finishedAt", "id", "plannedMinutes", "priority", "roomId", "startedAt", "status", "type", "updatedAt" FROM "CleaningTask";
DROP TABLE "CleaningTask";
ALTER TABLE "new_CleaningTask" RENAME TO "CleaningTask";
CREATE INDEX "CleaningTask_assigneeId_status_idx" ON "CleaningTask"("assigneeId", "status");
CREATE INDEX "CleaningTask_roomId_idx" ON "CleaningTask"("roomId");
CREATE INDEX "CleaningTask_createdAt_idx" ON "CleaningTask"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChecklistItem_templateId_sortOrder_idx" ON "ChecklistItem"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_taskId_idx" ON "ChecklistAnswer"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistAnswer_taskId_itemId_key" ON "ChecklistAnswer"("taskId", "itemId");
