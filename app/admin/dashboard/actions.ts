"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export type DeleteApplicationResult = { ok: true } | { ok: false; error: string };
export type BulkDeleteApplicationResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!email) return { ok: false as const, error: "未登入" };
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { role: true },
  });
  if (!user || user.role !== Role.ADMIN) {
    return { ok: false as const, error: "僅限管理員操作" };
  }
  return { ok: true as const };
}

export async function deleteApplicationAction(applicationId: string): Promise<DeleteApplicationResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const id = String(applicationId || "").trim();
  if (!id) return { ok: false, error: "缺少案件 ID" };

  try {
    await prisma.application.delete({ where: { id } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "刪除失敗";
    return { ok: false, error: msg.includes("Record to delete does not exist") ? "案件不存在或已刪除" : "刪除失敗" };
  }

  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export async function bulkDeleteApplicationsAction(ids: string[]): Promise<BulkDeleteApplicationResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const cleanedIds = (ids ?? []).map((id) => String(id || "").trim()).filter(Boolean);
  if (cleanedIds.length === 0) return { ok: false, error: "未選取任何案件" };

  try {
    const result = await prisma.application.deleteMany({
      where: { id: { in: cleanedIds } },
    });
    revalidatePath("/admin/dashboard");
    return { ok: true, deletedCount: result.count };
  } catch {
    return { ok: false, error: "批次刪除失敗" };
  }
}

