"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isCommitteeVisibleStatus } from "@/lib/committeeApplicationStatuses";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";
import { isMissingEvaluationSchemaError } from "@/lib/safeCommitteeEvaluation";

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
  if (!user || !isReviewerRole(user.role)) {
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
  const rankRaw = formData.get("rank");
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

  const rankText = typeof rankRaw === "string" ? rankRaw.trim() : "";
  let rank: number | null = null;
  if (rankText.length > 0) {
    const parsed =
      typeof rankRaw === "string"
        ? parseInt(rankRaw, 10)
        : typeof rankRaw === "number"
          ? Math.trunc(rankRaw)
          : NaN;
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { error: "請填寫有效序位（正整數，1 為最佳）" };
    }
    rank = parsed;
  }

  const baseData = {
    score,
    comment: comment.length > 0 ? comment : null,
  };

  try {
    await ensureEvaluationSchema();
  } catch (error) {
    console.error("[committee/evaluation] ensure schema failed:", error);
    return {
      error: "無法初始化委員評分資料表，請聯絡管理員檢查資料庫權限。",
    };
  }

  const upsertWithRank = async () => {
    if (rank == null) {
      return { error: "請填寫序位（序位法為必填）" };
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
        ...baseData,
        rank,
      },
      update: {
        ...baseData,
        rank,
      },
    });
    return { message: "已儲存評分與序位" as const };
  };

  const upsertWithoutRank = async () => {
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
        ...baseData,
      },
      update: baseData,
    });
    return {
      message:
        rank != null
          ? ("已儲存分數與評語（序位欄位待資料庫更新後可寫入）" as const)
          : ("已儲存分數與評語" as const),
    };
  };

  try {
    const result = await upsertWithRank();
    if ("error" in result) return result;
  } catch (error) {
    if (!isMissingEvaluationSchemaError(error)) {
      console.error("[committee/evaluation] upsert failed:", error);
      return { error: "儲存失敗，請稍後再試或聯絡管理員。" };
    }
    try {
      const fallback = await upsertWithoutRank();
      revalidatePath(`/committee/application/${applicationId}`);
      revalidatePath("/committee/dashboard");
      revalidatePath("/admin/committee-evaluations");
      return { message: fallback.message };
    } catch (fallbackError) {
      console.error("[committee/evaluation] fallback upsert failed:", fallbackError);
      return {
        error:
          "正式資料庫尚未建立委員評分表（Evaluation）。請管理員於 PostgreSQL 套用 migration 後再試。",
      };
    }
  }

  revalidatePath(`/committee/application/${applicationId}`);
  revalidatePath("/committee/dashboard");
  revalidatePath("/admin/committee-evaluations");
  return { message: "已儲存評分與序位" };
}
