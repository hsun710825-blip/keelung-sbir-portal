-- 與 prisma/migrations/20260405120000_application_drive_project_folder 等效（供無 _prisma_migrations 的正式庫）
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "driveProjectFolderId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Application_driveProjectFolderId_key"
  ON "Application"("driveProjectFolderId");
