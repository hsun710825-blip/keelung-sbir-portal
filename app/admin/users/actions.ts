"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import {
  canManageBackofficeAccounts,
  normalizeEmailForCompare,
  roleDisplayLabel,
  SUPER_ADMIN_EMAIL_FORCED,
} from "@/lib/rbac";

export type GrantRoleState = { error?: string; message?: string };

const GRANTABLE: Role[] = [Role.ADMIN, Role.GOV, Role.REVIEWER];
const GRANTABLE_STR = new Set(["ADMIN", "GOV", "REVIEWER"]);

async function persistUserRole(emailNorm: string, role: Role, existingId: string | undefined) {
  try {
    if (existingId) {
      await prisma.user.update({ where: { id: existingId }, data: { role } });
    } else {
      await prisma.user.create({ data: { email: emailNorm, role } });
    }
  } catch (e) {
    if (role === Role.REVIEWER) {
      const fallback = Role.COMMITTEE;
      if (existingId) {
        await prisma.user.update({ where: { id: existingId }, data: { role: fallback } });
      } else {
        await prisma.user.create({ data: { email: emailNorm, role: fallback } });
      }
      return;
    }
    if (role === Role.GOV) {
      throw new Error("資料庫尚未支援 GOV 角色，請先執行 RBAC migration");
    }
    throw e;
  }
}

async function requireSuperAdminUserId(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) {
    return { ok: false, error: "未登入" };
  }
  if (!canManageBackofficeAccounts(session.user.role)) {
    return { ok: false, error: "僅限最高管理員（SUPER_ADMIN）操作帳號權限" };
  }
  const admin = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!admin) {
    return { ok: false, error: "找不到操作者帳號" };
  }
  return { ok: true, id: admin.id };
}

function isBackofficeAssignableRole(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "GOV" || role === "REVIEWER" || role === "COMMITTEE";
}

/**
 * 預先授權：依 email upsert User 並設定 PO／市府／委員（僅 SUPER_ADMIN 可操作）。
 */
export async function grantBackofficeRoleAction(
  _prev: GrantRoleState,
  formData: FormData,
): Promise<GrantRoleState> {
  const gate = await requireSuperAdminUserId();
  if (!gate.ok) {
    return { error: gate.error };
  }

  const rawEmail = String(formData.get("email") || "").trim();
  const roleRaw = String(formData.get("role") || "").trim();
  const emailNorm = rawEmail.toLowerCase();

  if (!emailNorm || !emailNorm.includes("@")) {
    return { error: "請輸入有效的 Gmail／Email" };
  }
  if (!GRANTABLE_STR.has(roleRaw)) {
    return { error: "請選擇 PO人員、市府人員或審查委員" };
  }
  const roleToWrite = roleRaw as Role;

  const existing = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true },
  });

  await persistUserRole(emailNorm, roleToWrite, existing?.id);

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { message: `已將 ${emailNorm} 設為「${roleDisplayLabel(roleToWrite)}」` };
}

export type RevokeRoleResult = { ok: true } | { ok: false; error: string };

/**
 * 移除後台權限：將 role 改回 USER（僅 SUPER_ADMIN；不可動受保護之最高管理員帳號）。
 */
export async function revokeBackofficeRoleAction(userId: string): Promise<RevokeRoleResult> {
  const gate = await requireSuperAdminUserId();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!target) {
    return { ok: false, error: "找不到使用者" };
  }
  if (!isBackofficeAssignableRole(target.role)) {
    return { ok: false, error: "該帳號非後台角色，無需移除" };
  }
  if (normalizeEmailForCompare(target.email) === normalizeEmailForCompare(SUPER_ADMIN_EMAIL_FORCED)) {
    return { ok: false, error: "不可移除受保護之最高管理員帳號" };
  }
  if (target.id === gate.id) {
    return { ok: false, error: "不可透過此流程移除自己的後台權限" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: Role.USER },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
