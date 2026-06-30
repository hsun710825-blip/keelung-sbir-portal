import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { isReviewerRole } from "@/lib/rbac";
import { runOcrForApplication } from "@/lib/youthId/loadVerificationTable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!session?.user?.email || !isBackofficePrismaRole(role) || isReviewerRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let applicationId = "";
  try {
    const body = (await req.json()) as { applicationId?: string };
    applicationId = String(body.applicationId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!applicationId) {
    return NextResponse.json({ error: "applicationId required" }, { status: 400 });
  }

  try {
    const row = await runOcrForApplication(applicationId);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ row });
  } catch (error) {
    console.error("[youth-id ocr]", error);
    return NextResponse.json({ error: "OCR failed" }, { status: 500 });
  }
}
