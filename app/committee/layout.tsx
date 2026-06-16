import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ReactNode } from "react";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { BackofficeShell } from "@/components/backoffice/BackofficeShell";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import { buildBackofficeNavItems } from "@/lib/backofficeNav";
import { isReviewerRole, roleDisplayLabel } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommitteeLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  if (!session?.user?.email || !emailRaw) redirect("/");

  const jwtRole = session.user.role ?? null;
  if (!isReviewerRole(jwtRole) && !isBackofficePrismaRole(jwtRole)) {
    redirect("/");
  }

  return (
    <BackofficeShell
      navItems={buildBackofficeNavItems(jwtRole)}
      userName={session.user.name ?? "委員"}
      userEmail={session.user.email}
      roleLabel={roleDisplayLabel(jwtRole)}
    >
      {children}
    </BackofficeShell>
  );
}
