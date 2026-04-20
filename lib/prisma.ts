import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function withConnectTimeout(url: string): string {
  if (!url) return url;
  if (/[?&]connect_timeout=/i.test(url)) return url;
  return url.includes("?") ? `${url}&connect_timeout=30` : `${url}?connect_timeout=30`;
}

const datasourceUrl = process.env.DATABASE_URL ? withConnectTimeout(process.env.DATABASE_URL) : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
