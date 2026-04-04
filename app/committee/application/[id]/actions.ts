"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isCommitteeVisibleStatus } from "@/lib/committeeApplicationStatuses";
import { prisma } from "@/lib/prisma";

export type SaveEvaluationState = { error?: string; message?: string };

async function requireCommitteeUser(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) {
    return { ok: false, error: "未登入" };
  }
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!user || user.role !== Role.COMMITTEE) {
    return { ok: false, error: "僅限審查委員" };
  }
  return { ok: true, id: user.id };
}

export async function saveCommitteeEvaluationAction(
  _prev: SaveEvaluationState,
  formData: FormData,
): Promise<SaveEvaluationState> {
  const gate = await requireCommitteeUser();
  if (!gate.ok) {
    return { error: gate.error };
  }

  const applicationId = String(formData.get("applicationId") || "").trim();
  const scoreRaw = formData.get("score");
  const comment = String(formData.get("comment") || "").trim();

  if (!applicationId) {
    return { error: "缺少案件 ID" };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  });
  if (!app) {
    return { error: "找不到案件" };
  }
  if (!isCommitteeVisibleStatus(app.status)) {
    return { error: "此案件狀態不開放委員評分" };
  }

  const score =
    typeof scoreRaw === "string"
      ? parseFloat(scoreRaw)
      : typeof scoreRaw === "number"
        ? scoreRaw
        : NaN;
  if (!Number.isFinite(score)) {
    return { error: "請填寫有效分數（數字）" };
  }
  if (score < 0 || score > 100) {
    return { error: "分數請介於 0～100" };
  }

  await prisma.evaluation.upsert({
    where: {
      applicationId_committeeId: {
        applicationId,
        committeeId: gate.id,
      },
    },
    create: {
      applicationId,
      committeeId: gate.id,
      score,
      comment: comment.length > 0 ? comment : null,
    },
    update: {
      score,
      comment: comment.length > 0 ? comment : null,
    },
  });

  revalidatePath(`/committee/application/${applicationId}`);
  revalidatePath("/committee/dashboard");
  return { message: "已儲存評分" };
}
