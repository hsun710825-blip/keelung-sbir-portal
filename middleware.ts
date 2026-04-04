import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isBackofficePrismaRole } from "@/lib/backofficeRole";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = token?.role ?? null;

  if (!token || !isBackofficePrismaRole(role)) {
    const url = new URL("/", req.url);
    url.searchParams.set("auth", "forbidden");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // 明確列出 /admin 與子路徑，避免部分環境對 :path* 比對差異
  matcher: ["/admin", "/admin/:path*"],
};
