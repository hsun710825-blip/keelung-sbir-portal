import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      /** Prisma `User.role`；無對應列或尚未同步時為 null */
      role: Role | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role | null;
  }
}
