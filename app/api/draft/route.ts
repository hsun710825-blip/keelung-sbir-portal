import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/authOptions";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "../_driveOauth";
import { ensureProjectFolder, ensureUserFolder } from "../_driveFolders";
import { updateRegistryFromFormData } from "../_registrySheet";
import { withGoogleApiRetry } from "../_googleApiRetry";
import { sanitizeDeepInput, sanitizeProjectNameForFolder } from "../../../lib/serverSecurity";
import {
  assertDraftUnlocked,
  extractLockStateFromDraft,
  findDraftFileIdInFolder as findDraftInProjectFolder,
  readDraftJsonByFileId,
} from "../../../lib/projectSecurity";
import { writeAuditLog } from "../../../lib/audit";
import {
  ensureApplicantDbUser,
  pickApplicationMetaFormData,
  upsertApplicationFromDraftSave,
} from "../../../lib/applicantApplicationSync";

type DraftKeys = {
  // 以登入者 email hash 作為草稿識別鍵，避免直接暴露可猜測識別資訊。
  emailKey: string;
};

function getDraftKeysByEmail(email: string): DraftKeys {
  const emailKey = crypto.createHash("sha256").update(email).digest("hex").slice(0, 32);
  return { emailKey };
}

function draftName(key: string) {
  return `draft-${key}.json`;
}

type DriveClient = ReturnType<typeof getDriveOauthClient>;
const MISSING_BASIC_DATA_ERROR = "請先完成並儲存第一步驟的基本資料，再填寫後續內容。";

function logDraftApiEvent(stage: string, payload: Record<string, unknown>) {
  const safe = {
    stage,
    ...payload,
  };
  console.error("[draft.API]", JSON.stringify(safe));
}

function normalizeScheduleCheckpointsDraft(input: unknown) {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as {
    rows?: Array<{ id?: unknown; item?: unknown; weight?: unknown; manMonths?: unknown; months?: Record<string, unknown> }>;
    kpis?: Array<Record<string, unknown>>;
    notes?: { progressNote?: unknown; kpiNote?: unknown };
    testReportImages?: Array<{ id?: unknown; name?: unknown; size?: unknown; url?: unknown }>;
  };
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .map((r) => {
          const id = String(r?.id ?? "").trim();
          if (!id) return null;
          const item = String(r?.item ?? "").trim();
          const monthsRaw = r?.months && typeof r.months === "object" ? r.months : {};
          const months = Object.fromEntries(
            Object.entries(monthsRaw).map(([k, v]) => {
              const o = v && typeof v === "object" ? (v as { progress?: unknown; checkpoint?: unknown }) : {};
              return [k, { progress: !!o.progress, checkpoint: !!o.checkpoint }];
            })
          );
          return {
            id,
            item,
            weight: String(r?.weight ?? ""),
            manMonths: String(r?.manMonths ?? ""),
            months,
          };
        })
        .filter(Boolean)
    : [];
  const kpis = Array.isArray(raw.kpis)
    ? raw.kpis.map((k, idx) => ({
        id: String((k as { id?: unknown })?.id ?? `kpi-${idx + 1}`),
        code: String((k as { code?: unknown })?.code ?? ""),
        description: String((k as { description?: unknown })?.description ?? ""),
        period: String((k as { period?: unknown })?.period ?? ""),
        weight: String((k as { weight?: unknown })?.weight ?? "0"),
        staffCode: String((k as { staffCode?: unknown })?.staffCode ?? ""),
        workKey: String((k as { workKey?: unknown })?.workKey ?? ""),
        periodStartYear: (k as { periodStartYear?: unknown })?.periodStartYear != null ? String((k as { periodStartYear?: unknown }).periodStartYear) : undefined,
        periodStartMonth: (k as { periodStartMonth?: unknown })?.periodStartMonth != null ? String((k as { periodStartMonth?: unknown }).periodStartMonth) : undefined,
        periodEndYear: (k as { periodEndYear?: unknown })?.periodEndYear != null ? String((k as { periodEndYear?: unknown }).periodEndYear) : undefined,
        periodEndMonth: (k as { periodEndMonth?: unknown })?.periodEndMonth != null ? String((k as { periodEndMonth?: unknown }).periodEndMonth) : undefined,
      }))
    : [];
  const notes = {
    progressNote: String(raw.notes?.progressNote ?? ""),
    kpiNote: String(raw.notes?.kpiNote ?? ""),
  };
  const testReportImages = Array.isArray(raw.testReportImages)
    ? raw.testReportImages
        .map((img, idx) => ({
          id: String(img?.id ?? `img-${idx + 1}`),
          name: String(img?.name ?? ""),
          size: String(img?.size ?? ""),
          url: String(img?.url ?? ""),
        }))
        .filter((img) => !!img.url)
    : [];
  return { rows, kpis, notes, testReportImages };
}

function normalizeDraftFormDataShape(payload: Record<string, unknown>) {
  const out = { ...payload } as Record<string, unknown>;
  const formData = (out.formData && typeof out.formData === "object" ? { ...(out.formData as Record<string, unknown>) } : {}) as Record<string, unknown>;
  const schedule = normalizeScheduleCheckpointsDraft(formData.scheduleCheckpoints);
  if (schedule) formData.scheduleCheckpoints = schedule;
  if (formData.humanBudget && typeof formData.humanBudget === "object") {
    const hb = { ...(formData.humanBudget as Record<string, unknown>) };
    const tc = hb.techIntroCosts && typeof hb.techIntroCosts === "object" ? (hb.techIntroCosts as Record<string, unknown>) : {};
    const normalizeRows = (src: unknown, fallbackLabel: string) =>
      (Array.isArray(src) ? src : [{ item: fallbackLabel, gov: "", self: "" }]).map((r, idx) => {
        const row = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
        return {
          item: String(row.item ?? (idx === 0 ? fallbackLabel : "")),
          gov: String(row.gov ?? ""),
          self: String(row.self ?? ""),
        };
      });
    hb.techIntroCosts = {
      buy: normalizeRows(tc.buy, "(1) 技術或智慧財產權購買費"),
      research: normalizeRows(tc.research, "(2) 委託研究費"),
      service: normalizeRows(tc.service, "(3) 委託勞務費"),
      design: normalizeRows(tc.design, "(4) 委託設計費"),
    };
    hb.equipmentMaintenanceCosts = (Array.isArray(hb.equipmentMaintenanceCosts) ? hb.equipmentMaintenanceCosts : [{ item: "研發設備維護費", gov: "", self: "" }]).map((r, idx) => {
      const row = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
      return {
        item: String(row.item ?? (idx === 0 ? "研發設備維護費" : "")),
        gov: String(row.gov ?? ""),
        self: String(row.self ?? ""),
      };
    });
    formData.humanBudget = hb;
  }
  out.formData = formData;
  return out;
}

function hasAnyMeaningfulText(input: unknown): boolean {
  if (typeof input !== "string") return false;
  return input.trim().length > 0;
}

function hasPlanContentData(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const plan = input as Record<string, unknown>;
  const formData = (plan.formData && typeof plan.formData === "object"
    ? (plan.formData as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const formHasText = Object.values(formData).some((v) => hasAnyMeaningfulText(v));
  const hasTree = !!(plan.architectureTree && typeof plan.architectureTree === "object");
  const competitorRows = Array.isArray(plan.competitorRows) ? plan.competitorRows.length : 0;
  const techTransferRows = Array.isArray(plan.techTransferRows) ? plan.techTransferRows.length : 0;
  const images = plan.images && typeof plan.images === "object" ? Object.values(plan.images as Record<string, unknown>) : [];
  const hasImages = images.some((v) => Array.isArray(v) && v.length > 0);
  return formHasText || hasTree || competitorRows > 0 || techTransferRows > 0 || hasImages;
}

function hasScheduleData(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const schedule = input as Record<string, unknown>;
  const rows = Array.isArray(schedule.rows) ? schedule.rows : [];
  const kpis = Array.isArray(schedule.kpis) ? schedule.kpis : [];
  const notes = schedule.notes && typeof schedule.notes === "object" ? (schedule.notes as Record<string, unknown>) : {};
  const testReportImages = Array.isArray(schedule.testReportImages) ? schedule.testReportImages : [];
  const rowHasData = rows.some((r) => {
    if (!r || typeof r !== "object") return false;
    const row = r as Record<string, unknown>;
    if (hasAnyMeaningfulText(row.item) || hasAnyMeaningfulText(row.weight) || hasAnyMeaningfulText(row.manMonths)) return true;
    const months = row.months && typeof row.months === "object" ? Object.values(row.months as Record<string, unknown>) : [];
    return months.some((m) => {
      if (!m || typeof m !== "object") return false;
      const c = m as { progress?: unknown; checkpoint?: unknown };
      return !!c.progress || !!c.checkpoint;
    });
  });
  const kpiHasData = kpis.some((k) => {
    if (!k || typeof k !== "object") return false;
    const row = k as Record<string, unknown>;
    return (
      hasAnyMeaningfulText(row.code) ||
      hasAnyMeaningfulText(row.description) ||
      hasAnyMeaningfulText(row.period) ||
      hasAnyMeaningfulText(row.weight) ||
      hasAnyMeaningfulText(row.staffCode)
    );
  });
  const notesHasData = hasAnyMeaningfulText(notes.progressNote) || hasAnyMeaningfulText(notes.kpiNote);
  return rowHasData || kpiHasData || notesHasData || testReportImages.length > 0;
}

function mergeCriticalFormSections(existingPayload: Record<string, unknown> | null, incomingPayload: Record<string, unknown>) {
  if (!existingPayload || typeof existingPayload !== "object") return incomingPayload;
  const existingFormData =
    existingPayload.formData && typeof existingPayload.formData === "object"
      ? (existingPayload.formData as Record<string, unknown>)
      : null;
  const incomingFormData =
    incomingPayload.formData && typeof incomingPayload.formData === "object"
      ? ({ ...(incomingPayload.formData as Record<string, unknown>) } as Record<string, unknown>)
      : null;

  if (!existingFormData || !incomingFormData) return incomingPayload;

  const incomingPlan = incomingFormData.planContent;
  const existingPlan = existingFormData.planContent;
  if (!hasPlanContentData(incomingPlan) && hasPlanContentData(existingPlan)) {
    incomingFormData.planContent = existingPlan;
  }

  const incomingSchedule = incomingFormData.scheduleCheckpoints;
  const existingSchedule = existingFormData.scheduleCheckpoints;
  if (!hasScheduleData(incomingSchedule) && hasScheduleData(existingSchedule)) {
    incomingFormData.scheduleCheckpoints = existingSchedule;
  }

  return {
    ...incomingPayload,
    formData: incomingFormData,
  };
}

async function findDraftFileId(drive: DriveClient, sid: string) {
  const name = draftName(sid);
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id || null;
}

async function findLatestDraftFileIdAnywhere(drive: DriveClient, key: string) {
  const name = draftName(key);
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: 50,
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  const files = res.data.files || [];
  // Some Drive accounts/queries may ignore orderBy; sort client-side for robustness.
  files.sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")));
  return files[0]?.id || null;
}

async function isOwnedByUserFolder(drive: DriveClient, fileId: string, userFolderId: string) {
  let currentId: string | null = fileId;
  for (let i = 0; i < 20 && currentId; i++) {
    const res = await drive.files.get({
      fileId: currentId,
      fields: "id,parents",
      supportsAllDrives: true,
    });
    const parents = (res.data.parents || []) as string[];
    if (parents.includes(userFolderId)) return true;
    currentId = parents[0] || null;
  }
  return false;
}

async function assertFileOwnershipOrThrow(drive: DriveClient, fileId: string, userFolderId: string) {
  // IDOR 防護：檔案若不在當前使用者資料夾祖先鏈上，一律阻擋。
  const owned = await isOwnedByUserFolder(drive, fileId, userFolderId);
  if (!owned) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export async function GET() {
  try {
    return await withGoogleApiRetry("draft.GET", async () => {
    // 權限邊界：草稿讀取僅允許已登入使用者。
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { emailKey } = getDraftKeysByEmail(email);
    const drive = getDriveOauthClient();
    const userFolder = await ensureUserFolder(drive, session);

    const emailFileIdLatest = await findLatestDraftFileIdAnywhere(drive, emailKey);
    const emailFileIdLegacy = await findDraftFileId(drive, emailKey);
    const candidateIds = [emailFileIdLatest, emailFileIdLegacy].filter(Boolean) as string[];
    let fileId: string | null = null;
    for (const id of candidateIds) {
      if (await isOwnedByUserFolder(drive, id, userFolder.folderId)) {
        fileId = id;
        break;
      }
    }
    if (!fileId) {
      return NextResponse.json({ ok: true, draft: null, meta: { emailKey } });
    }

    await assertFileOwnershipOrThrow(drive, fileId, userFolder.folderId);
    const parsed = await readDraftJsonByFileId(drive, fileId);
    // 狀態鎖定：軟刪除/已送出/過期資料不可作為可編輯草稿返回前端。
    const lock = extractLockStateFromDraft(parsed);
    if (lock.isDeleted) {
      return NextResponse.json({ ok: true, draft: null, meta: { emailKey, usedFileId: fileId, deleted: true } });
    }

    const normalized = normalizeDraftFormDataShape((parsed as Record<string, unknown>) || {});
    return NextResponse.json({ ok: true, draft: normalized, meta: { emailKey, usedFileId: fileId, lock } });
    });
  } catch (e) {
    const errObj = e as unknown as {
      code?: number;
      response?: { status?: number; data?: { error?: { message?: string } } };
      status?: number;
    };
    const status = errObj?.status || errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Load draft failed");
    return NextResponse.json(
      {
        ok: false,
        draft: null,
        error: msg,
      },
      { status: status && status >= 400 && status < 600 ? status : 500 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  const bodyRecord = (body && typeof body === "object" ? (body as Record<string, unknown>) : {}) as Record<string, unknown>;
  const formDataRecord =
    bodyRecord.formData && typeof bodyRecord.formData === "object"
      ? (bodyRecord.formData as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const draftId = String(bodyRecord.draftId ?? formDataRecord.draftId ?? "").trim();
  const projectName = String(formDataRecord.projectName ?? "").trim();
  const hasLaterStepPayload = Boolean(
    formDataRecord.planContent ||
      formDataRecord.scheduleCheckpoints ||
      formDataRecord.expectedBenefits ||
      formDataRecord.humanBudget
  );
  if (hasLaterStepPayload && !draftId && !projectName) {
    logDraftApiEvent("validation.missing_primary_key", {
      status: 400,
      hasLaterStepPayload,
      topLevelKeys: Object.keys(bodyRecord),
      formDataKeys: Object.keys(formDataRecord),
    });
    return NextResponse.json({ ok: false, error: MISSING_BASIC_DATA_ERROR }, { status: 400 });
  }
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();
  if (!session?.user || !email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { emailKey: key } = getDraftKeysByEmail(email);
  // 進入儲存層前做遞迴字串淨化（XSS 風險降低）。
  const payload = normalizeDraftFormDataShape(sanitizeDeepInput({ ...body, updatedAt: new Date().toISOString() }) as Record<string, unknown>);

  try {
    type SaveResult = {
      file: { id?: string | null; name?: string | null; webViewLink?: string | null };
      folderMeta: { user?: { id: string; name: string }; project?: { id: string; name: string } } | null;
      payload: Record<string, unknown>;
    };

    const saveResult = (await withGoogleApiRetry("draft.POST", async () => {
      const drive = getDriveOauthClient();

      let parentId = DRIVE_FOLDER_ID;
      let folderMeta: SaveResult["folderMeta"] = null;
      const userFolder = await ensureUserFolder(drive, session);
      const formDataRecord = (payload?.formData && typeof payload.formData === "object"
        ? (payload.formData as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const projectName = sanitizeProjectNameForFolder(formDataRecord.projectName);
      const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
      parentId = projectFolder.folderId;
      folderMeta = {
        user: { id: userFolder.folderId, name: userFolder.folderName },
        project: { id: projectFolder.folderId, name: projectFolder.folderName },
      };

      const name = draftName(key);
      const existingId =
        parentId === DRIVE_FOLDER_ID ? await findDraftFileId(drive, key) : await findDraftInProjectFolder(drive, parentId, key);
      let payloadToWrite = payload;

      if (existingId) {
        await assertFileOwnershipOrThrow(drive, existingId, userFolder.folderId);
        // 鎖定檢查：submitted/expired/deleted 草稿不可更新。
        await assertDraftUnlocked(drive, existingId, "Plan is locked");
        const existingDraft = await readDraftJsonByFileId(drive, existingId).catch(() => null);
        if (existingDraft && typeof existingDraft === "object") {
          payloadToWrite = mergeCriticalFormSections(existingDraft as Record<string, unknown>, payload);
        }
        const bytes = Buffer.from(JSON.stringify(payloadToWrite, null, 2), "utf-8");
        const res = await drive.files.update({
          fileId: existingId,
          media: {
            mimeType: "application/json; charset=utf-8",
            body: Readable.from(bytes),
          },
          fields: "id,name,webViewLink",
          supportsAllDrives: true,
        });
        return { file: res.data!, folderMeta, payload: payloadToWrite };
      }

      const bytes = Buffer.from(JSON.stringify(payloadToWrite, null, 2), "utf-8");
      const res = await drive.files.create({
        requestBody: {
          name,
          parents: [parentId],
          mimeType: "application/json",
        },
        media: {
          mimeType: "application/json; charset=utf-8",
          body: Readable.from(bytes),
        },
        fields: "id,name,webViewLink",
        supportsAllDrives: true,
      });
      return { file: res.data!, folderMeta, payload: payloadToWrite };
    })) as SaveResult;
    const { file, folderMeta, payload: persistedPayload } = saveResult;
    let prismaSyncWarning: string | null = null;

    const projectFolderId = folderMeta?.project?.id;
    if (projectFolderId && persistedPayload?.formData) {
      try {
        const dbUser = await ensureApplicantDbUser(email, session.user?.name);
        const prismaFormData = pickApplicationMetaFormData(persistedPayload.formData as Record<string, unknown>);
        const projectTitle =
          typeof prismaFormData?.projectName === "string"
            ? String(prismaFormData.projectName).trim()
            : "";
        await upsertApplicationFromDraftSave({
          applicantUserId: dbUser.id,
          driveProjectFolderId: projectFolderId,
          projectTitle: projectTitle || "未命名計畫",
          formData: prismaFormData,
        });
      } catch (dbErr) {
        prismaSyncWarning = "Drive draft saved, but Prisma sync failed.";
        logDraftApiEvent("prisma.sync_failed_after_drive_saved", {
          status: 200,
          projectFolderId,
          fileId: String(file?.id ?? ""),
          errorName: dbErr instanceof Error ? dbErr.name : "UnknownError",
          errorMessage: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      }
    }

    const mail = session?.user?.email?.trim();
    if (mail && persistedPayload?.formData) {
      void updateRegistryFromFormData(mail, persistedPayload.formData as Record<string, unknown>).catch(() => {});
    }

    // 稽核軌跡：記錄草稿寫入操作，供後續責任追蹤。
    await writeAuditLog({
      userId: email,
      action: "draft.save",
      targetId: String(file.id || "draft"),
      timestamp: new Date().toISOString(),
      detail: { projectFolderId: folderMeta?.project?.id || null },
    });
    return NextResponse.json({
      ok: true,
      file,
      folder: folderMeta,
      prismaSyncWarning,
    });
  } catch (e) {
    const errObj = e as unknown as { code?: number; response?: { status?: number; data?: { error?: { message?: string } } } };
    const status = (e as Error & { status?: number })?.status || errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Save draft failed");
    const hint =
      status === 404
        ? `Drive 找不到目標資料夾（多半是登入的 Drive 帳號沒有權限）。請確認 Refresh Token 所屬帳號對資料夾 ID ${DRIVE_FOLDER_ID} 具備可新增/編輯檔案權限，且該資料夾存在於該帳號的雲端硬碟中。`
        : "請確認已在 .env.local 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKEN，且 Refresh Token 所屬帳號對目標資料夾具備寫入權限。";
    const normalizedStatus = status && status >= 400 && status < 600 ? status : 500;
    logDraftApiEvent("draft.post_exception", {
      status: normalizedStatus,
      errorName: e instanceof Error ? e.name : "UnknownError",
      errorMessage: msg,
    });
    return NextResponse.json({ ok: false, error: msg, hint }, { status: normalizedStatus });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { emailKey } = getDraftKeysByEmail(email);
    const drive = getDriveOauthClient();
    const userFolder = await ensureUserFolder(drive, session);
    const body = await req.json().catch(() => ({}));
    const projectName = sanitizeProjectNameForFolder((body as Record<string, unknown>)?.projectName);
    const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
    const fileId = await findDraftInProjectFolder(drive, projectFolder.folderId, emailKey);
    if (!fileId) return NextResponse.json({ ok: true, deleted: false });
    await assertFileOwnershipOrThrow(drive, fileId, userFolder.folderId);
    // 鎖定狀態下不可刪除，避免繞過送件凍結機制。
    await assertDraftUnlocked(drive, fileId, "Plan is locked");
    const existingDraft = await readDraftJsonByFileId(drive, fileId);
    // 軟刪除：標記欄位而非實體刪檔，避免不可逆資料遺失。
    const softDeleted = {
      ...existingDraft,
      deletedAt: new Date().toISOString(),
      isDeleted: true,
    };
    await drive.files.update({
      fileId,
      media: {
        mimeType: "application/json; charset=utf-8",
        body: Readable.from(Buffer.from(JSON.stringify(softDeleted, null, 2), "utf-8")),
      },
      fields: "id,name",
      supportsAllDrives: true,
    });
    await writeAuditLog({
      userId: email,
      action: "draft.soft_delete",
      targetId: fileId,
      timestamp: new Date().toISOString(),
      detail: { projectFolderId: projectFolder.folderId },
    });
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) {
    const status = (e as Error & { status?: number })?.status || 500;
    const msg = e instanceof Error ? e.message : "Delete draft failed";
    return NextResponse.json({ ok: false, error: msg }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}

