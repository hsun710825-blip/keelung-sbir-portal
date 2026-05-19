import type { DraftUnlockContext } from "@/lib/projectSecurity";

/** 由 NextAuth session 組出 assertDraftUnlocked 所需之授權脈絡 */
export function draftUnlockContextFromSession(session: {
  user?: { email?: string | null; role?: string | null } | null;
}): DraftUnlockContext {
  return {
    applicantEmail: session.user?.email?.trim() || undefined,
    prismaRole: session.user?.role ?? null,
  };
}
