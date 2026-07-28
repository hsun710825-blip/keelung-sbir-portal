import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      /** Prisma `User.role`；無對應列或尚未同步時為 null */
      role: Role | null;
      /** 補件窗口內且曾送件：可 bypass 徵件截止鎖定 */
      applicantSupplementAccess?: boolean;
      /** 補件窗口內未送件：應顯示登入阻擋畫面 */
      applicantSupplementDenied?: boolean;
      /** 修改開放期且在白名單：可登入、編輯、送出與重新上傳 */
      applicantReviewAccess?: boolean;
      /** 修改開放期外或非白名單：阻擋登入 */
      applicantReviewDenied?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role | null;
    applicantSupplementAccess?: boolean;
    applicantSupplementDenied?: boolean;
    applicantReviewAccess?: boolean;
    applicantReviewDenied?: boolean;
  }
}
