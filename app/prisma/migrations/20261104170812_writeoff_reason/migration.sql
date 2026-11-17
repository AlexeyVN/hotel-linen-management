-- AlterTable
ALTER TABLE "Operation" ADD COLUMN "reason" TEXT;

-- CreateTable
CREATE TABLE "WriteOffReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WriteOffReason_code_key" ON "WriteOffReason"("code");
