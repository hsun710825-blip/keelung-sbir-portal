/**
 * 由 Route Handler 的 Request 推算對外 origin，供伺服器端 fetch 自身 API（需轉發 Cookie）時使用。
 */
export function absoluteOriginFromRequest(req: Request): string {
  const hostRaw = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const host = hostRaw?.split(",")[0]?.trim();
  const protoRaw = req.headers.get("x-forwarded-proto") ?? "https";
  const proto = protoRaw.split(",")[0]?.trim() || "https";
  if (host) {
    return `${proto}://${host}`;
  }
  const fromEnv = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return String(fromEnv).replace(/\/$/, "");
}
