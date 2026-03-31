import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { getSheetsSaClient } from "../../_driveSa";
import { getBackofficeRoleByEmail } from "@/lib/adminAuth";

function getSpreadsheetId(): string | null {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || process.env.GOOGLE_SHEET_ID?.trim();
  return id || null;
}

function getSheetName(): string {
  return (process.env.GOOGLE_SHEETS_REGISTRY_SHEET_NAME || "專案總表").trim() || "專案總表";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim() || "";
    const role = getBackofficeRoleByEmail(email);
    if (!session?.user || !role) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: "Missing GOOGLE_SHEETS_SPREADSHEET_ID / GOOGLE_SHEET_ID" }, { status: 500 });
    }

    const sheetName = getSheetName();
    const sheets = await getSheetsSaClient();
    const range = `'${sheetName.replace(/'/g, "''")}'!A1:L`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = res.data.values || [];
    if (values.length <= 1) {
      return NextResponse.json({
        ok: true,
        summary: { registeredCount: 0, draftCount: 0, submittedCount: 0 },
        submittedPlans: [],
      });
    }

    const rows = values.slice(1);
    const registeredCount = rows.filter((r) => String(r?.[0] ?? "").trim()).length;
    const draftCount = rows.filter((r) => String(r?.[10] ?? "").trim() === "草稿處理中").length;
    const submittedRows = rows.filter((r) => String(r?.[10] ?? "").trim() === "已確認送出");

    const submittedPlans = submittedRows
      .map((r) => ({
        companyName: String(r?.[3] ?? "").trim(),
        projectName: String(r?.[4] ?? "").trim(),
        submittedAt: String(r?.[11] ?? "").trim(),
        status: String(r?.[10] ?? "").trim(),
      }))
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
      .slice(0, 200);

    return NextResponse.json({
      ok: true,
      summary: {
        registeredCount,
        draftCount,
        submittedCount: submittedRows.length,
      },
      submittedPlans,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
