import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { getPrismaRoleByEmail, isBackofficePrismaRole } from "@/lib/adminAuth";
import { canApplicantAccessSupplementChannel } from "@/lib/applicantSupplementEligibility";
import { hasApplicantRevisionAccess } from "@/lib/applicantRevisionAllowlistCore";
import { isWithinApplicantRevisionWindow } from "@/lib/applicantRevisionWindow";
import { isWithinSupplementWindow } from "@/lib/supplementWindow";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    /** OAuth 錯誤或 AccessDenied 時導回首頁，由 ?error= 顯示訊息 */
    signIn: "/",
  },
  callbacks: {
    /**
     * 申請者與後台共用同一 Google Provider，不可在此拒絕一般使用者，否則申請者無法登入。
     * 後台是否放行改由 JWT 內之 Prisma role，以及 /admin 的 middleware 判定（ADMIN / COMMITTEE）。
     */
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      const email = user?.email?.trim();
      if (!email) return false;

      const role = await getPrismaRoleByEmail(email);
      if (isBackofficePrismaRole(role)) return true;

      if (isWithinSupplementWindow()) {
        const allowed = await canApplicantAccessSupplementChannel(email, role);
        if (!allowed) return "/auth/applicant-denied";
        return true;
      }

      if (isWithinApplicantRevisionWindow()) {
        const allowed = hasApplicantRevisionAccess(email, role);
        if (!allowed) return "/auth/applicant-review-closed";
        return true;
      }

      return "/auth/applicant-review-closed";
    },
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email) as string | undefined;
      if (!email?.trim()) {
        token.role = null;
        token.applicantSupplementAccess = false;
        token.applicantSupplementDenied = false;
        token.applicantReviewAccess = false;
        token.applicantReviewDenied = false;
        return token;
      }

      token.role = await getPrismaRoleByEmail(email);

      if (!isBackofficePrismaRole(token.role as string | null)) {
        if (isWithinSupplementWindow()) {
          const allowed = await canApplicantAccessSupplementChannel(email, token.role as string | null);
          token.applicantSupplementAccess = allowed;
          token.applicantSupplementDenied = !allowed;
          token.applicantReviewAccess = false;
          token.applicantReviewDenied = false;
        } else if (isWithinApplicantRevisionWindow()) {
          const allowed = hasApplicantRevisionAccess(email, token.role as string | null);
          token.applicantReviewAccess = allowed;
          token.applicantReviewDenied = !allowed;
          token.applicantSupplementAccess = false;
          token.applicantSupplementDenied = false;
        } else {
          token.applicantSupplementAccess = false;
          token.applicantSupplementDenied = false;
          token.applicantReviewAccess = false;
          token.applicantReviewDenied = true;
        }
      } else {
        token.applicantSupplementAccess = false;
        token.applicantSupplementDenied = false;
        token.applicantReviewAccess = false;
        token.applicantReviewDenied = false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? null;
        session.user.applicantSupplementAccess = token.applicantSupplementAccess === true;
        session.user.applicantSupplementDenied = token.applicantSupplementDenied === true;
        session.user.applicantReviewAccess = token.applicantReviewAccess === true;
        session.user.applicantReviewDenied = token.applicantReviewDenied === true;
      }
      return session;
    },
  },
};
