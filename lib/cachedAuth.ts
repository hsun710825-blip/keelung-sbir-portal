import { cache } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { isReviewerRole } from "@/lib/rbac";

export const getCachedServerSession = cache(async () => getServerSession(authOptions));

export const getDbUserByEmail = cache(async (email: string) => {
  const normalized = email.trim();
  if (!normalized) return null;
  return prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, role: true, email: true },
  });
});

export async function getReviewerDbUser() {
  const session = await getCachedServerSession();
  const email = session?.user?.email?.trim() || "";
  if (!email) return null;
  const user = await getDbUserByEmail(email);
  if (!user || !isReviewerRole(user.role)) return null;
  return user;
}
