"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { canOperateApplications } from "@/lib/rbac";
import { isReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

export type ReviewProgressActionState = { error?: string; message?: string };

async function requirePoUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) return { ok: false as const, error: "未登入" };
  const role = session.user.role ?? null;
  if (!canOperateApplications(role)) return { ok: false as const, error: "僅限管理員" };
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) return { ok: false as const, error: "找不到使用者" };
  return { ok: true as const, id: user.id };
}

export async function lockCommitteeMeetingAction(
  _prev: ReviewProgressActionState,
  formData: FormData,
): Promise<ReviewProgressActionState> {
  const gate = await requirePoUser();
  if (!gate.ok) return { error: gate.error };

  const meetingDate = String(formData.get("meetingDate") || "").trim();
  const committeeId = String(formData.get("committeeId") || "").trim();
  if (!isReviewMeetingDate(meetingDate)) return { error: "無效的審查場次" };
  if (!committeeId) return { error: "缺少委員 ID" };

  await ensureEvaluationSchema();

  await prisma.$transaction([
    prisma.committeeReviewSession.upsert({
      where: { committeeId_meetingDate: { committeeId, meetingDate } },
      create: {
        committeeId,
        meetingDate,
        status: "LOCKED_BY_PO",
        lockedAt: new Date(),
        lockedByUserId: gate.id,
      },
      update: {
        status: "LOCKED_BY_PO",
        lockedAt: new Date(),
        lockedByUserId: gate.id,
      },
    }),
    prisma.evaluation.updateMany({
      where: { committeeId, meetingDate },
      data: { status: "LOCKED" },
    }),
  ]);

  revalidatePath("/admin/review-progress");
  revalidatePath(`/committee/meeting/${meetingDate}/summary`);
  revalidatePath(`/committee/meeting/${meetingDate}`);
  return { message: "已鎖定該委員於此場次之編輯權限" };
}
