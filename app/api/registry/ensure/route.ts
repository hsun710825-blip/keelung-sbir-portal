import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { getDriveOauthClient } from "../../_driveOauth";
import { ensureUserFolder } from "../../_driveFolders";
import { ensureRegistryRowForLogin, isRegistrySheetEnabled } from "../../_registrySheet";
import { withGoogleApiRetry } from "../../_googleApiRetry";

/**
 * 動作 A：使用者以 Google 登入後，前端應呼叫此 API 一次。
 * - 以 Session 取得登入 email
 * - 以 OAuth Drive 建立／取得使用者專屬資料夾（與草稿邏輯一致）
 * - 以 Service Account 寫入 Google Sheets：無列則新增，有列則補齊 I／K
 */
export async function POST() {
  try {
    if (!isRegistrySheetEnabled()) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: "未設定 GOOGLE_SHEETS_SPREADSHEET_ID（或 GOOGLE_SHEET_ID），已略過專案總表同步",
      });
    }

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim();
    if (!session?.user || !email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await withGoogleApiRetry("registry.ensure.userFolder", async () => {
      const drive = getDriveOauthClient();
      const uf = await ensureUserFolder(drive, session);
      return { folderId: uf.folderId };
    });

    const result = await ensureRegistryRowForLogin({ email, userFolderId: folderId });
    if (!result.ok) {
      if ("skipped" in result && result.skipped) {
        return NextResponse.json({ ok: true, skipped: true });
      }
      return NextResponse.json({ ok: false, error: "error" in result ? result.error : "unknown" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      row: result.row,
      created: result.created,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[registry/ensure]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
