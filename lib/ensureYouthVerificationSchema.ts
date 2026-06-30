import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureYouthVerificationSchema(): Promise<void> {
  if (ensured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "YouthVerificationPerson" (
      "applicationId" TEXT NOT NULL,
      "personIndex" INTEGER NOT NULL,
      "responsibleName" TEXT,
      "registeredCity" TEXT,
      "age" INTEGER,
      "qualifies" BOOLEAN,
      "poSaved" BOOLEAN NOT NULL DEFAULT false,
      "sourceDriveFileId" TEXT,
      "ocrRocBirthYear" INTEGER,
      "ocrAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "YouthVerificationPerson_pkey" PRIMARY KEY ("applicationId", "personIndex")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "YouthVerificationPerson_applicationId_idx"
      ON "YouthVerificationPerson"("applicationId");
  `);

  ensured = true;
}
