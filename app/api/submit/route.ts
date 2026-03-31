import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/authOptions";
import { emailHashKey, ensureProjectFolder, ensureUserFolder } from "../_driveFolders";
import { getDriveOauthClient } from "../_driveOauth";
import { getDriveSaClient } from "../_driveSa";
import { markRegistrySubmitted } from "../_registrySheet";
import { withGoogleApiRetry } from "../_googleApiRetry";
import {
  buildSafeDisplayPdfName,
  ensureAllowedUploadMime,
  ensureFileSizeLimit,
  sanitizeDeepInput,
  sanitizeProjectNameForFolder,
} from "../../../lib/serverSecurity";
import { assertDraftUnlocked, findDraftFileIdInFolder, readDraftJsonByFileId } from "../../../lib/projectSecurity";
import { writeAuditLog } from "../../../lib/audit";
import { sendSubmitSuccessEmail } from "../../../lib/mailer";

type AnyRecord = Record<string, unknown>;

type ParsedPayload = {
  projectName: string;
  pdfBytes: Buffer;
  /** 若有帶入，用於寫回專案總表（Google Sheets） */
  formData?: AnyRecord | null;
};

async function parseSubmitPayload(req: Request): Promise<ParsedPayload> {
  const contentType = req.headers.get("content-type") || "";

  // 優先採 JSON + formData：由後端產生 PDF 並上傳，降低前端大檔傳輸風險。
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as
      | { formData?: unknown; filename?: string; projectName?: string; pdfBase64?: string }
      | null;
    if (!body) throw new Error("Invalid JSON");

    const filename = (typeof body.filename === "string" && body.filename.trim() ? body.filename : "sbir-plan.pdf").trim();
    const projectName = sanitizeProjectNameForFolder(
      typeof body.projectName === "string" && body.projectName.trim() ? body.projectName : filename.replace(/\.pdf$/i, "")
    );

    if (body.formData) {
      // 重要：送出前先做遞迴淨化，降低惡意 payload 寫入風險。
      const cleanFormData = sanitizeDeepInput(body.formData as AnyRecord);
      const pdfRes = await fetch(new URL("/api/pdf", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: cleanFormData, filename }),
        cache: "no-store",
      });
      if (!pdfRes.ok) {
        const err = await pdfRes.json().catch(async () => ({ error: await pdfRes.text().catch(() => "PDF 產製失敗") }));
        throw new Error(String(err?.error || "PDF 產製失敗"));
      }
      return {
        projectName,
        pdfBytes: Buffer.from(await pdfRes.arrayBuffer()),
        formData: cleanFormData,
      };
    }

    // 相容舊版 base64 流程（保留既有整合點）。
    const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : undefined;
    if (!pdfBase64) throw new Error("Missing pdfBase64 or formData");
    const pdfBytes = Buffer.from(pdfBase64, "base64");
    const sizeCheck = ensureFileSizeLimit(pdfBytes.byteLength);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);
    return {
      projectName,
      pdfBytes,
    };
  }

  // multipart 路徑：只允許 PDF，並套用容量上限。
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file in formData");
    }
    const filenameField = form.get("filename");
    void filenameField;
    const mimeCheck = ensureAllowedUploadMime(file.type || "");
    if (!mimeCheck.ok || mimeCheck.mimeType !== "application/pdf") {
      throw new Error("Only PDF is allowed for submit");
    }
    const sizeCheck = ensureFileSizeLimit(file.size);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);
    const projectNameField = form.get("projectName");
    const projectName = sanitizeProjectNameForFolder(
      typeof projectNameField === "string" && projectNameField.trim()
        ? projectNameField
        : "未命名計畫"
    );

    return {
      projectName,
      pdfBytes: Buffer.from(await file.arrayBuffer()),
    };
  }
  throw new Error("Unsupported Content-Type");
}

async function getDriveWithFallback() {
  try {
    const drive = getDriveOauthClient();
    return { drive, mode: "oauth" as const };
  } catch {
    const drive = await getDriveSaClient();
    return { drive, mode: "service-account" as const };
  }
}

export async function POST(req: Request) {
  try {
    const { projectName, pdfBytes, formData: registryFormData } = await parseSubmitPayload(req);
    const displayPdfName = buildSafeDisplayPdfName(projectName);
    const payloadSizeCheck = ensureFileSizeLimit(pdfBytes.byteLength);
    if (!payloadSizeCheck.ok) {
      return NextResponse.json({ ok: false, error: payloadSizeCheck.error, maxBytes: payloadSizeCheck.maxBytes }, { status: 413 });
    }
    // 權限驗證：僅登入者可執行正式送件。
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { drive, mode } = await getDriveWithFallback();
    const nowIso = new Date().toISOString();
    const { userFolder, projectFolder, file, draftFileId } = await withGoogleApiRetry("submit.driveUpload", async () => {
      const userFolder = await ensureUserFolder(drive, session);
      const projectFolder = await ensureProjectFolder({ drive, userFolderId: userFolder.folderId, projectName });
      // 狀態鎖定：已送出/過期/刪除的草稿禁止再送件。
      const draftFileId = await findDraftFileIdInFolder(drive, projectFolder.folderId, emailHashKey(session.user?.email || ""));
      await assertDraftUnlocked(drive, draftFileId, "Plan is locked");

      const res = await drive.files.create({
        requestBody: {
          name: displayPdfName,
          parents: [projectFolder.folderId],
        },
        media: {
          mimeType: "application/pdf",
          body: Readable.from(pdfBytes),
        },
        fields: "id, name, webViewLink",
        supportsAllDrives: true,
      });
      if (!res.data) throw new Error("Drive upload returned empty response");
      return { userFolder, projectFolder, file: res.data, draftFileId };
    });

    if (draftFileId) {
      // 送件成功後回寫草稿狀態為 submitted，形成後端不可逆鎖定。
      const draft = await readDraftJsonByFileId(drive, draftFileId);
      const nextDraft = {
        ...draft,
        formData: {
          ...((draft.formData as Record<string, unknown> | undefined) || {}),
          workflowStatus: "submitted",
          submittedAt: nowIso,
        },
      };
      await drive.files.update({
        fileId: draftFileId,
        media: {
          mimeType: "application/json; charset=utf-8",
          body: Readable.from(Buffer.from(JSON.stringify(nextDraft, null, 2), "utf-8")),
        },
        fields: "id",
        supportsAllDrives: true,
      });
    }

    // 動作 C：專案總表標記「已確認送出」（不影響 Drive 上傳結果；失敗僅記錄 log）
    const email = session.user.email?.trim();
    if (email) {
      void markRegistrySubmitted(email, sanitizeDeepInput(registryFormData ?? null)).catch(() => {});
    }
    // 稽核紀錄：記錄正式送件責任鏈（人、時間、目標）。
    await writeAuditLog({
      userId: session.user.email || "unknown",
      action: "plan.submit",
      targetId: String(file.id || "pdf"),
      timestamp: new Date().toISOString(),
      detail: { projectFolderId: projectFolder.folderId, uploadMode: mode },
    });

    // 必須 await 寄信後再回傳 JSON：在 Vercel Serverless 若用 void 背景寄信，回應送出後程序會被凍結，Promise 常無法跑完（故日誌無 [submit.mail]、信也寄不出）。
    if (email) {
      try {
        await sendSubmitSuccessEmail({
          to: email,
          projectName,
          submittedAtIso: nowIso,
        });
        console.log("[submit.mail] ok", { to: email });
      } catch (err) {
        console.warn("[submit.mail] failed:", err instanceof Error ? err.message : String(err));
      }
    }

    return NextResponse.json({
      ok: true,
      file,
      uploadMode: mode,
      folder: {
        user: { name: userFolder.folderName, id: userFolder.folderId },
        project: { name: projectFolder.folderName, id: projectFolder.folderId },
      },
    });
  } catch (e) {
    const errObj = e as unknown as { code?: number; response?: { status?: number; data?: { error?: { message?: string } } } };
    const status = errObj?.code || errObj?.response?.status;
    const apiMsg = errObj?.response?.data?.error?.message;
    const msg = apiMsg || (e instanceof Error ? e.message : "Upload failed");
    const normalizedStatus =
      status && status >= 400 && status < 600
        ? status
          : msg.includes("Invalid JSON") ||
              msg.includes("Missing pdfBase64") ||
              msg.includes("Missing file") ||
              msg.includes("Unsupported Content-Type")
          ? 400
          : 500;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
        hint:
          normalizedStatus === 400
            ? "送出資料格式不正確，請重新整理頁面後再送出。"
            : status === 404
            ? `Drive 找不到目標資料夾（多半是 Refresh Token 所屬帳號對目標資料夾沒有權限或資料夾不存在）。`
            : status === 401
              ? "登入已失效，請重新登入後再送出。"
              : /invalid_grant/i.test(msg)
                ? "Google Refresh Token 已失效，請重新授權或改用 service account。"
            : "請確認已在 .env.local 設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKEN，且 Refresh Token 所屬帳號對目標資料夾具備寫入權限。",
      },
      { status: normalizedStatus }
    );
  }
}

