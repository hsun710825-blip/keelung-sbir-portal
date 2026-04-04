import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { getSheetsSaClient } from "../../_driveSa";
import { migrateRegistryRowsToPrisma } from "@/lib/sheetToPrismaMigrate";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

function getSpreadsheetId(): string | null {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || process.env.GOOGLE_SHEET_ID?.trim();
  return id || null;
}

function getSheetName(): string {
  return (process.env.GOOGLE_SHEETS_REGISTRY_SHEET_NAME || "專案總表").trim() || "專案總表";
}

function getFirstDataRow1Based(): number {
  const n = parseInt(process.env.GOOGLE_SHEETS_FIRST_DATA_ROW || "2", 10);
  return Number.isFinite(n) && n >= 1 ? n : 2;
}

/**
 * 一次性：自 Google「專案總表」讀取 A～L，將 User / Application 寫入 Prisma。
 * 僅限 Prisma role === ADMIN。
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role ?? null;
    if (!session?.user || role !== Role.ADMIN) {
      return NextResponse.json({ ok: false, error: "Forbidden: 僅限 ADMIN 執行資料遷移" }, { status: 403 });
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return NextResponse.json(
        { ok: false, error: "Missing GOOGLE_SHEETS_SPREADSHEET_ID / GOOGLE_SHEET_ID" },
        { status: 500 },
      );
    }

    const sheetName = getSheetName();
    const sheets = await getSheetsSaClient();
    const range = `'${sheetName.replace(/'/g, "''")}'!A1:L`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = res.data.values || [];

    const firstDataRow = getFirstDataRow1Based();
    const dataRows = values.slice(firstDataRow - 1);
    if (dataRows.length === 0) {
      return NextResponse.json({
        ok: true,
        stats: {
          rowsRead: 0,
          rowsSkipped: 0,
          usersCreated: 0,
          usersUpdated: 0,
          applicationsUpserted: 0,
          warnings: [] as string[],
        },
        message: "試算表無資料列可匯入",
      });
    }

    const stats = await migrateRegistryRowsToPrisma(prisma, dataRows, firstDataRow);

    return NextResponse.json({
      ok: true,
      stats: {
        rowsRead: stats.rowsRead,
        rowsSkipped: stats.rowsSkipped,
        usersCreated: stats.usersCreated,
        usersUpdated: stats.usersUpdated,
        applicationsUpserted: stats.applicationsUpserted,
        warnings: stats.warnings,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/migrate]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
