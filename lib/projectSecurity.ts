import type { drive_v3 } from "googleapis";

type AnyRecord = Record<string, unknown>;

export function getDraftNameByEmailKey(emailKey: string) {
  return `draft-${emailKey}.json`;
}

export function extractLockStateFromDraft(input: unknown) {
  const now = Date.now();
  const draft = (input || {}) as AnyRecord;
  const formData = ((draft.formData as AnyRecord | undefined) || {}) as AnyRecord;
  const workflowStatus = String(formData.workflowStatus || formData.status || "").toLowerCase();
  const expiresAtRaw = String(formData.expiresAt || draft.expiresAt || "");
  const deletedAtRaw = String(formData.deletedAt || draft.deletedAt || "");
  const isDeleted = Boolean(formData.isDeleted || draft.isDeleted || deletedAtRaw);
  const expiresAtTs = expiresAtRaw ? Date.parse(expiresAtRaw) : NaN;
  const isExpired = Number.isFinite(expiresAtTs) && expiresAtTs < now;
  const isSubmitted = workflowStatus === "submitted";
  const locked = isDeleted || isExpired || isSubmitted;
  const reason = isDeleted ? "deleted" : isExpired ? "expired" : isSubmitted ? "submitted" : null;
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

export async function assertDraftUnlocked(
  drive: drive_v3.Drive,
  fileId: string | null,
  message = "Plan is locked"
) {
  if (!fileId) return;
  const draft = await readDraftJsonByFileId(drive, fileId);
  const lock = extractLockStateFromDraft(draft);
  if (lock.locked) {
    const err = new Error(`${message}: ${lock.reason || "locked"}`);
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

