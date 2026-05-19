import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { getPrismaRoleByEmail, isBackofficePrismaRole } from "@/lib/adminAuth";
import { canApplicantAccessSupplementChannel } from "@/lib/applicantSupplementEligibility";
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

      if (!isWithinSupplementWindow()) return true;

      const allowed = await canApplicantAccessSupplementChannel(email, role);
      if (!allowed) return "/auth/applicant-denied";

      return true;
    },
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email) as string | undefined;
      if (!email?.trim()) {
        token.role = null;
        token.applicantSupplementAccess = false;
        token.applicantSupplementDenied = false;
        return token;
      }

      token.role = await getPrismaRoleByEmail(email);

      if (isWithinSupplementWindow() && !isBackofficePrismaRole(token.role as string | null)) {
        const allowed = await canApplicantAccessSupplementChannel(email, token.role as string | null);
        token.applicantSupplementAccess = allowed;
        token.applicantSupplementDenied = !allowed;
      } else {
        token.applicantSupplementAccess = false;
        token.applicantSupplementDenied = false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? null;
        session.user.applicantSupplementAccess = token.applicantSupplementAccess === true;
        session.user.applicantSupplementDenied = token.applicantSupplementDenied === true;
      }
      return session;
    },
  },
};
