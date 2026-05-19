import type { drive_v3 } from "googleapis";

import { isApplicantEditLockedByPolicy } from "./applicantEditLock";
import { isPastApplicationDeadline } from "./applicationDeadline";

type AnyRecord = Record<string, unknown>;

export function getDraftNameByEmailKey(emailKey: string) {
  return `draft-${emailKey}.json`;
}

export function extractLockStateFromDraft(input: unknown) {
  const now = Date.now();
  const draft = (input || {}) as AnyRecord;
  const formData = ((draft.formData as AnyRecord | undefined) || {}) as AnyRecord;
  const workflowStatus = String(formData.workflowStatus || formData.status || "").toLowerCase();
  const deletedAtRaw = String(formData.deletedAt || draft.deletedAt || "");
  const isDeleted = Boolean(formData.isDeleted || draft.isDeleted || deletedAtRaw);
  /** 徵件是否已截止：僅依公告之全域截止日（截止後含已送件者一律鎖編輯）；不依草稿內舊 expiresAt */
  const isExpired = isPastApplicationDeadline(now);
  const locked = isDeleted || isExpired;
  const reason = isDeleted ? "deleted" : isExpired ? "expired" : null;
  return { locked, reason, workflowStatus, isDeleted, isExpired };
}

export async function findDraftFileIdInFolder(
  drive: drive_v3.Drive,
  parentId: string,
  emailKey: string
) {
  const name = getDraftNameByEmailKey(emailKey);
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  return res.data.files?.[0]?.id || null;
}

export async function readDraftJsonByFileId(drive: drive_v3.Drive, fileId: string) {
  const dl = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  const raw = Buffer.from(dl.data as ArrayBuffer).toString("utf-8");
  return JSON.parse(raw) as AnyRecord;
}

export type DraftUnlockContext = {
  applicantEmail?: string;
  prismaRole?: string | null;
};

export async function assertDraftUnlocked(
  drive: drive_v3.Drive,
  fileId: string | null,
  message = "Plan is locked",
  ctx?: DraftUnlockContext,
) {
  if (!fileId) {
    if (ctx?.applicantEmail && (await isApplicantEditLockedByPolicy(ctx.applicantEmail, ctx.prismaRole))) {
      const err = new Error(`${message}: expired`);
      (err as Error & { status?: number }).status = 403;
      throw err;
    }
    return;
  }
  const draft = await readDraftJsonByFileId(drive, fileId);
  const lock = extractLockStateFromDraft(draft);
  if (lock.locked) {
    if (lock.reason === "expired" && ctx?.applicantEmail) {
      const policyLocked = await isApplicantEditLockedByPolicy(ctx.applicantEmail, ctx.prismaRole);
      if (!policyLocked) return;
    }
    const err = new Error(`${message}: ${lock.reason || "locked"}`);
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

