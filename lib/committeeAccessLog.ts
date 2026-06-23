import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

export type CommitteeAccessLogRow = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  event: string;
  createdAt: Date;
};

let schemaEnsured = false;

async function ensureCommitteeAccessLogTable(): Promise<void> {
  if (schemaEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommitteeAccessLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "email" TEXT NOT NULL,
      "name" TEXT,
      "event" TEXT NOT NULL DEFAULT 'ACCESS_BLOCKED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CommitteeAccessLog_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommitteeAccessLog_email_idx" ON "CommitteeAccessLog"("email");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CommitteeAccessLog_createdAt_idx" ON "CommitteeAccessLog"("createdAt");
  `);
  schemaEnsured = true;
}

function newLogId(): string {
  return `cal_${randomBytes(12).toString("hex")}`;
}

/** 記錄指定委員於鎖定期嘗試進入後台。 */
export async function recordCommitteeAccessBlockedLog(input: {
  email: string;
  name?: string | null;
  userId?: string | null;
}): Promise<void> {
  const email = input.email.trim();
  if (!email) return;
  try {
    await ensureCommitteeAccessLogTable();
    await prisma.$executeRaw`
      INSERT INTO "CommitteeAccessLog" ("id", "userId", "email", "name", "event", "createdAt")
      VALUES (
        ${newLogId()},
        ${input.userId ?? null},
        ${email},
        ${input.name?.trim() || null},
        ${"ACCESS_BLOCKED"},
        CURRENT_TIMESTAMP
      )
    `;
  } catch (err) {
    console.info("[committee-access-log]", { email, err });
  }
}

export async function listCommitteeAccessLogs(limit = 200): Promise<CommitteeAccessLogRow[]> {
  try {
    await ensureCommitteeAccessLogTable();
    const rows = await prisma.$queryRaw<CommitteeAccessLogRow[]>`
      SELECT "id", "userId", "email", "name", "event", "createdAt"
      FROM "CommitteeAccessLog"
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
    return rows;
  } catch {
    return [];
  }
}
