import { prisma } from "@/lib/prisma";

/** 與 prisma/migrations/20260505120000_rbac_roles 一致 */
const RBAC_ROLE_ENUM_VALUES = ["SUPER_ADMIN", "GOV", "REVIEWER"] as const;

/**
 * 正式 DB 若尚未跑 migration，寫入 GOV/REVIEWER 會失敗。
 * 以 IF NOT EXISTS 補齊 PostgreSQL enum（冪等、可重複呼叫）。
 */
export async function ensureRbacRoleEnumValues(): Promise<void> {
  for (const value of RBAC_ROLE_ENUM_VALUES) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS '${value}'`);
    } catch (e) {
      console.warn(`[ensureRbacRoleEnumValues] ${value}:`, e instanceof Error ? e.message : e);
    }
  }
}
