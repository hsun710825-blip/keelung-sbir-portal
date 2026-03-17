"use client";

import React, { useEffect, useRef, useState } from "react";

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
}: {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    const accepted = Array.from(files).filter((f) => f.type.startsWith("image/"));
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
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
      >
        <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <p className="text-sm font-medium">點擊或拖曳圖片至此上傳</p>
        <p className="text-xs text-gray-400 mt-1">支援 JPG, PNG, GIF 格式（可多選）</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
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
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
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
  children: TreeNode[];
};

function newNode(text = ""): TreeNode {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, text, children: [] };
}

function TreeEditor({
  value,
  onChange,
}: {
  value: TreeNode;
  onChange: (next: TreeNode) => void;
}) {
  const updateNode = (node: TreeNode, id: string, updater: (n: TreeNode) => TreeNode): TreeNode => {
    if (node.id === id) return updater(node);
    return { ...node, children: node.children.map((c) => updateNode(c, id, updater)) };
  };

  const removeNode = (node: TreeNode, id: string): TreeNode => {
    return { ...node, children: node.children.filter((c) => c.id !== id).map((c) => removeNode(c, id)) };
  };

  const Row = ({ node, depth }: { node: TreeNode; depth: number }) => (
    <div className="space-y-2">
      <div className="flex items-start gap-2" style={{ paddingLeft: depth * 18 }}>
        <input
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
          value={node.text}
          onChange={(e) => onChange(updateNode(value, node.id, (n) => ({ ...n, text: e.target.value })))}
          placeholder={depth === 0 ? "請輸入計畫架構主幹（例如：整體架構/分項計畫）" : "請輸入節點內容（例如：A1 需求分析）"}
        />
        <button
          type="button"
          className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() =>
            onChange(updateNode(value, node.id, (n) => ({ ...n, children: [...n.children, newNode("")] })))
          }
        >
          + 子節點
        </button>
        {depth > 0 && (
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-red-600"
            onClick={() => onChange(removeNode(value, node.id))}
          >
            刪除
          </button>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="space-y-2">
          {node.children.map((c) => (
            <Row key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-2 space-y-3">
      <div className="text-xs text-gray-500">
        以「主幹→分支→子節點」方式建立樹枝圖。建議用 A/B 分項計畫與 A1/A2 工作項目對齊後續進度表。
      </div>
      <div className="p-4 bg-gray-50/50 border border-gray-200 rounded-lg">
        <Row node={value} depth={0} />
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
};

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

  const [architectureTree, setArchitectureTree] = useState<TreeNode>(newNode(""));
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

  useEffect(() => {
    if (!value) return;
    setFormData(value.formData);
    setArchitectureTree(value.architectureTree);
    setCompetitorRows(value.competitorRows);
    setTechTransferRows(value.techTransferRows);
    setImages(value.images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!onChange) return;
    onChange({ formData, architectureTree, competitorRows, techTransferRows, images });
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
            <SectionTitle>一、背景與說明</SectionTitle>
            <Label required>計畫背景、面臨的問題、市場/環境與使用者需求、發展願景</Label>
            <Hint>建議用「痛點→原因→目標→受益者→願景」寫法；避免只描述產品功能，請說清楚為何需要做這個計畫。</Hint>
            <Textarea
              name="background"
              value={formData.background}
              onChange={handleChange}
              placeholder="請說明：1) 背景與痛點 2) 目標客群/使用者需求 3) 產業與市場環境 4) 本計畫欲解決的問題與願景..."
            />
            <ImageDropzone value={images.background} onChange={(next) => setImages((p) => ({ ...p, background: next }))} />
          </section>

          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>二、國內外產業現況、發展趨勢及競爭力分析</SectionTitle>

            <SubTitle>（一）國內外產業現況與發展方向</SubTitle>
            <Label required>產業現況與趨勢（請註明資料來源）</Label>
            <Hint>請至少引用 1–3 個可信來源（政府統計/研究報告/論文/產業報告），並說明與本案關聯。</Hint>
            <Textarea
              name="industryStatus"
              value={formData.industryStatus}
              onChange={handleChange}
              placeholder="請說明國內外產業現況、關鍵技術/服務發展、目標市場規模與變化，並註明資料來源（例：報告/論文/統計/官方網站）。"
            />
            <ImageDropzone value={images.industryStatus} onChange={(next) => setImages((p) => ({ ...p, industryStatus: next }))} />

            <div className="mt-6">
              <Label>補充：趨勢與規格/功能/成本比較</Label>
              <Hint>建議列出比較表：本案 vs 既有方案（規格、效能、成本、導入門檻、維運）。</Hint>
              <Textarea
                name="industryTrends"
                value={formData.industryTrends}
                onChange={handleChange}
                placeholder="請與國內外既有技術/產品/服務比較：技術規格、功能應用、成本結構、導入門檻等。"
              />
              <ImageDropzone value={images.industryTrends} onChange={(next) => setImages((p) => ({ ...p, industryTrends: next }))} />
            </div>

            <SubTitle>（二）競爭力分析（產品/服務競爭優勢比較）</SubTitle>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-left text-gray-600 min-w-[980px]">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 border-r border-gray-200 w-48">名稱／項目</th>
                    <th className="px-4 py-3 border-r border-gray-200">1. 價格（單位：）</th>
                    <th className="px-4 py-3 border-r border-gray-200">2. 產品／服務上市時間</th>
                    <th className="px-4 py-3 border-r border-gray-200">3. 市場占有率（%）</th>
                    <th className="px-4 py-3 border-r border-gray-200">4. 市場區隔</th>
                    <th className="px-4 py-3 border-r border-gray-200">5. 行銷管道</th>
                    <th className="px-4 py-3">6. 技術或服務優勢</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((row, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 border-r border-gray-200 font-medium text-gray-700">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={row.name}
                          onChange={(e) => {
                            const next = [...competitors];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setCompetitors(next);
                          }}
                          placeholder={idx === 0 ? "申請人（本計畫研發標的）" : `競品 ${idx}`}
                        />
                      </td>
                      {(["price", "launchTime", "marketShare", "segment", "channel", "advantage"] as const).map((k, cIdx) => (
                        <td
                          key={k}
                          className={`px-4 py-2 ${cIdx < 5 ? "border-r border-gray-200" : ""}`}
                        >
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${
                              k === "marketShare" ? "text-right" : ""
                            }`}
                            value={row[k]}
                            onChange={(e) => {
                              const next = [...competitors];
                              next[idx] = { ...next[idx], [k]: e.target.value } as CompetitorRow;
                              setCompetitors(next);
                            }}
                            placeholder={
                              k === "price"
                                ? "例如：$2,000/套"
                                : k === "launchTime"
                                  ? "例如：2026/01"
                                  : k === "marketShare"
                                    ? "0"
                                    : k === "segment"
                                      ? "例如：中小企業/政府"
                                      : k === "channel"
                                        ? "例如：直銷/代理/平台"
                                        : "請條列優勢重點"
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SubTitle>（三）計畫可行性分析</SubTitle>
            <Label required>市場商機、營運模式、系統/技術、商品化/應用或其他優勢</Label>
            <Hint>請把「可行性」寫成可驗證：市場假設、驗證方法、里程碑、風險與對策。</Hint>
            <Textarea
              name="feasibility"
              value={formData.feasibility}
              onChange={handleChange}
              placeholder="請客觀評估本案可行性：市場需求與規模、目標客戶、營運模式、技術可行性與風險、驗證路徑、商品化/導入策略等。"
            />
            <ImageDropzone value={images.feasibility} onChange={(next) => setImages((p) => ({ ...p, feasibility: next }))} />
          </section>

          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>三、創新性說明</SectionTitle>
            <Label required>本計畫創意、構想、研發或服務標的之創新性</Label>
            <Hint>建議聚焦 1–3 個創新點，並用可量測指標描述（例如：成本降低%、效率提升%、準確率）。</Hint>
            <Textarea
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
            <Label required>分項計畫/開發技術、占比、執行單位、委託研究/技術引進</Label>
            <Hint>請先建立主幹（整體架構），再往下拆分分項計畫（A/B）與工作項目（A1/A2…）；建議與後續進度表、KPI 編號一致。</Hint>
            <TreeEditor
              value={architectureTree}
              onChange={(next) => {
                setArchitectureTree(next);
                setFormData((p) => ({ ...p, architectureTreeJson: JSON.stringify(next) }));
              }}
            />

            <SubTitle>（二）執行步驟及方法</SubTitle>
            <Label required>流程、驗證/測試、修正流程與預期結果</Label>
            <Hint>請以步驟條列：輸入→處理→輸出→驗證；並說明每步驟的產出物（文件/原型/測試報告）。</Hint>
            <Textarea
              name="stepsMethod"
              value={formData.stepsMethod}
              onChange={handleChange}
              placeholder="請以流程圖/條列說明：各分項工作步驟、里程碑、驗證測試方式、修正迭代流程、試營運/服務模式（如適用），以及各階段產出。"
            />
            <ImageDropzone value={images.stepsMethod} onChange={(next) => setImages((p) => ({ ...p, stepsMethod: next }))} />

            <SubTitle>（三）技術移轉來源分析（擬與業界/學術界/研究機構合作）</SubTitle>
            <Label>合作/引進/委外來源背景與合作方式</Label>
            <Hint>若有委外/引進，請說明對象背景、合作範圍、交付物與驗收方式；並於表格填入起迄期間與預算。</Hint>
            <Textarea
              name="techTransferAnalysis"
              value={formData.techTransferAnalysis}
              onChange={handleChange}
              placeholder="若有合作/委外/技術引進，請說明來源對象背景、技術/智財能力、合作方式與預期成果。"
            />
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
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={row.period}
                          onChange={(e) => {
                            const next = [...techTransfers];
                            next[idx] = { ...next[idx], period: e.target.value };
                            setTechTransfers(next);
                          }}
                          placeholder="年 月 日 ~ 年 月 日"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Label>專利/智慧財產權風險與對策（含檢索分析）</Label>
              <Hint>請說明是否做專利檢索、是否可能侵權、關鍵智財布局（申請/授權/規避策略）。</Hint>
              <Textarea
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

