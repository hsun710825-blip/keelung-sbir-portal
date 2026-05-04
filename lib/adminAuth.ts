import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeEmailForCompare, SUPER_ADMIN_EMAIL_FORCED } from "@/lib/rbac";

export { isBackofficePrismaRole } from "@/lib/backofficeRole";

/**
 * 依 email（不分大小寫）查詢 Prisma User.role；無列則 null。
 * 強制 SUPER_ADMIN Email；COMMITTEE 正規化為 REVIEWER（與新 RBAC 一致）。
 */
export async function getPrismaRoleByEmail(email: string | null | undefined): Promise<Role | null> {
  const em = String(email || "").trim();
  if (!em) return null;
  if (normalizeEmailForCompare(em) === normalizeEmailForCompare(SUPER_ADMIN_EMAIL_FORCED)) {
    return "SUPER_ADMIN" as Role;
  }
  const row = await prisma.user.findFirst({
    where: { email: { equals: em, mode: "insensitive" } },
    select: { role: true },
  });
  const raw = row?.role ?? null;
  if (raw === "COMMITTEE") return "REVIEWER" as Role;
  return raw;
}
