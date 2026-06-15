import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { isGovReadOnlyRole, isReviewerRole } from "@/lib/rbac";
import { isWithinSupplementWindow } from "@/lib/supplementWindow";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token?.role as string | null) ?? null;
  const path = req.nextUrl.pathname;
  const method = req.method.toUpperCase();

  if (path.startsWith("/committee")) {
    if (!token || !isReviewerRole(role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/committee")) {
    if (!token || !isReviewerRole(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (path.startsWith("/api/admin")) {
    if (!token || !isBackofficePrismaRole(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    if (isGovReadOnlyRole(role) && method !== "GET" && method !== "HEAD") {
      return NextResponse.json({ ok: false, error: "市府人員僅能唯讀存取" }, { status: 403 });
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

  const applicantWritePaths = [
    "/api/draft",
    "/api/submit",
    "/api/upload",
    "/api/upload-proposal",
    "/api/upload-proposal/chunk",
    "/api/upload-proposal/finalize",
    "/api/upload-proposal/session",
  ];
  const isApplicantWrite =
    applicantWritePaths.some((p) => path === p || path.startsWith(`${p}/`)) &&
    method !== "GET" &&
    method !== "HEAD";

  if (isApplicantWrite && isWithinSupplementWindow()) {
    if (!token?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!isBackofficePrismaRole(role) && token.applicantSupplementAccess !== true) {
      return NextResponse.json(
        { ok: false, error: "目前系統僅提供本年度已送件提案者補件使用。" },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/committee",
    "/committee/:path*",
    "/api/committee/:path*",
    "/api/admin/:path*",
    "/api/draft",
    "/api/submit",
    "/api/upload",
    "/api/upload-proposal",
    "/api/upload-proposal/:path*",
  ],
};
