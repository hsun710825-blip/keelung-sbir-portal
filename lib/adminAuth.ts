import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export { isBackofficePrismaRole } from "@/lib/backofficeRole";

/**
 * 依 email（不分大小寫）查詢 Prisma User.role；無列則 null。
 * 後台權限一律由此與 JWT 承載，不再使用環境變數名單。
 */
export async function getPrismaRoleByEmail(email: string | null | undefined): Promise<Role | null> {
  const em = String(email || "").trim();
  if (!em) return null;
  const row = await prisma.user.findFirst({
    where: { email: { equals: em, mode: "insensitive" } },
    select: { role: true },
  });
  return row?.role ?? null;
}
