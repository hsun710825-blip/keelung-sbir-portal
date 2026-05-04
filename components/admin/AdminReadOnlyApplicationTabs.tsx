"use client";

import { useMemo, useState } from "react";

function Ro({ label, value }: { label: string; value: unknown }) {
  const text =
    value === null || value === undefined
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value, null, 2)
        : String(value);
  return (
    <div className="border-b border-slate-100 py-2 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 whitespace-pre-wrap break-words">{text}</dd>
    </div>
  );
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  if (data == null) {
    return (
      <div>
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        <p className="mt-2 text-sm text-slate-500">（無資料）</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <pre className="mt-2 max-h-[480px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

const TAB_DEF = [
  { id: 1, title: "封面與基本資料" },
  { id: 2, title: "計畫書摘要表" },
  { id: 3, title: "壹、公司概況" },
  { id: 4, title: "貳、計畫內容與實施方式" },
  { id: 5, title: "參、預期效益" },
  { id: 6, title: "肆、預定進度及查核點" },
  { id: 7, title: "伍、人力及經費需求表" },
  { id: 8, title: "陸、附件" },
  { id: 9, title: "柒、PDF 預覽" },
] as const;

export function AdminReadOnlyApplicationTabs({ draft }: { draft: Record<string, unknown> }) {
  const [tab, setTab] = useState(1);
  const formData = useMemo(() => {
    const fd = draft.formData;
    return fd && typeof fd === "object" ? (fd as Record<string, unknown>) : {};
  }, [draft]);

  const isUpload = String(formData.submissionMode || "").toUpperCase() === "UPLOAD";
  const visibleTabs = isUpload ? TAB_DEF.filter((t) => t.id === 1) : [...TAB_DEF];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                tab === t.id ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {tab === 1 ? (
          <dl className="space-y-0">
            <Ro label="送件模式" value={formData.submissionMode} />
            <Ro label="計畫類別" value={formData.projectCategory} />
            <Ro label="計畫名稱" value={formData.projectName} />
            <Ro label="公司名稱" value={formData.companyName} />
            <Ro label="統一編號" value={formData.taxId} />
            <Ro label="計畫主持人" value={formData.projectManager} />
            <Ro label="聯絡人" value={formData.contactPerson} />
            <Ro label="聯絡電話" value={formData.contactPhone} />
            <Ro label="計畫起日" value={formData.projectStartDate} />
            <Ro label="計畫迄日" value={formData.projectEndDate} />
            <Ro label="計畫月數" value={formData.projectMonths} />
            <Ro label="負責人" value={formData.leaderName} />
            <Ro label="申請年度" value={formData.submitYear} />
            <Ro label="申請月份" value={formData.submitMonth} />
            <Ro label="已上傳計畫書 URL" value={formData.uploadedProposalUrl} />
          </dl>
        ) : null}

        {tab === 2 ? (
          <dl className="space-y-0">
            <Ro label="設立日期" value={formData.foundingDate} />
            <Ro label="主要營業項目" value={formData.mainBusinessItems} />
            <Ro label="計畫摘要" value={formData.summary} />
            <Ro label="創新重點" value={formData.innovationFocus} />
            <Ro label="執行優勢" value={formData.executionAdvantage} />
            <Ro label="預期效益（量化／質化）" value={formData.qualitativeBenefits} />
            <Ro label="附件勾選" value={formData.attachmentChecks} />
          </dl>
        ) : null}

        {tab === 3 ? <JsonBlock title="公司概況（companyProfile）" data={formData.companyProfile} /> : null}
        {tab === 4 ? (
          <div className="space-y-6">
            <JsonBlock title="計畫內容（planContent）" data={formData.planContent} />
            <JsonBlock title="架構樹（architectureTree）" data={draft.architectureTree} />
            <JsonBlock title="競品列（competitorRows）" data={draft.competitorRows} />
            <JsonBlock title="技轉列（techTransferRows）" data={draft.techTransferRows} />
            <JsonBlock title="圖片區（images）" data={draft.images} />
          </div>
        ) : null}
        {tab === 5 ? <JsonBlock title="預期效益（expectedBenefits）" data={formData.expectedBenefits} /> : null}
        {tab === 6 ? <JsonBlock title="預定進度及查核點（scheduleCheckpoints）" data={formData.scheduleCheckpoints} /> : null}
        {tab === 7 ? <JsonBlock title="人力及經費（humanBudget）" data={formData.humanBudget} /> : null}
        {tab === 8 ? <JsonBlock title="附件列表（files）" data={formData.files} /> : null}
        {tab === 9 ? (
          <p className="text-sm leading-relaxed text-slate-700">
            此為唯讀預覽模式，不提供即時產生 PDF。請回到「案件詳情」頁面，使用「新開視窗檢視最新 PDF」以檢視雲端計畫書。
          </p>
        ) : null}
      </div>
    </div>
  );
}
