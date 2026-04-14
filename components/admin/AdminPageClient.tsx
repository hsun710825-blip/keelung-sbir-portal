"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

type DashboardResp = {
  ok?: boolean;
  summary?: {
    registeredCount: number;
    draftCount: number;
    submittedCount: number;
  };
  submittedPlans?: Array<{
    companyName: string;
    projectName: string;
    submittedAt: string;
    status: string;
  }>;
  error?: string;
};

export default function AdminPageClient() {
  const { data: session } = useSession();
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");
  const [summary, setSummary] = useState({ registeredCount: 0, draftCount: 0, submittedCount: 0 });
  const [rows, setRows] = useState<Array<{ companyName: string; projectName: string; submittedAt: string; status: string }>>([]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", { credentials: "include", cache: "no-store" });
      const body = (await res.json().catch(() => null)) as DashboardResp | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error || "讀取後台資料失敗");
      setSummary(body.summary || { registeredCount: 0, draftCount: 0, submittedCount: 0 });
      setRows(body.submittedPlans || []);
    } catch (e) {
      setMsg(`載入失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/export", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "匯出失敗");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "基隆SBIR_申請總表.xlsx";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMsg("匯出完成，已開始下載。");
    } catch (e) {
      setMsg(`匯出失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">管理員後台儀表板</h1>
              <p className="mt-1 text-sm text-slate-600">
                目前登入：{session?.user?.name || "管理員"}（{session?.user?.email || "未知帳號"}）
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void loadDashboard()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                重新整理
              </button>
              <button
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                登出
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard title="已註冊帳號數" value={summary.registeredCount} />
          <StatCard title="草稿中計畫數" value={summary.draftCount} />
          <StatCard title="已送出計畫數" value={summary.submittedCount} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-800">已送出計畫清單</h2>
            <button
              onClick={() => void handleExport()}
              disabled={isExporting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? "匯出中..." : "匯出 Excel 報表"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2">公司名稱</th>
                  <th className="px-3 py-2">計畫名稱</th>
                  <th className="px-3 py-2">送出時間</th>
                  <th className="px-3 py-2">狀態</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>
                      載入中...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>
                      目前沒有已送出資料
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={`${r.companyName}-${r.projectName}-${i}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{r.companyName || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{r.projectName || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{r.submittedAt || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{r.status || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {msg && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-800">{value.toLocaleString()}</p>
    </div>
  );
}

