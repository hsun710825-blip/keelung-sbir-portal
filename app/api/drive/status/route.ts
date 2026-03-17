import { NextResponse } from "next/server";
import { ensureSessionId, getStoredToken } from "../_utils";

export async function GET() {
  const sid = await ensureSessionId();
  const token = await getStoredToken(sid);
  return NextResponse.json({
    ok: true,
    connected: Boolean(token?.refresh_token || token?.access_token),
  });
}

