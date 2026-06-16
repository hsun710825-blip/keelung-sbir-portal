import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { buildSettlementWorkbook } from "@/lib/exportSettlementWorkbook";
import { loadSettlementCommitteeConfig } from "@/lib/settlementConfig";
import { buildSettlementRows } from "@/lib/settlementTable";
import { canOperateApplications } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!session?.user?.email || !canOperateApplications(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const committeeConfig = await loadSettlementCommitteeConfig();
  const memberNames = committeeConfig.slots.map((s) => s.displayName);
  const [standardRows, jointRows] = await Promise.all([
    buildSettlementRows(false, committeeConfig),
    buildSettlementRows(true, committeeConfig),
  ]);

  const buffer = buildSettlementWorkbook(standardRows, jointRows, memberNames);
  const filename = encodeURIComponent("115決算清表.xlsx");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
