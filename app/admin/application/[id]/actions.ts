"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isApplicationStatusString } from "@/lib/applicationStatusOptions";
import { prisma } from "@/lib/prisma";

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

export async function updateApplicationStatusAction(
  applicationId: string,
  nextStatusRaw: string,
): Promise<UpdateStatusResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email || session.user.role !== Role.ADMIN) {
    return { ok: false, error: "僅限管理員（ADMIN）操作" };
  }

  const adminUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!adminUser || adminUser.role !== Role.ADMIN) {
    return { ok: false, error: "僅限管理員（ADMIN）操作" };
  }

  if (!isApplicationStatusString(nextStatusRaw)) {
    return { ok: false, error: "無效的狀態值" };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  });
  if (!app) {
    return { ok: false, error: "找不到案件" };
  }

  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: nextStatusRaw },
    }),
    prisma.applicationStatusHistory.create({
      data: {
        applicationId,
        fromStatus: app.status,
        toStatus: nextStatusRaw,
        changedByUserId: adminUser.id,
      },
    }),
  ]);

  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/application/${applicationId}`);
  return { ok: true };
}
