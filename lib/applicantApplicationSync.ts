import {
  ApplicationStatus,
  AttachmentCategory,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";

type AnyRecord = Record<string, unknown>;

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * 僅保留 Application 同步所需欄位，避免把前端大型巢狀 payload 直接帶入 Prisma 層。
 * 目前只需要 projectName / submitYear / summary 來同步主表摘要欄位。
 */
export function pickApplicationMetaFormData(input: AnyRecord | null | undefined): AnyRecord {
  if (!input || typeof input !== "object") return {};
  const projectName = asTrimmedString(input.projectName);
  const summary = typeof input.summary === "string" ? input.summary : "";
  const out: AnyRecord = {
    projectName,
    summary,
  };
  const y = input.submitYear;
  if (typeof y === "string" || typeof y === "number") {
    out.submitYear = y;
  }
  return out;
}

/**
 * 登入申請者於 Prisma 的 User 列（依 email）；若尚無則建立為 USER。
 * 已存在之管理員／委員角色不會被降權。
 */
export async function ensureApplicantDbUser(email: string, name?: string | null) {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error("Missing email");
  }

  return withPrismaRetry(async () => {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: trimmed, mode: "insensitive" } },
    });

    if (existing) {
      if (name && name !== existing.name) {
        return prisma.user.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      return existing;
    }

    return prisma.user.create({
      data: {
        email: trimmed,
        name: name ?? null,
        role: Role.USER,
      },
    });
  });
}

function parsePeriodYearFromForm(formData: AnyRecord | null | undefined): number | null {
  if (!formData) return null;
  const y = formData.submitYear;
  if (typeof y === "string" && /^\d+$/.test(y.trim())) {
    return parseInt(y.trim(), 10);
  }
  if (typeof y === "number" && Number.isFinite(y)) {
    return Math.trunc(y);
  }
  return null;
}

function summarySnippet(formData: AnyRecord | null | undefined): string | null {
  if (!formData) return null;
  const s = formData.summary;
  if (typeof s !== "string" || !s.trim()) return null;
  return s.trim().slice(0, 2000);
}

/**
 * 草稿儲存成功後：以 Drive 專案資料夾 id 對應單一 Application（DRAFT）。
 */
export async function upsertApplicationFromDraftSave(input: {
  applicantUserId: string;
  driveProjectFolderId: string;
  projectTitle: string;
  formData: AnyRecord | null | undefined;
}) {
  const { applicantUserId, driveProjectFolderId, projectTitle, formData } = input;
  const title = projectTitle.trim() || null;
  const periodYear = parsePeriodYearFromForm(formData);
  const description = summarySnippet(formData);

  return withPrismaRetry(async () => {
    const existing = await prisma.application.findUnique({
      where: { driveProjectFolderId },
    });

    if (existing) {
      if (existing.applicantUserId !== applicantUserId) {
        const err = new Error("Forbidden");
        (err as Error & { status?: number }).status = 403;
        throw err;
      }

      const data: Prisma.ApplicationUpdateInput = {
        title: title ?? undefined,
        ...(periodYear != null ? { periodYear } : {}),
        ...(description != null ? { description } : {}),
      };

      if (existing.status === ApplicationStatus.DRAFT) {
        return prisma.application.update({
          where: { id: existing.id },
          data: { ...data, status: ApplicationStatus.DRAFT },
        });
      }

      // 已送件或其他狀態：不覆寫 status，僅更新可讀摘要欄位
      return prisma.application.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.application.create({
      data: {
        applicantUserId,
        driveProjectFolderId,
        title,
        periodYear: periodYear ?? undefined,
        description: description ?? undefined,
        status: ApplicationStatus.DRAFT,
      },
    });
  });
}

/**
 * 正式送件成功後：標記 SUBMITTED、寫入狀態歷程與計畫書 PDF 附件 metadata。
 */
export async function finalizeApplicationOnSubmit(input: {
  applicantUserId: string;
  driveProjectFolderId: string;
  projectTitle: string;
  formData: AnyRecord | null | undefined;
  pdfDriveFileId: string;
  pdfDisplayName: string;
  pdfByteLength: number;
}) {
  const {
    applicantUserId,
    driveProjectFolderId,
    projectTitle,
    formData,
    pdfDriveFileId,
    pdfDisplayName,
    pdfByteLength,
  } = input;

  const title = projectTitle.trim() || null;
  const periodYear = parsePeriodYearFromForm(formData);
  const description = summarySnippet(formData);

  return withPrismaRetry(async () => {
    const existing = await prisma.application.findUnique({
      where: { driveProjectFolderId },
    });

    if (existing && existing.applicantUserId !== applicantUserId) {
      const err = new Error("Forbidden");
      (err as Error & { status?: number }).status = 403;
      throw err;
    }

    if (existing?.status === ApplicationStatus.SUBMITTED) {
      return existing;
    }

    const fromStatus = existing?.status ?? null;

    const app = existing
      ? await prisma.application.update({
          where: { id: existing.id },
          data: {
            status: ApplicationStatus.SUBMITTED,
            title: title ?? existing.title,
            ...(periodYear != null ? { periodYear } : {}),
            ...(description != null ? { description } : {}),
          },
        })
      : await prisma.application.create({
          data: {
            applicantUserId,
            driveProjectFolderId,
            status: ApplicationStatus.SUBMITTED,
            title,
            periodYear: periodYear ?? undefined,
            description: description ?? undefined,
          },
        });

    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: app.id,
        fromStatus,
        toStatus: ApplicationStatus.SUBMITTED,
        changedByUserId: applicantUserId,
        note: "申請者於線上系統確認送件",
      },
    });

    await prisma.applicationAttachment.create({
      data: {
        applicationId: app.id,
        uploadedByUserId: applicantUserId,
        driveFileId: pdfDriveFileId,
        fileName: pdfDisplayName,
        mimeType: "application/pdf",
        sizeBytes: BigInt(Math.max(0, pdfByteLength)),
        category: AttachmentCategory.DRAFT_PDF,
      },
    });

    return app;
  });
}
