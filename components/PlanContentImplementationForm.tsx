"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";

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

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white min-h-[120px] resize-y"
    {...props}
  />
);

type UploadedImage = {
  id: string;
  name: string;
  size: string;
  url: string;
  dataUrl?: string;
};

function ImageDropzone({
  value,
  onChange,
  label = "點擊或拖曳圖片至此上傳",
}: {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickFiles = () => inputRef.current?.click();

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = [...value];
    const accepted = Array.from(files).filter((f) => ["image/png", "image/jpeg", "image/jpg"].includes((f.type || "").toLowerCase()));
    const dataUrls = await Promise.all(
      accepted.map(async (f) => {
        try {
          return await fileToDataUrl(f);
        } catch {
          return "";
        }
      })
    );
    accepted.forEach((f, idx) => {
      next.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: f.name,
        size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
        url: URL.createObjectURL(f),
        dataUrl: dataUrls[idx] || undefined,
      });
    });
    onChange(next);
  };

  const remove = (id: string) => {
    const target = value.find((v) => v.id === id);
    if (target) URL.revokeObjectURL(target.url);
    onChange(value.filter((v) => v.id !== id));
  };

  return (
    <div className="mt-3">
      <div
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-all cursor-pointer bg-white"
        onClick={() => pickFiles()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickFiles();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        aria-label={label}
      >
        <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-400 mt-1">支援 JPG, PNG, GIF 格式（可多選）</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {value.length > 0 && (
        <div className="mt-4 space-y-2">
          {value.map((img) => (
            <div key={img.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-md border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0">
                  <img src={img.url} alt={`已上傳圖片：${img.name}`} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">{img.name}</div>
                  <div className="text-xs text-gray-400">{img.size}</div>
                </div>
              </div>
              <button type="button" onClick={() => remove(img.id)} className="text-sm text-red-600 hover:text-red-700 font-medium">
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type TreeNode = {
  id: string;
  text: string;
  weight?: string; // percent, e.g. "30"
  execUnit?: string; // 執行單位
  children: TreeNode[];
};

function newNode(text = ""): TreeNode {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, weight: "", execUnit: "", children: [] };
}

function createDefaultArchitectureTemplate(): TreeNode {
  return {
    id: `${Date.now()}-root-${Math.random().toString(16).slice(2)}`,
    text: "○○○○○計畫",
    weight: "100",
    execUnit: "",
    children: [
      {
        id: `${Date.now()}-a-${Math.random().toString(16).slice(2)}`,
        text: "A 分項計畫",
        weight: "0",
        execUnit: "本公司",
        children: [
          { id: `${Date.now()}-a1-${Math.random().toString(16).slice(2)}`, text: "A-1分項計畫", weight: "0", execUnit: "○○○○", children: [] },
          { id: `${Date.now()}-a2-${Math.random().toString(16).slice(2)}`, text: "A-2分項計畫", weight: "0", execUnit: "○○○○", children: [] },
        ],
      },
      {
        id: `${Date.now()}-b-${Math.random().toString(16).slice(2)}`,
        text: "B 分項計畫",
        weight: "0",
        execUnit: "AAA公司",
        children: [
          { id: `${Date.now()}-b1-${Math.random().toString(16).slice(2)}`, text: "B-1分項計畫", weight: "0", execUnit: "○○○○", children: [] },
          { id: `${Date.now()}-b2-${Math.random().toString(16).slice(2)}`, text: "B-2分項計畫", weight: "0", execUnit: "○○○○", children: [] },
        ],
      },
    ],
  };
}

function normalizeTreeNode(n: TreeNode): TreeNode {
  return {
    ...n,
    weight: n.weight ?? "",
    execUnit: n.execUnit ?? "",
    children: (n.children || []).map(normalizeTreeNode),
  };
}

function HorizontalTreeEditor({
  value,
  onChange,
}: {
  value: TreeNode;
  onChange: (next: TreeNode) => void;
}) {
  const latestValueRef = useRef(value);
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const updateNode = useCallback((node: TreeNode, id: string, updater: (n: TreeNode) => TreeNode): TreeNode => {
    if (node.id === id) return updater(node);
    return { ...node, children: node.children.map((c) => updateNode(c, id, updater)) };
  }, []);

  const removeNode = useCallback((node: TreeNode, id: string): TreeNode => {
    return { ...node, children: node.children.filter((c) => c.id !== id).map((c) => removeNode(c, id)) };
  }, []);

  const patchNode = useCallback(
    (id: string, patch: Partial<TreeNode>) => {
      onChange(updateNode(latestValueRef.current, id, (n) => ({ ...n, ...patch })));
    },
    [onChange, updateNode]
  );

  const renderBranch = (
    node: TreeNode,
    depth: number,
    branch: { isRoot: boolean; isFirst: boolean; isLast: boolean; isOnly: boolean }
  ): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.id} className="flex flex-row items-stretch shrink-0 min-h-0">
        {!branch.isRoot && (
          <div className="flex w-4 shrink-0 flex-col items-stretch self-stretch">
            <div
              className={`min-h-[6px] flex-1 border-r-2 border-black shrink-0 ${
                branch.isFirst || branch.isOnly ? "border-r-transparent" : ""
              }`}
            />
            <div className="h-0.5 w-full bg-black shrink-0" />
            <div
              className={`min-h-[6px] flex-1 border-r-2 border-black shrink-0 ${
                branch.isLast || branch.isOnly ? "border-r-transparent" : ""
              }`}
            />
          </div>
        )}

        <div className="flex flex-row items-stretch shrink-0">
          <div className="flex flex-col justify-center shrink-0">
            <div className="rounded-lg border border-gray-200 bg-white/90 p-2 shadow-sm w-[min(100vw-4rem,288px)] max-w-xs">
              <div className="flex flex-col gap-2">
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
                  value={node.text ?? ""}
                  onChange={(e) => patchNode(node.id, { text: e.target.value })}
                  placeholder={
                    depth === 0 ? "請輸入計畫架構主幹（例如：整體架構/分項計畫）" : "請輸入節點內容（例如：A1 需求分析）"
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    className="w-24 shrink-0 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
                    value={node.weight ?? ""}
                    onChange={(e) => patchNode(node.id, { weight: e.target.value })}
                    placeholder="%權重"
                    inputMode="numeric"
                  />
                  <input
                    className="min-w-[7rem] flex-1 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
                    value={node.execUnit ?? ""}
                    onChange={(e) => patchNode(node.id, { execUnit: e.target.value })}
                    placeholder="執行單位"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button
                    type="button"
                    className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                    onClick={() =>
                      onChange(updateNode(latestValueRef.current, node.id, (n) => ({ ...n, children: [...n.children, newNode("")] })))
                    }
                  >
                    + 新增子計畫
                  </button>
                  {depth > 0 && (
                    <button
                      type="button"
                      className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-red-600"
                      onClick={() => onChange(removeNode(latestValueRef.current, node.id))}
                    >
                      − 刪除
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {hasChildren ? (
            <div className="flex flex-row items-stretch shrink-0">
              <div className="flex w-3.5 shrink-0 flex-col justify-center">
                <div className="h-0.5 w-full bg-black" />
              </div>
              <div className="flex flex-col shrink-0 justify-center gap-0 py-1">
                {node.children.map((child, index) =>
                  renderBranch(child, depth + 1, {
                    isRoot: false,
                    isFirst: index === 0,
                    isLast: index === node.children.length - 1,
                    isOnly: node.children.length === 1,
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-2 space-y-3">
      <div className="text-xs text-gray-500">
        由左至右橫向建立樹枝圖，並為各節點填寫「權重(%)」與「執行單位」以符合計畫書原格式。建議與 A/B 分項及 A1/A2… 工作項目對齊後續進度表與 KPI 編號。
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50/50">
        <div className="inline-block min-w-max p-4">{renderBranch(value, 0, { isRoot: true, isFirst: false, isLast: false, isOnly: false })}</div>
      </div>
    </div>
  );
}

export type CompetitorRow = {
  name: string;
  price: string;
  launchTime: string;
  marketShare: string;
  segment: string;
  channel: string;
  advantage: string;
};

export type TechTransferRow = {
  item: "技術及智慧財產權移轉" | "委託研究" | "委託勞務";
  target: string;
  budget: string;
  content: string;
  period: string;
  periodStartYear?: string;
  periodStartMonth?: string;
  periodEndYear?: string;
  periodEndMonth?: string;
};

function buildPeriod(
  row: TechTransferRow,
  sy?: string,
  sm?: string,
  ey?: string,
  em?: string
): string {
  const a = sy ?? row.periodStartYear;
  const b = sm ?? row.periodStartMonth;
  const c = ey ?? row.periodEndYear;
  const d = em ?? row.periodEndMonth;
  if (a && b && c && d) return `${a}/${b}~${c}/${d}`;
  return row.period || "";
}

export type PlanContentDraft = {
  formData: {
    background: string;
    industryStatus: string;
    industryTrends: string;
    feasibility: string;
    innovation: string;
    architectureTreeJson: string;
    stepsMethod: string;
    techTransferAnalysis: string;
    ipRisk: string;
  };
  architectureTree: TreeNode;
  competitorRows: CompetitorRow[];
  techTransferRows: TechTransferRow[];
  images: Record<string, UploadedImage[]>;
};

export default function PlanContentImplementationForm({
  value,
  onChange,
}: {
  value?: PlanContentDraft;
  onChange?: (next: PlanContentDraft) => void;
}) {
  const fid = useId();
  const f = (key: string) => `${fid}-${key}`;

  const [formData, setFormData] = useState({
    background: "",
    industryStatus: "",
    industryTrends: "",
    feasibility: "",
    innovation: "",
    architectureTreeJson: "",
    stepsMethod: "",
    techTransferAnalysis: "",
    ipRisk: "",
  });

  const [architectureTree, setArchitectureTree] = useState<TreeNode>(createDefaultArchitectureTemplate());
  const [competitorRows, setCompetitorRows] = useState<CompetitorRow[]>([
    { name: "申請人（本計畫研發標的）", price: "", launchTime: "", marketShare: "", segment: "", channel: "", advantage: "" },
    { name: "A公司", price: "", launchTime: "", marketShare: "", segment: "", channel: "", advantage: "" },
    { name: "B公司", price: "", launchTime: "", marketShare: "", segment: "", channel: "", advantage: "" },
    { name: "C公司", price: "", launchTime: "", marketShare: "", segment: "", channel: "", advantage: "" },
  ]);
  const [techTransferRows, setTechTransferRows] = useState<TechTransferRow[]>([
    { item: "技術及智慧財產權移轉", target: "", budget: "", content: "", period: "" },
    { item: "委託研究", target: "", budget: "", content: "", period: "" },
    { item: "委託勞務", target: "", budget: "", content: "", period: "" },
  ]);
  const [images, setImages] = useState<Record<string, UploadedImage[]>>({
    background: [],
    industryStatus: [],
    industryTrends: [],
    feasibility: [],
    innovation: [],
    stepsMethod: [],
    techTransferAnalysis: [],
    ipRisk: [],
  });

  function normalizeTechTransferRow(row: TechTransferRow): TechTransferRow {
    if (row.periodStartYear != null) return row;
    const m = row.period.match(/^(\d+)\/(\d+)~(\d+)\/(\d+)$/);
    if (m) {
      return { ...row, periodStartYear: m[1], periodStartMonth: m[2], periodEndYear: m[3], periodEndMonth: m[4] };
    }
    return row;
  }

  const didInitFromValue = useRef(false);
  useEffect(() => {
    if (didInitFromValue.current) return;
    if (!value) {
      didInitFromValue.current = true;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(value.formData);
    const normalized = normalizeTreeNode(value.architectureTree);
    const hasContent = Boolean((normalized.text || "").trim()) || (normalized.children?.length ?? 0) > 0;
    setArchitectureTree(hasContent ? normalized : createDefaultArchitectureTemplate());
    setCompetitorRows(value.competitorRows);
    setTechTransferRows(value.techTransferRows.map(normalizeTechTransferRow));
    setImages(value.images);
    didInitFromValue.current = true;
  }, [value]);

  // Debounce JSON serialization to prevent input lag in large trees.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFormData((p) => ({ ...p, architectureTreeJson: JSON.stringify(architectureTree) }));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [architectureTree]);

  // Debounce outward onChange to avoid IME/composition disruption and heavy parent re-renders while typing.
  useEffect(() => {
    if (!onChange) return;
    const handle = window.setTimeout(() => {
      onChange({ formData, architectureTree, competitorRows, techTransferRows, images });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [formData, architectureTree, competitorRows, techTransferRows, images, onChange]);

  // Back-compat aliases for existing JSX below
  const competitors = competitorRows;
  const setCompetitors = setCompetitorRows;
  const techTransfers = techTransferRows;
  const setTechTransfers = setTechTransferRows;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-800 text-white px-8 py-6">
          <h1 className="text-2xl font-semibold tracking-wider">貳、計畫內容與實施方式</h1>
          <p className="text-gray-300 text-sm mt-2">請依計畫書格式完整敘述背景、分析、架構與執行方式。</p>
        </div>

        <div className="p-8">
          <section className="mb-12">
            <SectionTitle>
              一、背景與說明 (請說明計畫背景、面臨的問題、市場、環境及使用者之需求、未來對客戶層、使用者產生之效益等計畫發展願景)
            </SectionTitle>
            <Label required htmlFor={f("background")}>計畫背景、面臨的問題、市場/環境與使用者需求、發展願景</Label>
            <Hint>建議用「痛點→原因→目標→受益者→願景」寫法；若需於段落間插入圖片，請於文字中輸入 /p，系統將依序替換為上傳之圖片。未輸入則統一置於段落底部。</Hint>
            <Textarea
              id={f("background")}
              name="background"
              value={formData.background}
              onChange={handleChange}
              placeholder="請說明：1) 背景與痛點 2) 目標客群/使用者需求 3) 產業與市場環境 4) 本計畫欲解決的問題與願景..."
            />
            <ImageDropzone value={images.background} onChange={(next) => setImages((p) => ({ ...p, background: next }))} />
          </section>

          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>
              二、國內外產業現況、發展趨勢及競爭力分析 (請註明索引據資料來源)
            </SectionTitle>

            <SubTitle>（一）國內外產業現況與發展方向</SubTitle>
            <Label required htmlFor={f("industryStatus")}>產業現況與趨勢（請註明資料來源）</Label>
            <Hint>請至少引用 1–3 個可信來源（政府統計/研究報告/論文/產業報告），並說明與本案關聯；若需於段落間插入圖片，請於文字中輸入 /p，系統將依序替換為上傳之圖片。未輸入則統一置於段落底部。</Hint>
            <Textarea
              id={f("industryStatus")}
              name="industryStatus"
              value={formData.industryStatus}
              onChange={handleChange}
              placeholder="請說明國內外產業現況、關鍵技術/服務發展、目標市場規模與變化，並註明資料來源（例：報告/論文/統計/官方網站）。"
            />
            <ImageDropzone value={images.industryStatus} onChange={(next) => setImages((p) => ({ ...p, industryStatus: next }))} />

            <div className="mt-6">
              <Label htmlFor={f("industryTrends")}>補充：趨勢與規格/功能/成本比較</Label>
              <Hint>建議列出比較表：本案 vs 既有方案（規格、效能、成本、導入門檻、維運）。</Hint>
              <Textarea
                id={f("industryTrends")}
                name="industryTrends"
                value={formData.industryTrends}
                onChange={handleChange}
                placeholder="請與國內外既有技術/產品/服務比較：技術規格、功能應用、成本結構、導入門檻等。"
              />
              <ImageDropzone value={images.industryTrends} onChange={(next) => setImages((p) => ({ ...p, industryTrends: next }))} />
            </div>

            <SubTitle>（二）競爭力分析（產品/服務競爭優勢比較）</SubTitle>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-left text-gray-600 min-w-[1050px]">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 border-r border-gray-200 w-56" rowSpan={2}>
                      項目
                    </th>
                    <th className="px-4 py-3 border-r border-gray-200">名稱</th>
                    <th className="px-4 py-3 border-r border-gray-200" rowSpan={2}>
                      A公司
                    </th>
                    <th className="px-4 py-3 border-r border-gray-200" rowSpan={2}>
                      B公司
                    </th>
                    <th className="px-4 py-3" rowSpan={2}>
                      C公司
                    </th>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 border-r border-gray-200">申請人(本計畫研發標的)</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: "1. 價格(單位： )", key: "price" as const, placeholder: "例如：$2,000/套", isMarketShare: false },
                    { label: "2. 產品/服務上市時間", key: "launchTime" as const, placeholder: "例如：2026/01", isMarketShare: false },
                    { label: "3. 市場占有率(%)", key: "marketShare" as const, placeholder: "0", isMarketShare: true },
                    { label: "4. 市場區隔", key: "segment" as const, placeholder: "例如：中小企業/政府", isMarketShare: false },
                    { label: "5. 行銷管道", key: "channel" as const, placeholder: "例如：直銷/代理/平台", isMarketShare: false },
                    { label: "6. 技術或服務優勢", key: "advantage" as const, placeholder: "請條列優勢重點", isMarketShare: false },
                  ] as const).map((rowItem) => {
                    const f = rowItem.key;
                    return (
                      <tr key={rowItem.key} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 border-r border-gray-200 font-medium text-gray-700 whitespace-nowrap">{rowItem.label}</td>
                        {[0, 1, 2, 3].map((companyIdx) => (
                          <td
                            key={companyIdx}
                            className={`px-4 py-2 ${companyIdx < 3 ? "border-r border-gray-200" : ""}`}
                          >
                            {rowItem.key === "advantage" ? (
                              <textarea
                                className="w-full bg-transparent outline-none px-2 py-1 min-h-[72px] resize-y whitespace-pre-wrap break-words"
                                value={(competitors[companyIdx] as CompetitorRow | undefined)?.[f] ?? ""}
                                onChange={(e) => {
                                  const next = [...competitors];
                                  const cur = next[companyIdx] ?? ({} as CompetitorRow);
                                  next[companyIdx] = { ...cur, [f]: e.target.value } as CompetitorRow;
                                  setCompetitors(next);
                                }}
                                placeholder={"請逐點條列（可按 Enter 換行）"}
                                aria-label={`競爭力分析 ${rowItem.label}（${competitors[companyIdx]?.name ?? `公司欄位 ${companyIdx + 1}`}）`}
                              />
                            ) : (
                              <input
                                className={`w-full bg-transparent outline-none px-2 py-1 ${
                                  rowItem.isMarketShare ? "text-right" : ""
                                }`}
                                type="text"
                                inputMode={rowItem.isMarketShare ? "decimal" : undefined}
                                value={(competitors[companyIdx] as CompetitorRow | undefined)?.[f] ?? ""}
                                onChange={(e) => {
                                  const next = [...competitors];
                                  const cur = next[companyIdx] ?? ({} as CompetitorRow);
                                  next[companyIdx] = { ...cur, [f]: e.target.value } as CompetitorRow;
                                  setCompetitors(next);
                                }}
                                placeholder={rowItem.placeholder}
                                aria-label={`競爭力分析 ${rowItem.label}（${competitors[companyIdx]?.name ?? `公司欄位 ${companyIdx + 1}`}）`}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <SubTitle>
              （三）計畫可行性分析 (依計畫屬性與內容，客觀評估分析本案整體之可行性程度，如市場商機、營運模式、系統 技術、商品化 應用或其他優勢等說明。)
            </SubTitle>
            <Label required htmlFor={f("feasibility")}>市場商機、營運模式、系統/技術、商品化/應用或其他優勢</Label>
            <Hint>請把「可行性」寫成可驗證：市場假設、驗證方法、里程碑、風險與對策；若需於段落間插入圖片，請於文字中輸入 /p，系統將依序替換為上傳之圖片。未輸入則統一置於段落底部。</Hint>
            <Textarea
              id={f("feasibility")}
              name="feasibility"
              value={formData.feasibility}
              onChange={handleChange}
              placeholder="請客觀評估本案可行性：市場需求與規模、目標客戶、營運模式、技術可行性與風險、驗證路徑、商品化/導入策略等。"
            />
            <ImageDropzone value={images.feasibility} onChange={(next) => setImages((p) => ({ ...p, feasibility: next }))} />
          </section>

          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>三、創新性說明</SectionTitle>
            <Label required htmlFor={f("innovation")}>本計畫創意、構想、研發或服務標的之創新性</Label>
            <Hint>建議聚焦 1–3 個創新點，並用可量測指標描述（例如：成本降低%、效率提升%、準確率）。若需於段落間插入圖片，請於文字中輸入 /p，系統將依序替換為上傳之圖片。未輸入則統一置於段落底部。</Hint>
            <Textarea
              id={f("innovation")}
              name="innovation"
              value={formData.innovation}
              onChange={handleChange}
              placeholder="請說明與既有技術/服務的差異、創新點、關鍵突破、可被保護/擴張之要素（如：演算法、流程、資料、服務模式）。"
            />
            <ImageDropzone value={images.innovation} onChange={(next) => setImages((p) => ({ ...p, innovation: next }))} />
          </section>

          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>四、計畫架構與實施方式</SectionTitle>

            <SubTitle>（一）計畫架構（請以樹枝圖撰寫）</SubTitle>
            <p id={f("architecture-legend")} className="block text-sm font-medium text-gray-700 mb-1">
              分項計畫/開發技術、占比、執行單位、委託研究/技術引進 <span className="text-red-500">*</span>
            </p>
            <Hint>請先建立主幹（整體架構），再往下拆分分項計畫（A/B）與工作項目（A1/A2…）；建議與後續進度表、KPI 編號一致。</Hint>
            <div role="group" aria-labelledby={f("architecture-legend")}>
            <HorizontalTreeEditor
              value={architectureTree}
              onChange={(next) => {
                setArchitectureTree(next);
              }}
            />
            </div>
            <div className="text-xs text-gray-500 leading-relaxed -mt-2 mb-3 whitespace-pre-wrap break-words">
              請註明下列資料：
              {"\n"}1.開發計畫中各分項計畫及所開發技術依開發經費占總開發費用之百分比。
              {"\n"}2.執行該分項計畫 開發技術之單位。
              {"\n"}3.若有委託研究或技術引進請一併列入計畫架構。
            </div>

            <SubTitle>（二）執行步驟及方法</SubTitle>
            <Label required htmlFor={f("stepsMethod")}>流程、驗證/測試、修正流程與預期結果</Label>
            <Hint>請以步驟條列：輸入→處理→輸出→驗證；並說明每步驟產出物。若需於段落間插入圖片，請於文字中輸入 /p，系統將依序替換為上傳之圖片。未輸入則統一置於段落底部。</Hint>
            <Textarea
              id={f("stepsMethod")}
              name="stepsMethod"
              value={formData.stepsMethod}
              onChange={handleChange}
              placeholder="請以流程圖/條列說明：各分項工作步驟、里程碑、驗證測試方式、修正迭代流程、試營運/服務模式（如適用），以及各階段產出。"
            />
            <div className="text-xs text-gray-500 leading-relaxed mt-2 mb-1 whitespace-pre-wrap break-words">
              ※本項撰寫參考建議
              {"\n"}技術開發：以計畫架構項目用流程圖示逐項說明本計畫進行步驟與實施方式，並有驗證測試、商品化開發之修正流程等之具體性與結果。
              {"\n"}創新服務: 從需求端以服務流、資訊流、金流等等表達計畫架構項目，用流程圖示逐項說明本計畫進行步驟與實施方式，並有試營運 服務模式等機制，以驗證該商業模式、電子商務或服務模式之可行性與結果。
            </div>
            <ImageDropzone value={images.stepsMethod} onChange={(next) => setImages((p) => ({ ...p, stepsMethod: next }))} />

            <SubTitle>（三）技術移轉來源分析：擬與業界、學術界及其他研究機構合作計畫</SubTitle>
            <Label htmlFor={f("techTransferAnalysis")}>合作/引進/委外來源背景與合作方式</Label>
            <Hint>若有委外/引進，請說明對象背景、合作範圍、交付物與驗收方式；並於表格填入起迄期間與預算。若需於段落間插入圖片，請於文字中輸入 /p，系統將依序替換為上傳之圖片。未輸入則統一置於段落底部。</Hint>
            <Textarea
              id={f("techTransferAnalysis")}
              name="techTransferAnalysis"
              value={formData.techTransferAnalysis}
              onChange={handleChange}
              placeholder="若有合作/委外/技術引進，請說明來源對象背景、技術/智財能力、合作方式與預期成果。"
            />
            <div className="text-xs text-gray-500 leading-relaxed mt-2 mb-1 whitespace-pre-wrap break-words">
              (本計畫是否進行專利檢索分析，是否涉及他人智慧財產權說明？是否已申請或掌握關鍵智財權)
            </div>
            <ImageDropzone value={images.techTransferAnalysis} onChange={(next) => setImages((p) => ({ ...p, techTransferAnalysis: next }))} />

            <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-left text-gray-600 min-w-[920px]">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 border-r border-gray-200 w-56">項目</th>
                    <th className="px-4 py-3 border-r border-gray-200 w-40">對象</th>
                    <th className="px-4 py-3 border-r border-gray-200 w-32 text-right">經費（仟元）</th>
                    <th className="px-4 py-3 border-r border-gray-200">內容</th>
                    <th className="px-4 py-3 w-56">起迄期間</th>
                  </tr>
                </thead>
                <tbody>
                  {techTransfers.map((row, idx) => (
                    <tr key={row.item} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 border-r border-gray-200 font-medium text-gray-700">{row.item}</td>
                      <td className="px-4 py-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={row.target}
                          onChange={(e) => {
                            const next = [...techTransfers];
                            next[idx] = { ...next[idx], target: e.target.value };
                            setTechTransfers(next);
                          }}
                          placeholder="例如：某大學/某研究機構/供應商"
                        />
                      </td>
                      <td className="px-4 py-2 border-r border-gray-200">
                        <input
                          type="number"
                          className="w-full bg-transparent outline-none px-2 py-1 text-right"
                          value={row.budget}
                          onChange={(e) => {
                            const next = [...techTransfers];
                            next[idx] = { ...next[idx], budget: e.target.value };
                            setTechTransfers(next);
                          }}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={row.content}
                          onChange={(e) => {
                            const next = [...techTransfers];
                            next[idx] = { ...next[idx], content: e.target.value };
                            setTechTransfers(next);
                          }}
                          placeholder="例如：技術移轉範圍/委託研究工作內容"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <select
                            className="border border-gray-200 rounded bg-white text-sm py-1 outline-none"
                            value={row.periodStartYear ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = techTransfers.map((r, i) => i === idx ? { ...r, periodStartYear: v, period: buildPeriod(r, v, r.periodStartMonth, r.periodEndYear, r.periodEndMonth) } : r);
                              setTechTransfers(next);
                            }}
                          >
                            <option value="">年</option>
                            {[111, 112, 113, 114, 115, 116, 117].map((y) => (
                              <option key={y} value={String(y)}>{y}</option>
                            ))}
                          </select>
                          <span className="text-gray-400">/</span>
                          <select
                            className="border border-gray-200 rounded bg-white text-sm py-1 outline-none"
                            value={row.periodStartMonth ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = techTransfers.map((r, i) => i === idx ? { ...r, periodStartMonth: v, period: buildPeriod(r, r.periodStartYear, v, r.periodEndYear, r.periodEndMonth) } : r);
                              setTechTransfers(next);
                            }}
                          >
                            <option value="">月</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <option key={m} value={String(m)}>{m}月</option>
                            ))}
                          </select>
                          <span className="text-gray-400">~</span>
                          <select
                            className="border border-gray-200 rounded bg-white text-sm py-1 outline-none"
                            value={row.periodEndYear ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = techTransfers.map((r, i) => i === idx ? { ...r, periodEndYear: v, period: buildPeriod(r, r.periodStartYear, r.periodStartMonth, v, r.periodEndMonth) } : r);
                              setTechTransfers(next);
                            }}
                          >
                            <option value="">年</option>
                            {[111, 112, 113, 114, 115, 116, 117].map((y) => (
                              <option key={y} value={String(y)}>{y}</option>
                            ))}
                          </select>
                          <span className="text-gray-400">/</span>
                          <select
                            className="border border-gray-200 rounded bg-white text-sm py-1 outline-none"
                            value={row.periodEndMonth ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = techTransfers.map((r, i) => i === idx ? { ...r, periodEndMonth: v, period: buildPeriod(r, r.periodStartYear, r.periodStartMonth, r.periodEndYear, v) } : r);
                              setTechTransfers(next);
                            }}
                          >
                            <option value="">月</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <option key={m} value={String(m)}>{m}月</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-gray-500 leading-relaxed mt-3 whitespace-pre-wrap break-words">
              註：各項引進計畫及委託研究計畫均應將明確對象註明，並附契約書、協議書或專利證書（如為外文請附中譯本）等相關必要資料影本，如尚未完成簽約，須附雙方簽署之合作意願書（備忘錄）。
            </div>

            <div className="mt-6">
              <Label htmlFor={f("ipRisk")}>專利/智慧財產權風險與對策（含檢索分析）</Label>
              <Hint>請說明是否做專利檢索、是否可能侵權、關鍵智財布局（申請/授權/規避策略）。若需於段落間插入圖片，請於文字中輸入 /p，系統將依序替換為上傳之圖片。未輸入則統一置於段落底部。</Hint>
              <Textarea
                id={f("ipRisk")}
                name="ipRisk"
                value={formData.ipRisk}
                onChange={handleChange}
                placeholder="請說明：是否進行專利檢索分析？是否涉及他人智財權？是否已申請/掌握關鍵智財？風險與因應策略。"
              />
              <ImageDropzone value={images.ipRisk} onChange={(next) => setImages((p) => ({ ...p, ipRisk: next }))} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

