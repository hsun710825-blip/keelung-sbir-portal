export function getAdminEmailAllowlist(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_EXPORT_EMAILS ||
    process.env.NEXTAUTH_ADMIN_EMAILS ||
    "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const em = String(email || "").trim().toLowerCase();
  if (!em) return false;
  const allow = getAdminEmailAllowlist();
  if (allow.length === 0) return false;
  return allow.includes(em);
}

export function getReviewerEmailAllowlist(): string[] {
  const raw = process.env.REVIEWER_EMAILS || process.env.ADMIN_REVIEWER_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type BackofficeRole = "admin" | "reviewer" | null;

export function getBackofficeRoleByEmail(email: string | null | undefined): BackofficeRole {
  const em = String(email || "").trim().toLowerCase();
  if (!em) return null;
  if (isAdminEmail(em)) return "admin";
  const reviewers = getReviewerEmailAllowlist();
  if (reviewers.includes(em)) return "reviewer";
  return null;
}
