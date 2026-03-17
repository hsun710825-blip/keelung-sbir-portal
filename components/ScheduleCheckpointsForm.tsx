"use client";

import React, { useEffect, useMemo, useState } from "react";

// --- 共用小元件（沿用公司概況視覺風格） ---
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xl font-medium text-gray-800 border-l-4 border-gray-400 pl-3 mb-6">
    {children}
  </h2>
);

const SubTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-medium text-gray-700 mt-8 mb-4 flex items-center gap-2">
    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
    {children}
  </h3>
);

const Hint = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs text-gray-500 leading-relaxed -mt-2 mb-3">
    {children}
  </div>
);

const Label = ({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

type ProgressRow = {
  id: string;
  item: string;
  weight: string;
  manMonths: string;
  months: Record<string, boolean>;
};

type KpiRow = {
  code: string;
  description: string;
  period: string;
  weight: string;
  staffCode: string;
};

const monthLabels = ["7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月"] as const;

export type ScheduleCheckpointsDraft = {
  rows: ProgressRow[];
  kpis: KpiRow[];
  notes: { progressNote: string; kpiNote: string };
};

export default function ScheduleCheckpointsForm({
  value,
  onChange,
}: {
  value?: ScheduleCheckpointsDraft;
  onChange?: (next: ScheduleCheckpointsDraft) => void;
}) {
  const monthsKey = useMemo(() => monthLabels.map((m) => m), []);

  const emptyMonths = useMemo(() => Object.fromEntries(monthsKey.map((m) => [m, false])) as Record<string, boolean>, [monthsKey]);

  const [rows, setRows] = useState<ProgressRow[]>([
    { id: "A", item: "A. 分項計畫", weight: "", manMonths: "", months: { ...emptyMonths } },
    { id: "A1", item: "A1. 工作項目（請填寫）", weight: "", manMonths: "", months: { ...emptyMonths } },
    { id: "A2", item: "A2. 工作項目（請填寫）", weight: "", manMonths: "", months: { ...emptyMonths } },
    { id: "B", item: "B. 分項計畫", weight: "", manMonths: "", months: { ...emptyMonths } },
    { id: "B1", item: "B1. 工作項目（請填寫）", weight: "", manMonths: "", months: { ...emptyMonths } },
    { id: "B2", item: "B2. 工作項目（請填寫）", weight: "", manMonths: "", months: { ...emptyMonths } },
  ]);

  const [kpis, setKpis] = useState<KpiRow[]>([
    { code: "A1", description: "", period: "", weight: "", staffCode: "" },
    { code: "A2", description: "", period: "", weight: "", staffCode: "" },
    { code: "B1", description: "", period: "", weight: "", staffCode: "" },
    { code: "B2", description: "", period: "", weight: "", staffCode: "" },
    { code: "B3", description: "", period: "", weight: "", staffCode: "" },
  ]);

  const [notes, setNotes] = useState({ progressNote: "", kpiNote: "" });

  useEffect(() => {
    if (!value) return;
    setRows(value.rows);
    setKpis(value.kpis);
    setNotes(value.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!onChange) return;
    onChange({ rows, kpis, notes });
  }, [rows, kpis, notes, onChange]);

  const toggleMonth = (rowIdx: number, month: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      next[rowIdx] = { ...row, months: { ...row.months, [month]: !row.months[month] } };
      return next;
    });
  };

  const totalWeight = rows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
  const totalManMonths = rows.reduce((acc, r) => acc + (Number(r.manMonths) || 0), 0);

  return (
    <div className="bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-800 text-white px-8 py-6">
          <h1 className="text-2xl font-semibold tracking-wider">肆、預定進度及查核點</h1>
          <p className="text-gray-300 text-sm mt-2">各分項計畫 3 個月至少應有一項查核點，內容須具體明確。</p>
        </div>

        <div className="p-8">
          <section className="mb-12">
            <SectionTitle>一、預定進度表</SectionTitle>
            <div className="text-sm text-gray-600 bg-gray-50/60 border border-gray-100 rounded-lg p-4 leading-relaxed">
              註：1) 各分項計畫 3 個月至少應有一項查核點 2) 請依工作項目順序填註，並與研發組織/人力相對應
              3) 進度百分比可參照經費預算執行比例 4) 本表如不敷使用請自行依格式調整。
            </div>
            <Hint>填寫建議：先把分項計畫（A/B）與工作項目（A1/A2…）列好，再勾選每月查核點；權重建議合計 100%。</Hint>

            <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1100px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 text-left w-80">月份／進度／工作項目</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">計畫權重（%）</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">預定投入人月</th>
                    {monthLabels.map((m) => (
                      <th key={m} className="px-3 py-3 border-b border-gray-200">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, rIdx) => (
                    <tr key={r.id} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200 text-left">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.item}
                          onChange={(e) => {
                            const next = [...rows];
                            next[rIdx] = { ...next[rIdx], item: e.target.value };
                            setRows(next);
                          }}
                          placeholder="例如：A1. 需求分析與規格定義"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          type="number"
                          className="w-full bg-transparent outline-none px-2 py-1 text-right"
                          value={r.weight}
                          onChange={(e) => {
                            const next = [...rows];
                            next[rIdx] = { ...next[rIdx], weight: e.target.value };
                            setRows(next);
                          }}
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          type="number"
                          step="0.1"
                          className="w-full bg-transparent outline-none px-2 py-1 text-right"
                          value={r.manMonths}
                          onChange={(e) => {
                            const next = [...rows];
                            next[rIdx] = { ...next[rIdx], manMonths: e.target.value };
                            setRows(next);
                          }}
                          placeholder="0"
                        />
                      </td>
                      {monthLabels.map((m) => (
                        <td key={m} className="p-2 border-gray-200">
                          <button
                            type="button"
                            onClick={() => toggleMonth(rIdx, m)}
                            className={`w-6 h-6 rounded border transition-colors ${
                              r.months[m] ? "bg-gray-800 border-gray-800" : "bg-white border-gray-300 hover:border-gray-500"
                            }`}
                            aria-label={`${r.id}-${m}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200 text-right">合計</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{totalWeight.toFixed(1)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{totalManMonths.toFixed(1)}</td>
                    <td className="px-4 py-3" colSpan={monthLabels.length}>
                      <span className="text-gray-500 text-xs">（此列僅供檢核：權重建議合計 100%）</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Label>補充說明</Label>
              <Hint>可補充每月產出物、驗證方式、是否需外部資源（設備/場域/合作單位）。</Hint>
              <textarea
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white min-h-[120px] resize-y"
                value={notes.progressNote}
                onChange={(e) => setNotes((p) => ({ ...p, progressNote: e.target.value }))}
                placeholder="可補充：里程碑定義、每月產出物、驗證方式、進度判定標準等。"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { id: `X${prev.length + 1}`, item: "新增工作項目（請填寫）", weight: "", manMonths: "", months: { ...emptyMonths } },
                ])
              }
              className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增一列
            </button>
          </section>

          <section className="mb-8 pt-8 border-t border-gray-200">
            <SectionTitle>二、預定查核點說明</SectionTitle>
            <div className="text-sm text-gray-600 bg-gray-50/60 border border-gray-100 rounded-lg p-4 leading-relaxed">
              請依時間序編號及填寫查核點 KPI 量化內容或規格說明，並給予分配權重（%）以表示其佔計畫整體重要性；期末結案指標須呼應計畫目標。
            </div>
            <Hint>KPI 建議寫成可驗證的量化/規格：例如「完成原型並通過測試（指標X≥Y、報告編號）」；並填起訖時間與負責人員編號。</Hint>

            <SubTitle>查核點 KPI 表</SubTitle>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[980px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">查核點編號</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 text-left">查核點 KPI 量化說明</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-56">起訖時間</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">分配權重（%）</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-40">計畫人員編號</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k, idx) => (
                    <tr key={`${k.code}-${idx}`} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200 font-medium text-gray-700">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={k.code}
                          onChange={(e) => {
                            const next = [...kpis];
                            next[idx] = { ...next[idx], code: e.target.value };
                            setKpis(next);
                          }}
                          placeholder="A1"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200 text-left">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={k.description}
                          onChange={(e) => {
                            const next = [...kpis];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setKpis(next);
                          }}
                          placeholder="例如：完成原型驗證（功能X、效能Y、通過測試Z）並提供測試報告"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={k.period}
                          onChange={(e) => {
                            const next = [...kpis];
                            next[idx] = { ...next[idx], period: e.target.value };
                            setKpis(next);
                          }}
                          placeholder="年 月 日 ~ 年 月 日"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          type="number"
                          className="w-full bg-transparent outline-none px-2 py-1 text-right"
                          value={k.weight}
                          onChange={(e) => {
                            const next = [...kpis];
                            next[idx] = { ...next[idx], weight: e.target.value };
                            setKpis(next);
                          }}
                          placeholder="0"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={k.staffCode}
                          onChange={(e) => {
                            const next = [...kpis];
                            next[idx] = { ...next[idx], staffCode: e.target.value };
                            setKpis(next);
                          }}
                          placeholder="例如：1 / 2 / A / PM"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200">合計</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-left text-gray-500">─</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-gray-500">─</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">
                      {kpis.reduce((acc, r) => acc + (Number(r.weight) || 0), 0).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">─</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Label>補充說明（期末結案指標/佐證資料/變更機制）</Label>
              <Hint>可列出需提供的佐證（測試報告、照片、合約、上線證明等）以及若需變更的申請流程。</Hint>
              <textarea
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white min-h-[120px] resize-y"
                value={notes.kpiNote}
                onChange={(e) => setNotes((p) => ({ ...p, kpiNote: e.target.value }))}
                placeholder="例如：期末結案指標（試營運KPI/訂單或MOU/營業額）、需提供的佐證資料（測試報告、照片、合約、上線證明等）、若需變更之申請機制。"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setKpis((prev) => [
                  ...prev,
                  { code: "", description: "", period: "", weight: "", staffCode: "" },
                ])
              }
              className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增一列
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

