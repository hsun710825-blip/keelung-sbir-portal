"use client";

import { useEffect, useState } from "react";

export function CommitteeProposalPdfViewer({
  applicationId,
  fallbackViewUrl,
}: {
  applicationId: string;
  fallbackViewUrl: string | null;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      try {
        const res = await fetch(`/api/committee/applications/${applicationId}/proposal-pdf`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (!active) return;
        if (blob.type && blob.type !== "application/pdf" && !blob.type.includes("pdf")) {
          throw new Error("回應格式不是 PDF");
        }
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "無法載入 PDF");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [applicationId]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (loading) {
    return (
      <div className="flex h-[min(80vh,900px)] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
        正在載入計畫書 PDF…
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-600">
        <p>內嵌預覽失敗：{error ?? "未知錯誤"}</p>
        {fallbackViewUrl ? (
          <a
            href={fallbackViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            新分頁開啟 PDF
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <object
      data={objectUrl}
      type="application/pdf"
      className="h-[min(80vh,900px)] w-full rounded-xl border border-slate-200 bg-white"
      aria-label="計畫書 PDF 預覽"
    >
      <iframe
        title="計畫書 PDF 預覽"
        src={objectUrl}
        className="h-[min(80vh,900px)] w-full rounded-xl border border-slate-200 bg-white"
      />
    </object>
  );
}
