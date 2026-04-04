-- AlterTable
ALTER TABLE "Application" ADD COLUMN "driveProjectFolderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Application_driveProjectFolderId_key" ON "Application"("driveProjectFolderId");
