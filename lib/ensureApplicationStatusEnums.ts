import { prisma } from "@/lib/prisma";

const APPLICATION_STATUS_ENUM_VALUES = ["IMPORTANT_NOTICE"] as const;

/** 正式 DB 若尚未跑 migration，寫入新狀態會失敗。以 IF NOT EXISTS 補齊（冪等）。 */
export async function ensureApplicationStatusEnumValues(): Promise<void> {
  for (const value of APPLICATION_STATUS_ENUM_VALUES) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    } catch (e) {
      console.warn(`[ensureApplicationStatusEnumValues] ${value}:`, e instanceof Error ? e.message : e);
    }
  }
}
