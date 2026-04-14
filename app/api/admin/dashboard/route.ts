import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ApplicationStatus } from "@prisma/client";

import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { prisma } from "@/lib/prisma";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role ?? null;
    if (!session?.user || !isBackofficePrismaRole(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // 與 /admin/dashboard 同步：完全以 Prisma Application 為基準
    const [registeredCount, draftCount, submittedCount, submittedRows] = await Promise.all([
      prisma.application.count(),
      prisma.application.count({ where: { status: ApplicationStatus.DRAFT } }),
      prisma.application.count({ where: { status: { not: ApplicationStatus.DRAFT } } }),
      prisma.application.findMany({
        where: { status: { not: ApplicationStatus.DRAFT } },
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: {
          applicant: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const submittedPlans = submittedRows.map((row) => ({
      companyName: String(row.applicant?.name || row.applicant?.email || "").trim(),
      projectName: String(row.title || "").trim(),
      submittedAt: row.updatedAt.toISOString(),
      status: applicationStatusLabel(row.status),
    }));

    return NextResponse.json({
      ok: true,
      summary: {
        registeredCount,
        draftCount,
        submittedCount,
      },
      submittedPlans,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
