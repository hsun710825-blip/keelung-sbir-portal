import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as XLSX from "xlsx";

import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { getSheetsSaClient } from "../../_driveSa";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";

function getSpreadsheetId(): string | null {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || process.env.GOOGLE_SHEET_ID?.trim();
  return id || null;
}

function getSheetName(): string {
  return (process.env.GOOGLE_SHEETS_REGISTRY_SHEET_NAME || "專案總表").trim() || "專案總表";
}

function pickByHeader(row: Record<string, unknown>, aliases: string[]): string {
  for (const alias of aliases) {
    const v = row[alias];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role ?? null;
    if (!session?.user || !isBackofficePrismaRole(role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Forbidden: admin/reviewer only. 請確認權限設定。",
        },
        { status: 403 }
      );
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: "Missing GOOGLE_SHEETS_SPREADSHEET_ID / GOOGLE_SHEET_ID" }, { status: 500 });
    }

    const sheetName = getSheetName();
    const sheets = await getSheetsSaClient();
    const range = `'${sheetName.replace(/'/g, "''")}'!A1:Z`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const values = res.data.values || [];
    if (values.length === 0) {
      return NextResponse.json({ ok: false, error: "No data in registry sheet" }, { status: 404 });
    }

    const headers = (values[0] || []).map((h) => String(h || "").trim());
    const keyedRows = values.slice(1).map((r) => {
      const out: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        out[h] = String(r?.[i] ?? "").trim();
      });
      return out;
    });

    const dataRows = values.slice(1);
    const exportRows = dataRows.map((cells, i) => {
      const row = keyedRows[i] || {};
      // 固定欄位優先沿用現行「專案總表」欄位：A=帳號 C=統編 D=公司 E=計畫名稱 K=狀態 L=最後更新
      const account = String(cells?.[0] ?? "").trim() || pickByHeader(row, ["登入帳號", "申請帳號", "Email", "email"]);
      const taxId = String(cells?.[2] ?? "").trim() || pickByHeader(row, ["統一編號", "統編"]);
      const companyName = String(cells?.[3] ?? "").trim() || pickByHeader(row, ["公司名稱", "公司"]);
      const projectName = String(cells?.[4] ?? "").trim() || pickByHeader(row, ["計畫名稱"]);
      const status = String(cells?.[10] ?? "").trim() || pickByHeader(row, ["目前狀態", "狀態"]);
      const submittedAt = String(cells?.[11] ?? "").trim() || pickByHeader(row, ["送出時間", "最後更新時間", "最後更新"]);
      return {
      "申請帳號/信箱": account,
      "公司名稱": companyName,
      "統一編號": taxId,
      "計畫名稱": projectName,
      "計畫總經費": pickByHeader(row, ["計畫總經費", "總經費", "總計畫經費"]),
      "申請補助款": pickByHeader(row, ["申請補助款", "補助款"]),
      "目前狀態": status,
      "送出時間": submittedAt,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, "申請總表");
    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const buf = new Uint8Array(arr);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          "attachment; filename=\"keelung-sbir-export.xlsx\"; filename*=UTF-8''%E5%9F%BA%E9%9A%86SBIR_%E7%94%B3%E8%AB%8B%E7%B8%BD%E8%A1%A8.xlsx",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
