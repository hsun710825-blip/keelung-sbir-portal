import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { isCommitteeVisibleStatus } from "@/lib/committeeApplicationStatuses";
import { COMMITTEE_PDF_CACHE_CONTROL } from "@/lib/committeePdfCache";
import { downloadDriveFileBytes } from "@/lib/downloadDriveFileBytes";
import { resolveCommitteeProposalPdfSource } from "@/lib/resolveCommitteeProposalPdf";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: Ctx) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const email = typeof token?.email === "string" ? token.email.trim() : "";
  if (!email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const role = typeof token?.role === "string" ? token.role : null;
  if (!isReviewerRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: applicationId } = await ctx.params;
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, title: true },
  });
  if (!app) {
    return NextResponse.json({ ok: false, error: "找不到案件" }, { status: 404 });
  }
  if (!isCommitteeVisibleStatus(app.status)) {
    return NextResponse.json({ ok: false, error: "此案件狀態不開放委員檢視" }, { status: 403 });
  }

  const source = await resolveCommitteeProposalPdfSource(applicationId);
  if (source.kind !== "drive_file") {
    return NextResponse.json(
      {
        ok: false,
        error: "找不到可串流的計畫書 PDF",
        externalViewUrl: source.externalViewUrl,
      },
      { status: 404 },
    );
  }

  try {
    const bytes = await downloadDriveFileBytes(source.fileId);
    const filename = `${(app.title || "proposal").replace(/[^\w\u4e00-\u9fff.-]+/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": COMMITTEE_PDF_CACHE_CONTROL,
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    console.error("[committee/proposal-pdf] download failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "無法從雲端讀取 PDF，請改用「新分頁開啟 PDF」或聯絡管理員。",
        externalViewUrl: source.externalViewUrl,
      },
      { status: 502 },
    );
  }
}
