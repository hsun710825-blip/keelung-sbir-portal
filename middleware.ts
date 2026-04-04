import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isBackofficePrismaRole } from "@/lib/backofficeRole";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token?.role as string | null) ?? null;
  const path = req.nextUrl.pathname;

  if (path.startsWith("/committee")) {
    if (!token || role !== "COMMITTEE") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/admin")) {
    if (!token || !isBackofficePrismaRole(role)) {
      const url = new URL("/", req.url);
      url.searchParams.set("auth", "forbidden");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/committee", "/committee/:path*"],
};
