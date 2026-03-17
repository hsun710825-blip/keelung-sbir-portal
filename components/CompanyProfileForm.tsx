"use client";

import React, { useEffect, useRef, useState } from "react";

// --- 共用小元件 ---
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

const Label = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
    {...props}
  />
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
        <p className="text-sm font-medium">{label}</p>
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


export default function CompanyProfileForm({
  embedded = true,
  shared,
  onSharedChange,
  value,
  onChange,
}: {
  embedded?: boolean;
  shared?: { companyName: string; establishDate: string; representative: string };
  onSharedChange?: (next: { companyName: string; establishDate: string; representative: string }) => void;
  value?: {
    formData: {
      companyName: string;
      establishDate: string;
      taxId: string;
      phone: string;
      fax: string;
      representative: string;
      idNumber: string;
      birthDate: string;
      capital: string;
      mainBusiness: string;
      stockStatus: string;
      lastYearRevenue: string;
      employeeCount: string;
      registeredAddress: string;
      mailingAddress: string;
      awards: string[];
      awardTechDetails: string;
      awardOtherDetails: string;
      companyHistory: string;
      targetAudience: string;
      salesChannels: string;
    };
    shareholders: Array<{ name: string; shares: string; ratio: string }>;
    opYears: string[];
    opData: Array<{
      product: string;
      y1: { volume: string; sales: string; share: string };
      y2: { volume: string; sales: string; share: string };
      y3: { volume: string; sales: string; share: string };
    }>;
    pastProjects: Array<{
      date: string;
      category: string;
      name: string;
      duration: string;
      year: string;
      grant: string;
      totalBudget: string;
      manYears: string;
    }>;
    futureProjects: Array<{
      organizer: string;
      category: string;
      name: string;
      duration: string;
      year: string;
      grant: string;
      totalBudget: string;
      manYears: string;
    }>;
    images: Record<string, UploadedImage[]>;
  };
  onChange?: (next: NonNullable<typeof value>) => void;
}) {
  // 基礎表單狀態
  const [formData, setFormData] = useState({
    companyName: "", establishDate: "",
    taxId: "", phone: "", fax: "",
    representative: "", idNumber: "", birthDate: "",
    capital: "", mainBusiness: "",
    stockStatus: "", lastYearRevenue: "", employeeCount: "",
    registeredAddress: "", mailingAddress: "",
    awards: [] as string[],
    awardTechDetails: "", awardOtherDetails: "",
    
    // (三) 公司沿革
    companyHistory: "",
    // 二、(一)(二)
    targetAudience: "",
    salesChannels: "",
  });

  // (二) 主要股東狀態 (預設5筆)
  const [shareholders, setShareholders] = useState(
    Array(5).fill({ name: "", shares: "", ratio: "" })
  );

  // 經營狀況年份狀態
  const [opYears, setOpYears] = useState(["110", "111", "112"]);
  
  // 經營狀況資料狀態 (預設3列產品)
  type YearKey = "y1" | "y2" | "y3";
  type YearData = { volume: string; sales: string; share: string };
  type OpRow = { product: string } & Record<YearKey, YearData>;

  const [opData, setOpData] = useState<OpRow[]>(
    Array.from({ length: 3 }).map(() => ({
      product: "",
      y1: { volume: "", sales: "", share: "" },
      y2: { volume: "", sales: "", share: "" },
      y3: { volume: "", sales: "", share: "" },
    }))
  );

  // 近3年曾經參與政府其他相關計畫
  const [pastProjects, setPastProjects] = useState([
    { date: "", category: "", name: "", duration: "", year: "", grant: "", totalBudget: "", manYears: "" }
  ]);

  // 本年度欲申請政府其他相關計畫
  const [futureProjects, setFutureProjects] = useState([
    { organizer: "", category: "", name: "", duration: "", year: "115", grant: "", totalBudget: "", manYears: "" }
  ]);

  const [images, setImages] = useState<Record<string, UploadedImage[]>>({
    companyHistory: [],
    targetAudience: [],
    salesChannels: [],
  });

  // Initialize from controlled value (when embedded in app/page.tsx)
  useEffect(() => {
    if (!value) return;
    setFormData(value.formData);
    setShareholders(value.shareholders);
    setOpYears(value.opYears);
    setOpData(value.opData as unknown as OpRow[]);
    setPastProjects(value.pastProjects);
    setFutureProjects(value.futureProjects);
    setImages(value.images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Emit changes upward for draft/PDF integration.
  useEffect(() => {
    if (!onChange) return;
    onChange({
      formData,
      shareholders,
      opYears,
      opData: opData as unknown as NonNullable<typeof value>["opData"],
      pastProjects,
      futureProjects,
      images,
    });
  }, [formData, shareholders, opYears, opData, pastProjects, futureProjects, images, onChange]);

  // sharedOrLocal removed (unused)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (award: string) => {
    setFormData(prev => {
      if (award === "無") {
        return { ...prev, awards: ["無"] };
      }
      const newAwards = prev.awards.includes(award)
        ? prev.awards.filter(a => a !== award)
        : [...prev.awards.filter(a => a !== "無"), award];
      return { ...prev, awards: newAwards };
    });
  };

  const formContent = (
    <div>
          {/* ======================= 一、基本資料 ======================= */}
          <section className="mb-12">
            <SectionTitle>一、基本資料</SectionTitle>
            
            {/* (一) 公司簡介 */}
            <SubTitle>(一) 公司簡介</SubTitle>
            <Hint>請依公司登記與實際營運填寫；若涉及個資/敏感資訊，請以必要且可驗證為原則。</Hint>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-gray-50/50 p-6 rounded-lg border border-gray-100">
              <div>
                <Label>公司名稱</Label>
                <Input
                  name="companyName"
                  value={shared ? shared.companyName : formData.companyName}
                  onChange={(e) => {
                    handleInputChange(e);
                    if (shared && onSharedChange) onSharedChange({ ...shared, companyName: e.target.value });
                  }}
                />
              </div>
              <div>
                <Label>設立日期</Label>
                <Input
                  type="date"
                  name="establishDate"
                  value={shared ? shared.establishDate : formData.establishDate}
                  onChange={(e) => {
                    handleInputChange(e);
                    if (shared && onSharedChange) onSharedChange({ ...shared, establishDate: e.target.value });
                  }}
                />
              </div>
              <div>
                <Label>統一編號</Label>
                <Input name="taxId" value={formData.taxId} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>聯絡電話含分機</Label>
                  <Input name="phone" value={formData.phone} onChange={handleInputChange} />
                </div>
                <div>
                  <Label>傳真號碼</Label>
                  <Input name="fax" value={formData.fax} onChange={handleInputChange} />
                </div>
              </div>
              <div>
                <Label>負責人</Label>
                <Input
                  name="representative"
                  value={shared ? shared.representative : formData.representative}
                  onChange={(e) => {
                    handleInputChange(e);
                    if (shared && onSharedChange) onSharedChange({ ...shared, representative: e.target.value });
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>身分證字號</Label>
                  <Input name="idNumber" value={formData.idNumber} onChange={handleInputChange} />
                </div>
                <div>
                  <Label>出生年月日</Label>
                  <Input type="date" name="birthDate" value={formData.birthDate} onChange={handleInputChange} />
                </div>
              </div>
              <div>
                <Label>實收資本額 (千元)</Label>
                <Input type="number" name="capital" value={formData.capital} onChange={handleInputChange} />
              </div>
              <div>
                <Label>主要營業項目</Label>
                <Input name="mainBusiness" value={formData.mainBusiness} onChange={handleInputChange} />
              </div>
              
              <div className="md:col-span-2">
                <Label>股票上市狀況</Label>
                <div className="flex flex-wrap gap-6 mt-2">
                  {["上市", "上櫃", "公開發行", "未公開發行"].map(status => (
                    <label key={status} className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="stockStatus" 
                        value={status} 
                        checked={formData.stockStatus === status}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-gray-600 focus:ring-gray-500 border-gray-300" 
                      />
                      <span className="text-sm text-gray-700">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>前一年度營業額 (千元)</Label>
                <Input type="number" name="lastYearRevenue" value={formData.lastYearRevenue} onChange={handleInputChange} />
              </div>
              <div>
                <Label>員工人數 (人)</Label>
                <Input type="number" name="employeeCount" value={formData.employeeCount} onChange={handleInputChange} />
              </div>

              <div className="md:col-span-2">
                <Label>公司登記地址</Label>
                <Input name="registeredAddress" value={formData.registeredAddress} onChange={handleInputChange} />
              </div>
              <div className="md:col-span-2">
                <Label>通訊地址</Label>
                <Input name="mailingAddress" value={formData.mailingAddress} onChange={handleInputChange} />
              </div>

              <div className="md:col-span-2 border-t border-gray-200 pt-6 mt-2">
                <Label>研發成果獲得獎項</Label>
                <div className="mt-3 space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={formData.awards.includes("年度通過研發管理制度評鑑")} onChange={() => handleCheckboxChange("年度通過研發管理制度評鑑")} className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                    <span className="text-sm text-gray-700">年度通過研發管理制度評鑑</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={formData.awards.includes("年度產業科技發展獎")} onChange={() => handleCheckboxChange("年度產業科技發展獎")} className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">年度產業科技發展獎(</span>
                    <input type="text" name="awardTechDetails" value={formData.awardTechDetails} onChange={handleInputChange} disabled={!formData.awards.includes("年度產業科技發展獎")} className="border-b border-gray-400 focus:border-gray-600 outline-none px-2 w-24 text-sm bg-transparent disabled:opacity-50" />
                    <span className="text-sm text-gray-700">獎)</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={formData.awards.includes("年度國家品質獎")} onChange={() => handleCheckboxChange("年度國家品質獎")} className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                    <span className="text-sm text-gray-700">年度國家品質獎</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={formData.awards.includes("年度中小企業磐石獎")} onChange={() => handleCheckboxChange("年度中小企業磐石獎")} className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                    <span className="text-sm text-gray-700">年度中小企業磐石獎</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={formData.awards.includes("其他殊榮")} onChange={() => handleCheckboxChange("其他殊榮")} className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">其他殊榮：</span>
                    <input type="text" name="awardOtherDetails" value={formData.awardOtherDetails} onChange={handleInputChange} disabled={!formData.awards.includes("其他殊榮")} className="border-b border-gray-400 focus:border-gray-600 outline-none px-2 flex-1 text-sm bg-transparent disabled:opacity-50" />
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={formData.awards.includes("無")} onChange={() => handleCheckboxChange("無")} className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500" />
                    <span className="text-sm text-gray-700">無</span>
                  </label>
                </div>
              </div>
            </div>

            {/* (二) 主要股東及持股比例 */}
            <SubTitle>(二) 主要股東及持股比例(列出持股前五大)</SubTitle>
            <Hint>若股東為法人可填公司全名；持股比例請加總接近 100%（可包含未列入者於其他欄位或合計備註）。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 border-r border-gray-200">主要股東名稱</th>
                    <th className="px-6 py-4 border-r border-gray-200 text-right w-1/4">持有股份（千股）</th>
                    <th className="px-6 py-4 text-right w-1/4">持股比例（％）</th>
                  </tr>
                </thead>
                <tbody>
                  {shareholders.map((row, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 border-r border-gray-200">
                        <input type="text" className="w-full bg-transparent outline-none px-2 py-1" placeholder={`股東 ${idx + 1}`} value={row.name} onChange={(e) => {
                          const newRows = [...shareholders];
                          newRows[idx].name = e.target.value;
                          setShareholders(newRows);
                        }} />
                      </td>
                      <td className="px-4 py-2 border-r border-gray-200">
                        <input type="number" className="w-full bg-transparent outline-none px-2 py-1 text-right" placeholder="0" value={row.shares} onChange={(e) => {
                          const newRows = [...shareholders];
                          newRows[idx].shares = e.target.value;
                          setShareholders(newRows);
                        }} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" className="w-full bg-transparent outline-none px-2 py-1 text-right" placeholder="0.00" value={row.ratio} onChange={(e) => {
                          const newRows = [...shareholders];
                          newRows[idx].ratio = e.target.value;
                          setShareholders(newRows);
                        }} />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-6 py-4 text-center border-r border-gray-200">合 計</td>
                    <td className="px-6 py-4 text-right border-r border-gray-200">
                      {shareholders.reduce((acc, curr) => acc + (Number(curr.shares) || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {shareholders.reduce((acc, curr) => acc + (Number(curr.ratio) || 0), 0).toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* (三) 公司沿革 */}
            <SubTitle>(三) 公司沿革（可提出經營理念、曾獲殊榮及認證等）</SubTitle>
            <Hint>建議用時間軸條列：成立→重要里程碑→代表產品/服務→獎項/認證→近年成長重點；可上傳佐證圖片。</Hint>
            <div className="bg-white">
              <Textarea 
                name="companyHistory" 
                value={formData.companyHistory} 
                onChange={handleInputChange} 
                placeholder="請描述公司沿革、經營理念等..."
              />
              <ImageDropzone
                value={images.companyHistory}
                onChange={(next) => setImages((p) => ({ ...p, companyHistory: next }))}
              />
            </div>
          </section>

          {/* ======================= 二、公司營運及財務狀況 ======================= */}
          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>二、公司營運及財務狀況</SectionTitle>
            
            <SubTitle>（一）主要服務或產品目標客群</SubTitle>
            <Hint>請描述「誰」會買/用、使用情境與痛點；可補充客群規模、分眾與典型客戶輪廓。</Hint>
            <div className="mb-8">
              <Textarea 
                name="targetAudience" 
                value={formData.targetAudience} 
                onChange={handleInputChange} 
                placeholder="請說明目標客群..."
              />
              <ImageDropzone
                value={images.targetAudience}
                onChange={(next) => setImages((p) => ({ ...p, targetAudience: next }))}
              />
            </div>

            <SubTitle>（二）銷售通路說明（包括虛擬及實體銷售據點分佈狀況） 金額單位：仟元</SubTitle>
            <Hint>請說明通路型態（直銷/代理/平台/門市）、區域分佈、轉換流程；可上傳示意圖或通路地圖。</Hint>
            <div className="mb-8">
              <Textarea 
                name="salesChannels" 
                value={formData.salesChannels} 
                onChange={handleInputChange} 
                placeholder="請說明銷售通路分佈..."
              />
              <ImageDropzone
                value={images.salesChannels}
                onChange={(next) => setImages((p) => ({ ...p, salesChannels: next }))}
              />
            </div>

            <SubTitle>（三）經營狀況：(請說明公司主要經營之產品項目、銷售業績及市場佔有率。) 金額單位：千元</SubTitle>
            <Hint>請填近三年資料，年度由近到遠；若市場占有率為估算，請於備註說明估算依據。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[900px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th rowSpan={2} className="px-4 py-3 border-r border-b border-gray-200 w-1/4">
                      申請人主要產品/服務項目
                    </th>
                    {[0, 1, 2].map((idx) => (
                      <th key={idx} colSpan={3} className="px-4 py-3 border-b border-r border-gray-200 last:border-r-0">
                        民國 <input type="text" className="w-12 text-center border-b border-gray-400 bg-transparent focus:outline-none focus:border-gray-600" value={opYears[idx]} onChange={(e) => {
                          const newY = [...opYears]; newY[idx] = e.target.value; setOpYears(newY);
                        }} /> 年
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {[0, 1, 2].map((idx) => (
                      <React.Fragment key={`sub-${idx}`}>
                        <th className="px-2 py-2 border-r border-b border-gray-200 font-medium">產量</th>
                        <th className="px-2 py-2 border-r border-b border-gray-200 font-medium">銷售額</th>
                        <th className="px-2 py-2 border-r border-b border-gray-200 last:border-r-0 font-medium">市場占有率</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {opData.map((row, rIdx) => (
                    <tr key={rIdx} className="bg-white border-b border-gray-100">
                      <td className="p-2 border-r border-gray-200">
                        <textarea className="w-full text-sm outline-none resize-none bg-transparent" rows={3} placeholder="產品名稱..." value={row.product} onChange={(e) => {
                          const newD = [...opData]; newD[rIdx].product = e.target.value; setOpData(newD);
                        }} />
                      </td>
                      {(["y1", "y2", "y3"] as const).map((yearKey) => (
                        <React.Fragment key={`${rIdx}-${yearKey}`}>
                          <td className="p-2 border-r border-gray-200">
                            <input
                              type="text"
                              className="w-full text-center outline-none bg-transparent"
                              value={row[yearKey].volume}
                              onChange={(e) => {
                                const newD = [...opData];
                                newD[rIdx] = {
                                  ...newD[rIdx],
                                  [yearKey]: { ...newD[rIdx][yearKey], volume: e.target.value },
                                };
                                setOpData(newD);
                              }}
                            />
                          </td>
                          <td className="p-2 border-r border-gray-200">
                            <input
                              type="number"
                              className="w-full text-right outline-none bg-transparent"
                              value={row[yearKey].sales}
                              onChange={(e) => {
                                const newD = [...opData];
                                newD[rIdx] = {
                                  ...newD[rIdx],
                                  [yearKey]: { ...newD[rIdx][yearKey], sales: e.target.value },
                                };
                                setOpData(newD);
                              }}
                            />
                          </td>
                          <td className="p-2 border-r border-gray-200 last:border-r-0">
                            <div className="flex items-center">
                              <input
                                type="number"
                                className="w-full text-right outline-none bg-transparent"
                                value={row[yearKey].share}
                                onChange={(e) => {
                                  const newD = [...opData];
                                  newD[rIdx] = {
                                    ...newD[rIdx],
                                    [yearKey]: { ...newD[rIdx][yearKey], share: e.target.value },
                                  };
                                  setOpData(newD);
                                }}
                              />
                              <span className="text-gray-400 ml-1">%</span>
                            </div>
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                  {/* Footer Stats Rows */}
                  {[
                    { label: "合 計", key: "total" },
                    { label: "年度營業額(A)", key: "revA" },
                    { label: "年度研發費用(B)", key: "rndB" },
                    { label: "(B)/(A)%", key: "ratio" }
                  ].map((stat, sIdx) => (
                    <tr key={sIdx} className="bg-gray-50 border-b border-gray-200 last:border-0 font-medium">
                      <td className="px-4 py-3 border-r border-gray-200 text-right">{stat.label}</td>
                      {[0, 1, 2].map(idx => (
                        <React.Fragment key={`${sIdx}-${idx}`}>
                          <td className="border-r border-gray-200 bg-gray-100"></td>
                          <td className="p-2 border-r border-gray-200">
                            <input type="text" className="w-full text-right bg-transparent outline-none" placeholder="0" />
                          </td>
                          <td className="border-r border-gray-200 last:border-r-0 bg-gray-100"></td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ======================= 三、曾經參與政府相關研發計畫之實績 ======================= */}
          <section className="mb-8 pt-8 border-t border-gray-200">
            <SectionTitle>三、曾經參與政府相關研發計畫之實績(無則免填)</SectionTitle>
            
            <SubTitle>（一）近3年曾經參與政府其他相關計畫</SubTitle>
            <Hint>若無可免填；若有，請填核定日期、計畫名稱、補助款與總經費，並盡量與官方資料一致。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1000px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-24">核定日期</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200">計畫類別</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-48">計畫名稱</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-32">計畫執行期間</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-24">年度<br/>(114/113/112)</th>
                    <th colSpan={2} className="px-3 py-2 border-r border-b border-gray-200">年度計畫經費（仟元）</th>
                    <th rowSpan={2} className="px-3 py-3 border-b border-gray-200 w-24">計畫人年數</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 border-r border-b border-gray-200 font-medium">政府補助款</th>
                    <th className="px-3 py-2 border-r border-b border-gray-200 font-medium">計畫總經費</th>
                  </tr>
                </thead>
                <tbody>
                  {pastProjects.map((row, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100">
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full text-center outline-none bg-transparent" placeholder="YY/MM/DD" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full text-center outline-none bg-transparent" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full outline-none bg-transparent" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full text-center outline-none bg-transparent" placeholder="YY/MM~YY/MM" /></td>
                      <td className="p-2 border-r border-gray-200">
                        <select className="w-full outline-none bg-transparent text-center">
                          <option value="">選擇</option><option value="114">114年</option><option value="113">113年</option><option value="112">112年</option>
                        </select>
                      </td>
                      <td className="p-2 border-r border-gray-200"><input type="number" className="w-full text-right outline-none bg-transparent" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="number" className="w-full text-right outline-none bg-transparent" /></td>
                      <td className="p-2"><input type="number" step="0.1" className="w-full text-center outline-none bg-transparent" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setPastProjects([...pastProjects, { date: "", category: "", name: "", duration: "", year: "", grant: "", totalBudget: "", manYears: "" }])} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              新增一列
            </button>

            <SubTitle>（二）本年度欲申請政府其他相關計畫</SubTitle>
            <Hint>請填今年度同時申請之其他計畫，以利審查避免重複補助與資源重疊。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1000px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-32">主辦單位</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200">計畫類別</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-48">欲申請之計畫名稱</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-32">計畫執行期間</th>
                    <th rowSpan={2} className="px-3 py-3 border-r border-b border-gray-200 w-24">年度<br/>(民國 115年)</th>
                    <th colSpan={2} className="px-3 py-2 border-r border-b border-gray-200">年度計畫經費（仟元）</th>
                    <th rowSpan={2} className="px-3 py-3 border-b border-gray-200 w-24">計畫人年數</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 border-r border-b border-gray-200 font-medium">政府補助款</th>
                    <th className="px-3 py-2 border-r border-b border-gray-200 font-medium">計畫總經費</th>
                  </tr>
                </thead>
                <tbody>
                  {futureProjects.map((row, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100">
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full text-center outline-none bg-transparent" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full text-center outline-none bg-transparent" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full outline-none bg-transparent" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="text" className="w-full text-center outline-none bg-transparent" placeholder="YY/MM~YY/MM" /></td>
                      <td className="p-2 border-r border-gray-200 text-center text-gray-500">115</td>
                      <td className="p-2 border-r border-gray-200"><input type="number" className="w-full text-right outline-none bg-transparent" /></td>
                      <td className="p-2 border-r border-gray-200"><input type="number" className="w-full text-right outline-none bg-transparent" /></td>
                      <td className="p-2"><input type="number" step="0.1" className="w-full text-center outline-none bg-transparent" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setFutureProjects([...futureProjects, { organizer: "", category: "", name: "", duration: "", year: "115", grant: "", totalBudget: "", manYears: "" }])} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              新增一列
            </button>
          </section>

    </div>
  );

  if (embedded) return formContent;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 表單標題 */}
        <div className="bg-gray-800 text-white px-8 py-6">
          <h1 className="text-2xl font-semibold tracking-wider">壹、公司概況</h1>
          <p className="text-gray-300 text-sm mt-2">請確實填寫下列各項資料，以利審查作業進行。</p>
        </div>

        <div className="p-8">{formContent}</div>
      </div>
    </div>
  );
}