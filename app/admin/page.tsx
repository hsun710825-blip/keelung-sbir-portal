import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ClipboardList, ShieldCheck, Sparkles } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isBackofficePrismaRole } from "@/lib/backofficeRole";
import {
  canManageBackofficeAccounts,
  canOperateApplications,
  isGovReadOnlyRole,
  isReviewerRole,
} from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminEntryCard = {
  href: string;
  title: string;
  desc: string;
  icon: "applications" | "users" | "overview" | "evaluations";
};

function CardIcon({ icon }: { icon: AdminEntryCard["icon"] }) {
  if (icon === "users") return <ShieldCheck className="h-10 w-10 text-violet-600" />;
  if (icon === "overview") return <ClipboardList className="h-10 w-10 text-emerald-600" />;
  if (icon === "evaluations") return <ClipboardList className="h-10 w-10 text-sky-600" />;
  return <ClipboardList className="h-10 w-10 text-blue-600" />;
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const emailRaw = session?.user?.email?.trim() || "";
  if (!session?.user?.email || !emailRaw) {
    redirect("/");
  }

  const jwtRole = session.user.role ?? null;
  if (!isBackofficePrismaRole(jwtRole)) {
    redirect("/");
  }

  const cards: AdminEntryCard[] = [
    {
      href: "/admin/dashboard",
      title: "提案清單與審核",
      desc: isReviewerRole(jwtRole)
        ? "檢視所有申請案；初審通過案件可點「評分」進入審查。"
        : "檢視所有申請案、進行查詢與案件狀態管理。",
      icon: "applications",
    },
  ];

  if (isReviewerRole(jwtRole)) {
    cards.push({
      href: "/committee/dashboard",
      title: "委員評分任務",
      desc: "列出初審通過及之後階段案件，填寫序位、分數與審查評語。",
      icon: "evaluations",
    });
  }

  if (canOperateApplications(jwtRole) || isGovReadOnlyRole(jwtRole)) {
    cards.push({
      href: "/admin/accounts-overview",
      title: "帳號與案件總覽",
      desc: "一筆案件一列，查看最後操作時間與聯絡資訊，並可匯出 Excel（CSV）。",
      icon: "overview",
    });
  }
  if (canOperateApplications(jwtRole)) {
    cards.push({
      href: "/admin/committee-access",
      title: "委員權限鎖定監看",
      desc: "7/1 指定委員時間鎖定設定與鎖定期登入紀錄（可收合）。",
      icon: "users",
    });
  }
  if (canManageBackofficeAccounts(jwtRole)) {
    cards.push({
      href: "/admin/users",
      title: "帳號權限管理",
      desc: "僅最高管理員：新增／移除 PO人員、市府人員與審查委員。",
      icon: "users",
    });
  } else if (canOperateApplications(jwtRole)) {
    cards.push({
      href: "/admin/users",
      title: "委員帳號管理",
      desc: "刪除審查委員帳號，並一併清除其評分資料。",
      icon: "users",
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            管理員儀表板首頁
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">歡迎回到管理後台</h1>
          <p className="mt-2 text-sm text-slate-600">
            請從下方卡片選擇功能。所有頁面都可透過左側導覽列快速切換。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-slate-50 p-3 transition group-hover:bg-blue-50">
                <CardIcon icon={card.icon} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{card.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
