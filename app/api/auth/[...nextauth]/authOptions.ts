import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { getPrismaRoleByEmail } from "@/lib/adminAuth";

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
      return account?.provider === "google" && Boolean(user?.email?.trim());
    },
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email) as string | undefined;
      if (!email?.trim()) {
        token.role = null;
        return token;
      }
      // 初次 OAuth 完成時會帶入 user；舊版 JWT 可能尚未寫入 role
      if (user || token.role === undefined) {
        token.role = await getPrismaRoleByEmail(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? null;
      }
      return session;
    },
  },
};
