import { ReactNode } from "react";

import { BackofficeShellClient } from "@/components/backoffice/BackofficeShellClient";
import { type AdminNavItem } from "@/components/admin/AdminNav";

export function BackofficeShell({
  children,
  navItems,
  userName,
  userEmail,
  roleLabel,
}: {
  children: ReactNode;
  navItems: AdminNavItem[];
  userName: string;
  userEmail: string;
  roleLabel: string;
}) {
  return (
    <BackofficeShellClient
      navItems={navItems}
      userName={userName}
      userEmail={userEmail}
      roleLabel={roleLabel}
    >
      {children}
    </BackofficeShellClient>
  );
}
