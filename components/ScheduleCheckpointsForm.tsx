"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  SCHEDULE_KPI_TABLE_NOTE,
  SCHEDULE_PROGRESS_TABLE_NOTE,
  SCHEDULE_PROGRESS_WRITE_HINT,
} from "../lib/sbirAppendixNotes";

function newProgressRowId() {
  return `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

type ProgressRow = {
  id: string;
  item: string;
  weight: string;
  manMonths: string;
  months: Record<string, { progress: boolean; checkpoint: boolean }>;
};

type KpiRow = {
  code: string;
  description: string;
  period: string;
  weight: string;
  staffCode: string;
  // Internal identity: maps this KPI row back to the corresponding progress "work item" row id.
  workKey?: string;
  periodStartYear?: string;
  periodStartMonth?: string;
  periodEndYear?: string;
  periodEndMonth?: string;
};

const DEFAULT_MONTH_LABELS = ["7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月"] as const;

type TestReportImage = { id: string; name: string; size: string; url: string };

function TestReportImageUpload({
  value,
  onChange,
}: {
  value: TestReportImage[];
  onChange: (next: TestReportImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...value];
    Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .forEach((f) => {
        next.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: f.name,
          size: `${(f.size / 1024).toFixed(1)} KB`,
          url: URL.createObjectURL(f),
        });
      });
    onChange(next);
  };
  const remove = (id: string) => {
    const t = value.find((v) => v.id === id);
    if (t) URL.revokeObjectURL(t.url);
    onChange(value.filter((v) => v.id !== id));
  };
  return (
    <div className="mt-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="點擊或拖曳圖檔上傳測試報告與佐證照片"
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer"
      >
        <p className="text-sm font-medium">點擊或拖曳圖檔至此上傳（測試報告、照片等）</p>
        <p className="text-xs text-gray-400 mt-1">支援 JPG, PNG, GIF</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((img) => (
            <li key={img.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
              <span className="text-gray-700 truncate">{img.name}</span>
              <span className="text-gray-400 text-xs">{img.size}</span>
              <button type="button" onClick={() => remove(img.id)} className="text-red-600 hover:underline ml-2">
                移除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 依計畫起訖日產生月份標籤（民國年/月），例如 ["115/7", "115/8", ...] */
function getMonthLabelsFromRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [...DEFAULT_MONTH_LABELS];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [...DEFAULT_MONTH_LABELS];
  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endFirst = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endFirst) {
    const rocYear = cur.getFullYear() - 1911;
    out.push(`${rocYear}/${cur.getMonth() + 1}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out.length > 0 ? out : [...DEFAULT_MONTH_LABELS];
}

/** 計畫期間的民國年範圍，用於 KPI 起訖不得超過計畫期間 */
function getProjectRocYearRange(startDate: string, endDate: string): { min: number; max: number } {
  if (!startDate || !endDate) return { min: 111, max: 117 };
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { min: 111, max: 117 };
  return { min: start.getFullYear() - 1911, max: end.getFullYear() - 1911 };
}

export type ScheduleCheckpointsDraft = {
  rows: ProgressRow[];
  kpis: KpiRow[];
  notes: { progressNote: string; kpiNote: string };
  testReportImages?: { id: string; name: string; size: string; url: string }[];
};

export default function ScheduleCheckpointsForm({
  projectStartDate = "",
  projectEndDate = "",
  value,
  onChange,
}: {
  projectStartDate?: string;
  projectEndDate?: string;
  value?: ScheduleCheckpointsDraft;
  onChange?: (next: ScheduleCheckpointsDraft) => void;
}) {
  const fid = useId();
  const f = (key: string) => `${fid}-${key}`;

  const monthLabels = useMemo(
    () => getMonthLabelsFromRange(projectStartDate, projectEndDate),
    [projectStartDate, projectEndDate]
  );
  const monthsKey = useMemo(() => [...monthLabels], [monthLabels]);
  const monthAliasMap = useMemo(() => {
    const map = new Map<string, string>();
    monthsKey.forEach((k, idx) => {
      map.set(k, k);
      const m = k.match(/^(\d+)\/(\d+)$/);
      if (m) {
        const mm = String(Number(m[2]));
        map.set(`${mm}月`, k);
      }
      const fallback = DEFAULT_MONTH_LABELS[idx];
      if (fallback) map.set(fallback, k);
    });
    return map;
  }, [monthsKey]);

  const emptyMonths = useMemo(
    () => Object.fromEntries(monthsKey.map((m) => [m, { progress: false, checkpoint: false }])) as Record<string, { progress: boolean; checkpoint: boolean }>,
    [monthsKey]
  );

  const [rows, setRows] = useState<ProgressRow[]>([
    { id: "A", item: "A. 分項計畫", weight: "", manMonths: "", months: {} },
    { id: "A1", item: "A1. 工作項目（請填寫）", weight: "", manMonths: "", months: {} },
    { id: "A2", item: "A2. 工作項目（請填寫）", weight: "", manMonths: "", months: {} },
    { id: "B", item: "B. 分項計畫", weight: "", manMonths: "", months: {} },
    { id: "B1", item: "B1. 工作項目（請填寫）", weight: "", manMonths: "", months: {} },
    { id: "B2", item: "B2. 工作項目（請填寫）", weight: "", manMonths: "", months: {} },
  ]);

  const [kpis, setKpis] = useState<KpiRow[]>([]);

  const [notes, setNotes] = useState({ progressNote: "", kpiNote: "" });
  const [testReportImages, setTestReportImages] = useState<{ id: string; name: string; size: string; url: string }[]>([]);

  const rocYearRange = useMemo(() => getProjectRocYearRange(projectStartDate, projectEndDate), [projectStartDate, projectEndDate]);
  const rocYears = useMemo(() => Array.from({ length: rocYearRange.max - rocYearRange.min + 1 }, (_, i) => rocYearRange.min + i), [rocYearRange]);

  const normalizeMonthsByCurrentLabels = (rawMonths: Record<string, unknown>) => {
    const normalized = { ...emptyMonths };
    for (const [k, v] of Object.entries(rawMonths || {})) {
      const targetKey = monthAliasMap.get(k) || k;
      if (!(targetKey in normalized)) continue;
      if (v && typeof v === "object") {
        const o = v as { progress?: boolean; checkpoint?: boolean };
        normalized[targetKey] = { progress: !!o.progress, checkpoint: !!o.checkpoint };
      } else {
        normalized[targetKey] = { progress: !!v, checkpoint: false };
      }
    }
    return normalized;
  };

  useEffect(() => {
    if (!value) return;
    setRows(
      value.rows.map((r) => {
        const raw = (r.months || {}) as Record<string, unknown>;
        return { ...r, months: normalizeMonthsByCurrentLabels(raw) };
      })
    );
    setKpis(value.kpis.map(normalizeKpiPeriod));
    setNotes(value.notes);
    setTestReportImages(value.testReportImages ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalizeKpiPeriod(k: KpiRow): KpiRow {
    if (k.periodStartYear != null) return k;
    const m = k.period.match(/^(\d+)\/(\d+)~(\d+)\/(\d+)$/);
    if (m) return { ...k, periodStartYear: m[1], periodStartMonth: m[2], periodEndYear: m[3], periodEndMonth: m[4] };
    return k;
  }

  function buildKpiPeriod(k: KpiRow, sy?: string, sm?: string, ey?: string, em?: string): string {
    const a = sy ?? k.periodStartYear;
    const b = sm ?? k.periodStartMonth;
    const c = ey ?? k.periodEndYear;
    const d = em ?? k.periodEndMonth;
    if (a && b && c && d) return `${a}/${b}~${c}/${d}`;
    return k.period || "";
  }

  const extractWorkCode = (item: string) => {
    const s = String(item || "").trim();
    const m = s.match(/^([A-Za-z0-9]+)\s*[\.．、]/);
    if (m) return m[1];
    // Fallback: first token until whitespace
    return s.split(/\s+/)[0] || s;
  };

  const getMonthKeyFromKpi = (k: KpiRow): string | null => {
    if (k.periodStartYear && k.periodStartMonth) return `${k.periodStartYear}/${k.periodStartMonth}`;
    const m = String(k.period || "").match(/^(\d+)\/(\d+)~(\d+)\/(\d+)$/);
    if (!m) return null;
    return `${m[1]}/${m[2]}`;
  };

  const deriveKpisFromProgress = () => {
    const derived: Array<{ key: string; row: KpiRow }> = [];
    for (const r of rows) {
      // Skip分項計畫列（A/B）
      if (String(r.id || "").length === 1) continue;

      const workKey = r.id;
      const workName = r.item;
      const months = r.months ?? {};

      for (const mk of monthLabels) {
        const cell = months[mk] ?? { progress: false, checkpoint: false };
        if (!cell.checkpoint) continue;

        const [y, mo] = mk.split("/");
        const hasYmo = !!y && !!mo;
        const period = hasYmo ? `${y}/${mo}~${y}/${mo}` : mk;

        derived.push({
          key: `${workKey}|${mk}`,
          row: {
            workKey,
            code: String(workName || workKey),
            description: "",
            period,
            periodStartYear: hasYmo ? y : undefined,
            periodStartMonth: hasYmo ? mo : undefined,
            periodEndYear: hasYmo ? y : undefined,
            periodEndMonth: hasYmo ? mo : undefined,
            weight: "",
            staffCode: "",
          },
        });
      }
    }
    return derived;
  };

  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => {
        const raw = (r.months || {}) as Record<string, unknown>;
        return { ...r, months: normalizeMonthsByCurrentLabels(raw) };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthLabels.join(","), monthAliasMap]);

  const prevDerivedCountRef = useRef(0);
  useEffect(() => {
    const derived = deriveKpisFromProgress();
    setKpis((prev) => {
      const prevMap = new Map<string, KpiRow>();
      for (const k of prev) {
        const mk = getMonthKeyFromKpi(k);
        if (!mk) continue;
        const wk = k.workKey ?? extractWorkCode(k.code);
        prevMap.set(`${wk}|${mk}`, k);
      }

      return derived.map((d) => {
        const existing = prevMap.get(d.key);
        if (!existing) return d.row;
        return {
          ...d.row,
          description: existing.description ?? "",
          weight: existing.weight ?? "",
          staffCode: existing.staffCode ?? "",
        };
      });
    });
    prevDerivedCountRef.current = derived.length;
  }, [rows, monthLabels.join(",")]);

  useEffect(() => {
    if (!onChange) return;
    onChange({ rows, kpis, notes, testReportImages });
  }, [rows, kpis, notes, testReportImages, onChange]);

  const toggleMonth = (rowIdx: number, month: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      const cur = row.months[month] ?? { progress: false, checkpoint: false };
      next[rowIdx] = { ...row, months: { ...row.months, [month]: { ...cur, progress: !cur.progress } } };
      return next;
    });
  };

  const toggleCheckpoint = (rowIdx: number, month: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      const cur = row.months[month] ?? { progress: false, checkpoint: false };
      next[rowIdx] = { ...row, months: { ...row.months, [month]: { ...cur, checkpoint: !cur.checkpoint } } };
      return next;
    });
  };

  /** 權重僅合計「分項計畫」列：id 為單一英文字母（A、B、C…） */
  const totalWeight = rows.filter((r) => /^[A-Za-z]$/.test(r.id)).reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
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
            <Hint>填寫建議：先把分項計畫（A/B）與工作項目（A1/A2…）列好，再勾選每月查核點；分項計畫列之權重建議合計 100%。表後附完整法規說明。</Hint>

            <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1100px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 text-left w-80">月份／進度／工作項目</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">計畫權重（%）</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">預定投入人月</th>
                    {monthLabels.map((m) => (
                      <th key={m} className="px-3 py-3 border-r border-b border-gray-200">
                        {m}
                      </th>
                    ))}
                    <th className="px-3 py-3 border-b border-gray-200 w-24">操作</th>
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
                        <td key={m} className="p-2 border-r border-gray-200">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleMonth(rIdx, m)}
                              className={`w-6 h-6 rounded border transition-colors ${
                                r.months[m]?.progress ?? false
                                  ? "bg-gray-800 border-gray-800"
                                  : "bg-white border-gray-300 hover:border-gray-500"
                              }`}
                              aria-label={`${r.id}-${m}-progress`}
                              title="進度"
                            />
                            <button
                              type="button"
                              onClick={() => toggleCheckpoint(rIdx, m)}
                              className={`w-6 h-6 rounded-full border transition-colors ${
                                r.months[m]?.checkpoint ?? false
                                  ? "bg-emerald-600 border-emerald-600"
                                  : "bg-white border-gray-300 hover:border-gray-500"
                              }`}
                              aria-label={`${r.id}-${m}-checkpoint`}
                              title="查核點"
                            />
                          </div>
                        </td>
                      ))}
                      <td className="p-2 border-gray-200">
                        <button
                          type="button"
                          disabled={rows.length <= 1}
                          onClick={() => rows.length > 1 && setRows((prev) => prev.filter((_, i) => i !== rIdx))}
                          className="text-xs text-red-600 hover:text-red-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                          − 刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200 text-right">合計</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{totalWeight.toFixed(1)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{totalManMonths.toFixed(1)}</td>
                    <td className="px-4 py-3 border-r border-gray-200" colSpan={monthLabels.length}>
                      <span className="text-gray-500 text-xs">（分項計畫列權重之合計，建議 100%）</span>
                    </td>
                    <td className="px-4 py-3 border-gray-200" />
                  </tr>
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() =>
                setRows((prev) => {
                  const workItemCount = prev.filter((r) => String(r.item || "").includes("工作項目")).length;
                  const newCode = `W${workItemCount + 1}`;
                  return [
                    ...prev,
                    {
                      id: newCode,
                      item: `${newCode}. 工作項目（請填寫）`,
                      weight: "",
                      manMonths: "",
                      months: { ...emptyMonths },
                    },
                  ];
                })
              }
              className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增工作項目
            </button>

            <div className="mt-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap leading-relaxed">
              點選方框為進度，點選圓點為打開查核點開關；開啟查核點後，系統會自動在下方「二、預定查核點說明」帶入對應列。
              {"\n\n"}
              {SCHEDULE_PROGRESS_WRITE_HINT}
            </div>

            <div className="mt-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap leading-relaxed">
              {SCHEDULE_PROGRESS_TABLE_NOTE}
            </div>

            <div className="mt-6">
              <Label htmlFor={f("progressNote")}>補充說明</Label>
              <Hint>可補充每月產出物、驗證方式、是否需外部資源（設備/場域/合作單位）。</Hint>
              <textarea
                id={f("progressNote")}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white min-h-[120px] resize-y"
                value={notes.progressNote}
                onChange={(e) => setNotes((p) => ({ ...p, progressNote: e.target.value }))}
                placeholder="可補充：里程碑定義、每月產出物、驗證方式、進度判定標準等。"
              />
            </div>
          </section>

          <section className="mb-8 pt-8 border-t border-gray-200">
            <SectionTitle>二、預定查核點說明</SectionTitle>
            <Hint>KPI 建議寫成可驗證的量化/規格；並填起訖時間與負責人員編號。表後附完整法規說明。</Hint>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[980px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">查核點編號</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 text-left">查核點 KPI 量化說明</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-56">起訖時間</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">分配權重（%）</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-40">計畫人員編號</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k, idx) => (
                    <tr key={`${k.code}-${idx}`} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200 font-medium text-gray-700">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={k.code}
                          placeholder="A1"
                          readOnly
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
                        <div className="flex flex-wrap items-center gap-1 justify-center">
                          <select
                            className="border border-gray-200 rounded bg-white text-xs py-1 outline-none"
                            value={k.periodStartYear ?? ""}
                            disabled
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = kpis.map((r, i) => i === idx ? { ...r, periodStartYear: v, period: buildKpiPeriod(r, v, r.periodStartMonth, r.periodEndYear, r.periodEndMonth) } : r);
                              setKpis(next);
                            }}
                          >
                            <option value="">年</option>
                            {rocYears.map((y) => (
                              <option key={y} value={String(y)}>{y}</option>
                            ))}
                          </select>
                          <span className="text-gray-400">/</span>
                          <select
                            className="border border-gray-200 rounded bg-white text-xs py-1 outline-none"
                            value={k.periodStartMonth ?? ""}
                            disabled
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = kpis.map((r, i) => i === idx ? { ...r, periodStartMonth: v, period: buildKpiPeriod(r, r.periodStartYear, v, r.periodEndYear, r.periodEndMonth) } : r);
                              setKpis(next);
                            }}
                          >
                            <option value="">月</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <option key={m} value={String(m)}>{m}月</option>
                            ))}
                          </select>
                          <span className="text-gray-400">~</span>
                          <select
                            className="border border-gray-200 rounded bg-white text-xs py-1 outline-none"
                            value={k.periodEndYear ?? ""}
                            disabled
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = kpis.map((r, i) => i === idx ? { ...r, periodEndYear: v, period: buildKpiPeriod(r, r.periodStartYear, r.periodStartMonth, v, r.periodEndMonth) } : r);
                              setKpis(next);
                            }}
                          >
                            <option value="">年</option>
                            {rocYears.map((y) => (
                              <option key={y} value={String(y)}>{y}</option>
                            ))}
                          </select>
                          <span className="text-gray-400">/</span>
                          <select
                            className="border border-gray-200 rounded bg-white text-xs py-1 outline-none"
                            value={k.periodEndMonth ?? ""}
                            disabled
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = kpis.map((r, i) => i === idx ? { ...r, periodEndMonth: v, period: buildKpiPeriod(r, r.periodStartYear, r.periodStartMonth, r.periodEndYear, v) } : r);
                              setKpis(next);
                            }}
                          >
                            <option value="">月</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <option key={m} value={String(m)}>{m}月</option>
                            ))}
                          </select>
                        </div>
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
                      <td className="p-2 border-r border-gray-200">
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
                      <td className="p-2">
                        <button
                          type="button"
                          disabled={false}
                          onClick={() => {
                            const mk = getMonthKeyFromKpi(k);
                            if (!mk) return;
                            const workKey = k.workKey ?? extractWorkCode(k.code);
                            setRows((prev) =>
                              prev.map((r) => {
                                if (r.id !== workKey) return r;
                                const months = r.months ?? {};
                                const cell = months[mk] ?? { progress: false, checkpoint: false };
                                if (!cell.checkpoint) return r;
                                return { ...r, months: { ...months, [mk]: { ...cell, checkpoint: false } } };
                              })
                            );
                          }}
                          className="text-xs text-red-600 hover:text-red-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                          − 刪除
                        </button>
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
                    <td className="px-4 py-3 border-r border-gray-200 text-gray-500">─</td>
                    <td className="px-4 py-3 border-gray-200" />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap leading-relaxed">
              {SCHEDULE_KPI_TABLE_NOTE}
            </div>

            <div className="mt-6">
              <Label htmlFor={f("kpiNote")}>補充說明（期末結案指標/佐證資料/變更機制）</Label>
              <Hint>可列出需提供的佐證（測試報告、照片、合約、上線證明等）以及若需變更的申請流程。</Hint>
              <textarea
                id={f("kpiNote")}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white min-h-[120px] resize-y"
                value={notes.kpiNote}
                onChange={(e) => setNotes((p) => ({ ...p, kpiNote: e.target.value }))}
                placeholder="例如：期末結案指標（試營運KPI/訂單或MOU/營業額）、需提供的佐證資料（測試報告、照片、合約、上線證明等）、若需變更之申請機制。"
              />
              <div className="mt-4">
                <p id={f("test-upload-legend")} className="block text-sm font-medium text-gray-700 mb-1">
                  測試報告／佐證圖檔上傳
                </p>
              </div>
              <div role="group" aria-labelledby={f("test-upload-legend")}>
                <TestReportImageUpload value={testReportImages} onChange={setTestReportImages} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

