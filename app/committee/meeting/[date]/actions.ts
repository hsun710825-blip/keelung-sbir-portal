"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isCommitteeVisibleStatus } from "@/lib/committeeApplicationStatuses";
import { isMeetingLockedForCommittee } from "@/lib/committeeReviewSession";
import {
  computeTotalScore,
  parseScoreBreakdownFromFormData,
  serializeScoresJson,
} from "@/lib/committeeScoringRubric";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";
import { isReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

import { findNextMeetingApplicationId } from "@/lib/committeeNextApplication";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

export type CommitteeMeetingActionState = {
  error?: string;
  message?: string;
  submitted?: {
    planTitle: string;
    totalScore: number;
    meetingDate: string;
    nextApplicationId: string | null;
  };
};

async function requireCommitteeUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) return { ok: false as const, error: "未登入" };
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, role: true },
  });
  if (!user || !isReviewerRole(user.role)) return { ok: false as const, error: "僅限審查委員" };
  return { ok: true as const, id: user.id };
}

export async function submitCommitteeMeetingToPoAction(
  _prev: CommitteeMeetingActionState,
  formData: FormData,
): Promise<CommitteeMeetingActionState> {
  const gate = await requireCommitteeUser();
  if (!gate.ok) return { error: gate.error };

  const meetingDate = String(formData.get("meetingDate") || "").trim();
  if (!isReviewMeetingDate(meetingDate)) return { error: "無效的審查場次" };

  if (await isMeetingLockedForCommittee(gate.id, meetingDate)) {
    return { error: "此場次已由 PO 鎖定，無法變更" };
  }

  await ensureEvaluationSchema();

  const evals = await prisma.evaluation.findMany({
    where: { committeeId: gate.id, meetingDate },
    select: { id: true },
  });

  if (evals.length === 0) {
    return { error: "尚無任何評分，請先完成至少一案評分" };
  }

  await prisma.$transaction([
    prisma.evaluation.updateMany({
      where: { committeeId: gate.id, meetingDate },
      data: { status: "SUBMITTED" },
    }),
    prisma.committeeReviewSession.upsert({
      where: { committeeId_meetingDate: { committeeId: gate.id, meetingDate } },
      create: {
        committeeId: gate.id,
        meetingDate,
        status: "SUBMITTED_TO_PO",
        submittedAt: new Date(),
      },
      update: {
        status: "SUBMITTED_TO_PO",
        submittedAt: new Date(),
      },
    }),
  ]);

  revalidatePath(`/committee/meeting/${meetingDate}/summary`);
  revalidatePath(`/committee/meeting/${meetingDate}`);
  revalidatePath("/admin/review-progress");
  return { message: "已確認送出給專案辦公室，您仍可繼續修改評分，直至 PO 鎖定。" };
}

export async function saveCommitteeScoringAction(
  _prev: CommitteeMeetingActionState,
  formData: FormData,
): Promise<CommitteeMeetingActionState> {
  const gate = await requireCommitteeUser();
  if (!gate.ok) return { error: gate.error };

  const applicationId = String(formData.get("applicationId") || "").trim();
  const meetingDate = String(formData.get("meetingDate") || "").trim();
  const comment = String(formData.get("comment") || "").trim();

  if (!applicationId) return { error: "缺少案件 ID" };
  if (!isReviewMeetingDate(meetingDate)) return { error: "無效的審查場次" };

  if (await isMeetingLockedForCommittee(gate.id, meetingDate)) {
    return { error: "此場次已由 PO 鎖定，無法修改評分" };
  }

  const breakdown = parseScoreBreakdownFromFormData(formData);
  if ("error" in breakdown) return { error: breakdown.error };

  const total = computeTotalScore(breakdown);

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, title: true, status: true, reviewMeetingDate: true },
  });
  if (!app) return { error: "找不到案件" };
  if (!isCommitteeVisibleStatus(app.status)) return { error: "此案件狀態不開放委員評分" };
  if (app.reviewMeetingDate && app.reviewMeetingDate !== meetingDate) {
    return { error: "此案件不屬於目前審查場次" };
  }

  await ensureEvaluationSchema();

  await prisma.evaluation.upsert({
    where: {
      applicationId_committeeId: { applicationId, committeeId: gate.id },
    },
    create: {
      applicationId,
      committeeId: gate.id,
      score: total,
      comment: comment || null,
      status: "DRAFT",
      scoresJson: serializeScoresJson(breakdown),
      meetingDate,
    },
    update: {
      score: total,
      comment: comment || null,
      status: "DRAFT",
      scoresJson: serializeScoresJson(breakdown),
      meetingDate,
    },
  });

  revalidatePath(`/committee/application/${applicationId}`);
  revalidatePath("/committee/summary");
  revalidatePath(`/committee/meeting/${meetingDate}`);
  revalidatePath("/admin/review-progress");
  revalidatePath("/admin/settlement");

  const nextApplicationId = await findNextMeetingApplicationId(
    meetingDate as ReviewMeetingDate,
    applicationId,
  );

  return {
    submitted: {
      planTitle: app.title?.trim() || "（未命名計畫）",
      totalScore: total,
      meetingDate,
      nextApplicationId,
    },
  };
}
