import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { isReviewerRole } from "@/lib/rbac";
import { buildYouthIdWordDocument } from "@/lib/youthId/exportWord";
import { loadYouthVerificationTable } from "@/lib/youthId/loadVerificationTable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!session?.user?.email || !isBackofficePrismaRole(role) || isReviewerRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const table = await loadYouthVerificationTable();
    const buffer = await buildYouthIdWordDocument(table.rows);
    const filename = encodeURIComponent("115年基隆市地方型SBIR提案業者身分證件彙整表.docx");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[youth-id export]", error);
    return NextResponse.json({ error: "匯出失敗" }, { status: 500 });
  }
}
