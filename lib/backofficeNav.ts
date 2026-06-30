import type { AdminNavItem } from "@/components/admin/AdminNav";
import {
  canManageBackofficeAccounts,
  canOperateApplications,
  isGovReadOnlyRole,
  isReviewerRole,
} from "@/lib/rbac";

export function buildBackofficeNavItems(jwtRole: string | null): AdminNavItem[] {
  const isReviewer = isReviewerRole(jwtRole);

  const navItems: AdminNavItem[] = [
    { href: "/admin", label: "後台首頁", description: "管理功能入口", icon: "home" },
    {
      href: "/admin/dashboard",
      label: "提案清單管理",
      description: "查詢與審閱申請案",
      icon: "applications",
      matchPrefix: "/admin/application/",
    },
  ];

  if (isReviewer) {
    navItems.push({
      href: "/committee/dashboard",
      label: "委員評分任務",
      description: "審查會議評分與總表",
      icon: "evaluations",
      matchPrefix: "/committee/",
      children: [
        { href: "/committee/summary", label: "所有評分總表" },
        {
          href: "/committee/meeting/0622",
          label: "6/22",
          matchPrefix: "/committee/meeting/0622",
          meetingDateKey: "0622",
        },
        {
          href: "/committee/meeting/0701",
          label: "7/1",
          matchPrefix: "/committee/meeting/0701",
          meetingDateKey: "0701",
        },
      ],
    });
  }

  if (canOperateApplications(jwtRole) || isGovReadOnlyRole(jwtRole)) {
    navItems.push({
      href: "/admin/accounts-overview",
      label: "帳號與案件總覽",
      description: "一筆案件一列，支援匯出",
      icon: "dashboard",
    });
    navItems.push({
      href: "/admin/settlement",
      label: "決算清表",
      description: "經費決算與 Excel 匯出",
      icon: "evaluations",
      matchPrefix: "/admin/settlement",
    });
    navItems.push({
      href: "/admin/review-progress",
      label: "審查進度監看",
      description: "即時監看委員評分與鎖定",
      icon: "evaluations",
      matchPrefix: "/admin/review-progress",
    });
    navItems.push({
      href: "/admin/committee-access",
      label: "委員權限鎖定",
      description: "指定委員時間鎖定與登入紀錄",
      icon: "users",
      matchPrefix: "/admin/committee-access",
    });
  }

  if (canManageBackofficeAccounts(jwtRole)) {
    navItems.push({
      href: "/admin/users",
      label: "帳號權限管理",
      description: "最高管理員：PO／市府／委員授權",
      icon: "users",
      matchPrefix: "/admin/users",
    });
  } else if (canOperateApplications(jwtRole)) {
    navItems.push({
      href: "/admin/users",
      label: "委員帳號管理",
      description: "刪除審查委員及其評分資料",
      icon: "users",
      matchPrefix: "/admin/users",
    });
  }

  return navItems;
}
