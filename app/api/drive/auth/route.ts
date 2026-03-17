import { NextResponse } from "next/server";
import { ensureSessionId, getOauthClient } from "../_utils";

export async function GET() {
  const sid = await ensureSessionId();
  const oauth2 = getOauthClient();

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    // Use full Drive scope so we can upload into a specific folderId reliably.
    scope: ["https://www.googleapis.com/auth/drive"],
    state: sid,
    include_granted_scopes: true,
  });

  return NextResponse.redirect(url);
}

