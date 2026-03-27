import { NextResponse } from "next/server";
import { lookupZip6FromAddress } from "@/lib/twPostalMap";

/** GET /api/postal?q=地址 — 回傳推測之 6 碼郵遞區號（僅供輔助，未命中則 zip 為 null） */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ ok: true, zip: null });
  }
  const zip = lookupZip6FromAddress(q);
  return NextResponse.json({ ok: true, zip });
}
