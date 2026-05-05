import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { resolveOnlineDraftViewPayload } from "@/lib/adminOnlineDraftResolve";
import { isBackofficeRole } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role ?? null;
  if (!session?.user?.email || !isBackofficeRole(role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: applicationId } = await ctx.params;
  const state = await resolveOnlineDraftViewPayload(applicationId);

  if (state.kind === "upload_mode") {
    return NextResponse.json({ ok: true, draft: null, reason: "UPLOAD_MODE" as const });
  }
  if (state.kind === "error") {
    return NextResponse.json({ ok: false, error: state.message }, { status: state.status });
  }
  if (state.kind === "no_draft_file") {
    return NextResponse.json({ ok: true, draft: null, reason: "NO_DRAFT_FILE" as const });
  }

  return NextResponse.json({ ok: true, draft: state.draft, reason: null });
}
