import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getBackofficeRoleByEmail } from "@/lib/adminAuth";

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
  callbacks: {
    async jwt({ token }) {
      const role = getBackofficeRoleByEmail(token?.email);
      (token as { role?: string | null }).role = role;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // @ts-expect-error add id to session user
        session.user.id = token.sub;
        // @ts-expect-error add role to session user
        session.user.role = ((token as { role?: string | null }).role || null) as "admin" | "reviewer" | null;
      }
      return session;
    },
  },
};

