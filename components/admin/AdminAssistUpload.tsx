"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const MAX_BATCH = 20 * 1024 * 1024;

export function AdminAssistUpload({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onPick = () => {
    setErr(null);
    setMsg(null);
    inputRef.current?.click();
  };

  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (files.length === 0) {
      setErr("僅能上傳 PDF 檔案。");
      return;
    }
    let total = 0;
    for (const f of files) {
      total += f.size;
    }
    if (total > MAX_BATCH) {
      setErr("本次選取檔案總容量超過 20MB，請分批上傳。");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      for (const f of files) {
        fd.append("files", f);
      }
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(applicationId)}/attachments`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; uploaded?: unknown[] };
      if (!res.ok || !data.ok) {
        setErr(data.error || `上傳失敗（${res.status}）`);
        return;
      }
      setMsg(`已上傳 ${Array.isArray(data.uploaded) ? data.uploaded.length : 0} 個 PDF。`);
      router.refresh();
    } catch {
      setErr("上傳過程發生錯誤。");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">📎 協助補件</h2>
      <p className="mt-2 text-sm text-slate-600">
        僅限 PDF；可多選。單次請求總容量不可超過 20MB。檔名將自動加上「[管理員補件]_」前綴並寫入雲端專案資料夾與附件紀錄。
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? "上傳中…" : "選擇 PDF 並上傳"}
      </button>
      {msg ? <p className="mt-3 text-sm text-emerald-800">{msg}</p> : null}
      {err ? (
        <p className="mt-3 text-sm text-rose-700" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
