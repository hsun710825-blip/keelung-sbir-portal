import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { RevisionUploadRefreshButton } from "@/components/admin/RevisionUploadRefreshButton";
import { canOperateApplications, isGovReadOnlyRole } from "@/lib/rbac";
import {
  buildMissingUploadReminderText,
  getRevisionUploadStatus,
  type RevisionUploadStatus,
  type RevisionUploadStatusRow,
} from "@/lib/revisionUploadStatus";

export const metadata: Metadata = {
  title: "修改版計畫書上傳狀態",
  description: "白名單業者修改版計畫書上傳檢核",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatTaipei(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

function StatusTable({
  rows,
  variant,
}: {
  rows: RevisionUploadStatusRow[];
  variant: "missing" | "uploaded";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">公司名稱</th>
            <th className="px-3 py-2 font-medium">登入信箱</th>
            <th className="px-3 py-2 font-medium">{variant === "missing" ? "備註" : "檔名"}</th>
            <th className="px-3 py-2 font-medium">{variant === "missing" ? "8/13 前舊版時間" : "上傳時間"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={row.email} className="align-top">
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-slate-900">{row.companyName}</td>
              <td className="px-3 py-2 text-slate-600">{row.email}</td>
              <td className="px-3 py-2 text-slate-600">
                {variant === "missing" ? (
                  row.legacyFile ? (
                    <span className="text-amber-700">僅有 8/13 前舊版：{row.legacyFile.name}</span>
                  ) : (
                    <span className="text-slate-400">無任何修改版檔案</span>
                  )
                ) : row.matchedFile?.url ? (
                  <a
                    className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
                    href={row.matchedFile.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.matchedFile.name}
                  </a>
                ) : (
                  (row.matchedFileName ?? "—")
                )}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {formatTaipei(
                  variant === "missing"
                    ? (row.legacyFile?.modifiedTime ?? null)
                    : (row.matchedFile?.modifiedTime ?? null),
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-slate-400" colSpan={5}>
                無資料
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function StatusView({ status }: { status: RevisionUploadStatus }) {
  const total = status.uploaded.length + status.missing.length;
  return (
    <>
      <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            已上傳 {status.uploaded.length}／{total} 家
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">
            尚未上傳 {status.missing.length} 家
          </span>
          <span>檢查時間：{status.checkedAt}</span>
          <a
            className="text-blue-700 underline underline-offset-2 hover:text-blue-900"
            href={`https://drive.google.com/drive/folders/${status.folderId}`}
            target="_blank"
            rel="noreferrer"
          >
            開啟 Drive 資料夾（共 {status.fileCount} 個修改版 PDF）
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">尚未上傳（{status.missing.length}）</h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          以白名單 15 家為母體，比對「8/13後重新修改」資料夾內含「修改版」的 PDF 檔名。
        </p>
        <StatusTable rows={status.missing} variant="missing" />
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">已上傳（{status.uploaded.length}）</h2>
        <div className="mt-4">
          <StatusTable rows={status.uploaded} variant="uploaded" />
        </div>
      </section>

      {status.unmatchedFileNames.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-amber-900">
            資料夾內對不到白名單的檔案（{status.unmatchedFileNames.length}）
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {status.unmatchedFileNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">通知文字（可直接複製）</h2>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          {buildMissingUploadReminderText(status)}
        </pre>
      </section>
    </>
  );
}

export default async function AdminRevisionUploadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const role = session.user.role ?? null;
  if (!canOperateApplications(role) && !isGovReadOnlyRole(role)) redirect("/admin/dashboard");

  let status: RevisionUploadStatus | null = null;
  let error: string | null = null;
  try {
    status = await getRevisionUploadStatus();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">修改版計畫書上傳狀態</h1>
            <p className="mt-2 text-sm text-slate-600">
              依開放修改白名單即時比對 Drive 資料夾，列出尚未上傳修改版計畫書的業者。
            </p>
          </div>
          <RevisionUploadRefreshButton />
        </div>
      </header>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 shadow-sm">
          無法讀取 Drive 資料夾：{error}
        </section>
      ) : status ? (
        <StatusView status={status} />
      ) : null}
    </section>
  );
}
