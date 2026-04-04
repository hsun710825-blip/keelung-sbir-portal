"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export type GrantRoleState = { error?: string; message?: string };

async function requireAdminUserId(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) {
    return { ok: false, error: "未登入" };
  }
  const admin = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!admin || admin.role !== Role.ADMIN) {
    return { ok: false, error: "僅限管理員（ADMIN）" };
  }
  return { ok: true, id: admin.id };
}

/**
 * 預先授權：依 email upsert User 並設定 ADMIN 或 COMMITTEE（不區分大小寫比對既有 email）。
 */
export async function grantBackofficeRoleAction(
  _prev: GrantRoleState,
  formData: FormData,
): Promise<GrantRoleState> {
  const gate = await requireAdminUserId();
  if (!gate.ok) {
    return { error: gate.error };
  }

  const rawEmail = String(formData.get("email") || "").trim();
  const roleRaw = String(formData.get("role") || "").trim();
  const emailNorm = rawEmail.toLowerCase();

  if (!emailNorm || !emailNorm.includes("@")) {
    return { error: "請輸入有效的 Gmail／Email" };
  }
  if (roleRaw !== Role.ADMIN && roleRaw !== Role.COMMITTEE) {
    return { error: "請選擇角色（管理員或審查委員）" };
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: roleRaw as Role },
    });
  } else {
    await prisma.user.create({
      data: {
        email: emailNorm,
        role: roleRaw as Role,
      },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { message: `已將 ${emailNorm} 設為「${roleRaw === Role.ADMIN ? "管理員" : "審查委員"}」` };
}

export type RevokeRoleResult = { ok: true } | { ok: false; error: string };

/**
 * 移除後台權限：將 role 改回 USER（僅能操作目前為 ADMIN 或 COMMITTEE 的帳號）。
 */
export async function revokeBackofficeRoleAction(userId: string): Promise<RevokeRoleResult> {
  const gate = await requireAdminUserId();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) {
    return { ok: false, error: "找不到使用者" };
  }
  if (target.role !== Role.ADMIN && target.role !== Role.COMMITTEE) {
    return { ok: false, error: "該帳號非後台角色，無需移除" };
  }
  if (target.id === gate.id) {
    return { ok: false, error: "不可移除自己的管理員權限" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: Role.USER },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
