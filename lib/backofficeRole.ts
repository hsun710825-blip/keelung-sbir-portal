import { isBackofficeRole } from "@/lib/rbac";

/** 可進入 /admin 後台之 Prisma 角色（純函式，供 Edge middleware 使用） */
export function isBackofficePrismaRole(role: string | null | undefined): boolean {
  return isBackofficeRole(role);
}
