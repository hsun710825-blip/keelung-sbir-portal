"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import {
  EmailNotificationStatus,
  EmailNotificationType,
  Role,
} from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import { isApplicationStatusString } from "@/lib/applicationStatusOptions";
import { buildStatusUpdateMailBodies, sendStatusUpdateEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

/**
 * 更新狀態、adminRemarks、寫入歷程、寄送通知信並記錄 EmailNotification。
 * 預留 PRE_REVIEW_PASSED 等狀態供前端後續開放「複審簡報上傳」等功能銜接。
 */
export async function updateApplicationStatusAction(
  applicationId: string,
  nextStatusRaw: string,
  adminRemarks: string,
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

  const remarks = adminRemarks ?? "";

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      title: true,
      applicant: { select: { id: true, email: true, name: true } },
    },
  });
  if (!app) {
    return { ok: false, error: "找不到案件" };
  }

  const applicantEmail = app.applicant.email?.trim();
  if (!applicantEmail) {
    return { ok: false, error: "申請人缺少 email，無法寄送通知" };
  }

  const statusLabelZh = applicationStatusLabel(nextStatusRaw);
  const planTitle = app.title?.trim() || "未命名計畫";
  const applicantName = app.applicant.name?.trim() || "申請者";

  const historyNote =
    remarks.trim().length > 0 ? remarks.trim().slice(0, 4000) : null;

  const statusChanged = nextStatusRaw !== app.status;
  const announcement = statusChanged ? "status_changed" : "remarks_only";

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: nextStatusRaw,
        adminRemarks: remarks.trim() ? remarks.trim() : null,
      },
    });
    if (statusChanged) {
      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: app.status,
          toStatus: nextStatusRaw,
          changedByUserId: adminUser.id,
          note: historyNote,
        },
      });
    }
  });

  const bodies = buildStatusUpdateMailBodies({
    applicantDisplayName: applicantName,
    planTitle,
    statusLabelZh,
    adminRemarksText: remarks,
    announcement,
  });

  let mailError: string | null = null;
  let messageId: string | undefined;
  let mockMail = false;
  try {
    const sent = await sendStatusUpdateEmail({
      to: applicantEmail,
      applicantDisplayName: applicantName,
      planTitle,
      statusLabelZh,
      adminRemarksText: remarks,
      announcement,
    });
    messageId = sent.messageId;
    mockMail = sent.mock;
  } catch (e) {
    mailError = e instanceof Error ? e.message : String(e);
  }

  const notifStatus =
    mailError != null
      ? EmailNotificationStatus.FAILED
      : EmailNotificationStatus.SENT;

  await prisma.emailNotification.create({
    data: {
      applicationId,
      relatedUserId: app.applicant.id,
      type: EmailNotificationType.STATUS_CHANGED,
      status: notifStatus,
      toEmail: applicantEmail,
      subject: bodies.subject,
      body: bodies.html,
      payloadJson: JSON.stringify({
        status: nextStatusRaw,
        statusLabelZh,
        adminRemarks: remarks,
        announcement,
        statusChanged,
        mock: mockMail,
        messageId: messageId ?? null,
      }),
      providerMessageId: messageId ?? null,
      errorMessage: mailError,
    },
  });

  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/application/${applicationId}`);
  return { ok: true };
}
