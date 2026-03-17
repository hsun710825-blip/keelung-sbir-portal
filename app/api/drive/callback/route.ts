import { NextResponse } from "next/server";
import { getOauthClient, setStoredToken } from "../_utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // sid we sent
  const err = searchParams.get("error");

  if (err) return NextResponse.redirect(new URL("/?drive=denied", req.url));
  if (!code || !state) return NextResponse.redirect(new URL("/?drive=invalid", req.url));

  const oauth2 = getOauthClient();
  const { tokens } = await oauth2.getToken(code);

  // Persist per-session tokens (needs refresh_token for long-lived access)
  await setStoredToken(state, {
    access_token: tokens.access_token || undefined,
    refresh_token: tokens.refresh_token || undefined,
    scope: tokens.scope || undefined,
    token_type: tokens.token_type || undefined,
    expiry_date: tokens.expiry_date || undefined,
  });

  return NextResponse.redirect(new URL("/?drive=connected", req.url));
}

