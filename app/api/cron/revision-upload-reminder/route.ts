import { NextResponse } from "next/server";

import { sendMissingRevisionUploadReminder } from "@/lib/revisionUploadStatus";

const TARGET_DATE = "2026-08-18";

function taipeiDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function authorized(req: Request): boolean {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  return false;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const today = taipeiDate();
  if (!force && today !== TARGET_DATE) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `今天是 ${today}，此提醒僅在 ${TARGET_DATE} 15:00 發送。`,
    });
  }

  const result = await sendMissingRevisionUploadReminder();
  return NextResponse.json({
    ok: result.ok,
    skipped: false,
    checkedAt: result.status.checkedAt,
    uploaded: result.status.uploaded.length,
    missing: result.status.missing.map((r) => r.companyName),
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
