"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { isMeetingLockedForCommittee } from "@/lib/committeeReviewSession";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";
import { REVIEW_MEETING_DATES } from "@/lib/reviewMeetingAgenda";

export type CommitteeSummaryActionState = { error?: string; message?: string };

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

export async function submitAllCommitteeToPoAction(
  _prev: CommitteeSummaryActionState,
  _formData: FormData,
): Promise<CommitteeSummaryActionState> {
  const gate = await requireCommitteeUser();
  if (!gate.ok) return { error: gate.error };

  for (const d of REVIEW_MEETING_DATES) {
    if (await isMeetingLockedForCommittee(gate.id, d)) {
      return { error: "評分已由 PO 鎖定，無法變更" };
    }
  }

  await ensureEvaluationSchema();

  const evalCount = await prisma.evaluation.count({ where: { committeeId: gate.id } });
  if (evalCount === 0) return { error: "尚無任何評分，請先完成至少一案評分" };

  const now = new Date();
  await prisma.$transaction([
    prisma.evaluation.updateMany({
      where: { committeeId: gate.id },
      data: { status: "SUBMITTED" },
    }),
    ...REVIEW_MEETING_DATES.map((meetingDate) =>
      prisma.committeeReviewSession.upsert({
        where: { committeeId_meetingDate: { committeeId: gate.id, meetingDate } },
        create: {
          committeeId: gate.id,
          meetingDate,
          status: "SUBMITTED_TO_PO",
          submittedAt: now,
        },
        update: {
          status: "SUBMITTED_TO_PO",
          submittedAt: now,
        },
      }),
    ),
  ]);

  revalidatePath("/committee/summary");
  revalidatePath("/admin/review-progress");
  revalidatePath("/admin/settlement");
  return { message: "已確認送出給專案辦公室，您仍可繼續修改評分，直至 PO 鎖定。" };
}
