"use client";
import React, { useState } from 'react';
import { 
  Calendar, CircleDollarSign, ShieldCheck, ArrowRight, User, 
  LogOut, Phone, Building2, FileText, CheckSquare, 
  UploadCloud, Save, ChevronRight, AlertCircle, Trash2, File, CheckCircle2 
} from 'lucide-react';
import CompanyProfileForm from '@/components/CompanyProfileForm'; 
import PlanContentImplementationForm from '@/components/PlanContentImplementationForm';
import ExpectedBenefitsForm from '@/components/ExpectedBenefitsForm';
import ScheduleCheckpointsForm from '@/components/ScheduleCheckpointsForm';
import HumanBudgetRequirementsForm from '@/components/HumanBudgetRequirementsForm';

type CurrentView = "home" | "dashboard";
type UserRole = "applicant" | "reviewer";
type UserContext = { name: string; role: UserRole; email: string };

type CompanyProfileValue = React.ComponentProps<typeof CompanyProfileForm>["value"];
type PlanContentValue = React.ComponentProps<typeof PlanContentImplementationForm>["value"];
type ExpectedBenefitsValue = React.ComponentProps<typeof ExpectedBenefitsForm>["value"];
type ScheduleCheckpointsValue = React.ComponentProps<typeof ScheduleCheckpointsForm>["value"];
type HumanBudgetValue = React.ComponentProps<typeof HumanBudgetRequirementsForm>["value"];

export default function App() {
  const [currentView, setCurrentView] = useState<CurrentView>('home');
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [isSimulatingLogin, setIsSimulatingLogin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(true);

  const handleGoogleLogin = (role: UserRole) => {
    setIsSimulatingLogin(true);
    setTimeout(() => {
      setUserContext({
        name: role === 'applicant' ? '基隆新創企業 (測試)' : '審查委員 (測試)',
        role: role,
        email: role === 'applicant' ? 'startup@example.com' : 'reviewer@example.com'
      });
      setIsSimulatingLogin(false);
      setCurrentView('dashboard');
    }, 1500);
  };

  const handleLogout = () => {
    setUserContext(null);
    setCurrentView('home');
  };

  if (currentView === 'dashboard') {
    return <Dashboard user={userContext} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-800 selection:bg-blue-100">
      <nav className="absolute top-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent text-white">
        <div className="text-sm tracking-wider font-light flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          基隆市政府
        </div>
        <button 
          onClick={() => setShowAdminLogin(!showAdminLogin)}
          className="text-xs opacity-50 hover:opacity-100 transition-opacity border border-white/30 px-2 py-1 rounded"
        >
          切換管理員登入顯示 (開發測試)
        </button>
      </nav>

      <div className="relative w-full h-[65vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-top bg-slate-800"
          style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-[#fafafa]"></div>
        </div>

        <div className="relative z-10 text-center px-4 flex flex-col items-center mt-12">
          <div className="mb-12 -mt-40 md:-mt-56 lg:-mt-64 w-full max-w-[300px] md:max-w-[500px] lg:max-w-[600px] flex justify-center">
            <img 
              src="/images/title.jpg" 
              alt="智慧創新 百業齊興" 
              className="w-full h-auto drop-shadow-lg mix-blend-screen"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
                maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)'
              }}
            />
          </div>
          
          <h1 className="mt-12 md:mt-20 text-3xl md:text-5xl lg:text-6xl font-medium text-white tracking-widest leading-tight drop-shadow-lg">
            115年度基隆市
            <br className="md:hidden" />
            <span className="block mt-2 md:mt-4 text-2xl md:text-4xl font-light">
              地方型產業創新研發推動計畫 
              <span className="text-xl md:text-2xl text-blue-200 tracking-wider ml-2 md:ml-4">(地方型 SBIR)</span>
            </span>
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <h3 className="text-sm text-slate-400 tracking-widest uppercase mb-6 flex items-center gap-2">
                <InfoIcon /> Program Information
              </h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-colors hover:bg-slate-100">
                  <div className="p-3 bg-white rounded-lg shadow-sm text-blue-500">
                    <CircleDollarSign size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-slate-800">單家補助最高 100 萬！！</h4>
                    <p className="text-sm text-slate-500 mt-1 font-light">鼓勵在地企業投入創新研發，提升產業競爭力。</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-colors hover:bg-slate-100">
                  <div className="p-3 bg-white rounded-lg shadow-sm text-indigo-500">
                    <CircleDollarSign size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-slate-800">聯合補助最高 200 萬！！</h4>
                    <p className="text-sm text-slate-500 mt-1 font-light">促進產業跨域合作，共同創造更大經濟價值。</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50/50 border border-amber-100/50">
                  <div className="p-3 bg-white rounded-lg shadow-sm text-amber-500">
                    <Calendar size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="text-md font-medium text-slate-800">收件日期</h4>
                    <p className="text-sm text-amber-700 mt-1">即日起至 <span className="font-medium text-amber-600">115 年 5 月 4 日</span> 截止</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-full flex flex-col justify-center">
              <div className="text-center mb-8">
                <h3 className="text-xl font-medium tracking-wide text-slate-800 mb-2">系統登入</h3>
                <p className="text-sm text-slate-500 font-light">請使用 Google 帳號進行身分驗證</p>
              </div>
              <div className="space-y-4">
                <button 
                  onClick={() => handleGoogleLogin('applicant')}
                  disabled={isSimulatingLogin}
                  className="w-full group relative flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 px-6 py-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200 disabled:opacity-50"
                >
                  <GoogleIcon />
                  <span className="font-medium tracking-wide">申請者 登入</span>
                  <ArrowRight size={16} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-slate-400" />
                </button>
                {isSimulatingLogin && (
                  <div className="text-center text-xs text-blue-500 animate-pulse py-2">正在驗證並同步資料至系統...</div>
                )}
                {showAdminLogin && (
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-white px-4 text-slate-400 font-light tracking-widest">內部人員</span></div>
                  </div>
                )}
                {showAdminLogin && (
                  <button 
                    onClick={() => handleGoogleLogin('reviewer')}
                    disabled={isSimulatingLogin}
                    className="w-full group relative flex items-center justify-center gap-3 bg-slate-50 border border-slate-200 text-slate-600 px-6 py-3.5 rounded-xl hover:bg-slate-100 transition-all duration-200 disabled:opacity-50"
                  >
                    <ShieldCheck size={18} className="text-slate-400" />
                    <span className="font-medium tracking-wide text-sm">管理員 / 審查委員 登入</span>
                  </button>
                )}
              </div>
              <div className="mt-8 text-center">
                <p className="text-[11px] text-slate-400 font-light">登入即表示您同意本計畫之隱私權政策與資訊安全規範。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 transition-all">
          <div className="bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-medium tracking-widest shadow-sm whitespace-nowrap">洽詢窗口</div>
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 w-full lg:w-auto">
            <div>
              <h4 className="text-slate-800 font-medium tracking-wide flex items-center justify-center md:justify-start gap-2 text-base">
                <Building2 size={16} className="text-blue-500" />基隆市SBIR專案辦公室
              </h4>
              <p className="text-slate-600 mt-1.5 flex items-center justify-center md:justify-start gap-2 font-light tracking-wide text-sm">
                <Phone size={14} className="text-slate-400" />(04) 2326-8281 #111 <span className="font-medium text-slate-700 ml-1">閻先生</span>
              </p>
            </div>
            <div className="hidden md:block w-[1px] h-12 bg-slate-200"></div>
            <div>
              <h4 className="text-slate-800 font-medium tracking-wide flex items-center justify-center md:justify-start gap-2 text-base">
                <Building2 size={16} className="text-blue-500" />基隆市政府產業發展處
              </h4>
              <p className="text-slate-600 mt-1.5 flex items-center justify-center md:justify-start gap-2 font-light tracking-wide text-sm">
                <Phone size={14} className="text-slate-400" />(02) 2428-9225 <span className="font-medium text-slate-700 ml-1">范小姐</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full pb-8 pt-6 text-center">
        <p className="text-xs text-slate-400 font-light tracking-wider">© 2026 基隆市政府 產業發展處. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

function Dashboard({ user, onLogout }: { user: UserContext | null; onLogout: () => void }) {
  const [hasAgreed, setHasAgreed] = useState(false);

  if (!hasAgreed) {
    return <ConsentView onAgree={() => setHasAgreed(true)} onLogout={onLogout} />;
  }
  if (!user) return null;
  return <ApplicationForm user={user} onLogout={onLogout} />;
}

function ConsentView({ onAgree, onLogout }: { onAgree: () => void; onLogout: () => void }) {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-800 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col h-[85vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div>
            <h2 className="text-xl font-medium tracking-wide text-slate-800">計畫申請規範與同意書</h2>
            <p className="text-sm text-slate-500 font-light mt-1">開始撰寫前，請務必詳閱以下須知與規範</p>
          </div>
          <button onClick={onLogout} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">取消並登出</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-slate-50/50">
          <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-medium text-blue-600 mb-4 flex items-center gap-2"><FileText size={20} />115年度基隆市政府地方型SBIR 申請須知摘要</h3>
            <div className="space-y-4 text-sm text-slate-600 font-light leading-relaxed">
              <p>基隆市政府為鼓勵轄內中小企業創新技術或服務，特提供轄內廠商創新應用或研發補助，提升產業競爭力，促進產業發展。</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="font-medium text-slate-700">申請資格：</strong>符合「中小企業認定標準」之國內中小企業，實收資本額在新臺幣一億元以下，或經常僱用員工數未滿二百人之事業。</li>
                <li><strong className="font-medium text-slate-700">補助上限：</strong>「個別申請」補助款上限為100萬元整，「聯合申請」補助款上限為200萬元整(每家上限100萬)。</li>
                <li><strong className="font-medium text-slate-700">不符資格情事：</strong>於5年內曾有執行政府計畫重大違約紀錄者、3年內有欠繳應納稅捐情事等。</li>
              </ul>
            </div>
          </section>

          <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-medium text-blue-600 mb-4 flex items-center gap-2"><ShieldCheck size={20} />蒐集個人資料告知事項暨個人資料提供同意書</h3>
            <div className="space-y-4 text-sm text-slate-600 font-light leading-relaxed">
              <p>基隆市政府為遵守個人資料保護法規定，在您提供個人資料予本府前，依法告知下列事項：</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>本府因協助產業創新活動補助等目的而獲取您下列個人資料。</li>
                <li>本府將於蒐集目的之存續期間合理利用您的個人資料。</li>
                <li>您可依個人資料保護法就您的個人資料向本府行使相關權利。</li>
              </ol>
            </div>
          </section>
        </div>

        <div className="px-8 py-6 border-t border-slate-100 bg-white">
          <label className="flex items-center gap-3 cursor-pointer group mb-6">
            <input type="checkbox" className="hidden" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} />
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
              {isChecked && <CheckSquare size={14} className="text-white" />}
            </div>
            <span className="text-sm font-medium text-slate-700">我已詳閱並同意上述申請規範與個人資料蒐集條款，且聲明本企業無違反環保、勞工等相關法令之重大情事。</span>
          </label>
          <div className="flex justify-end">
            <button 
              onClick={onAgree}
              disabled={!isChecked}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-medium tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 shadow-sm"
            >
              開始撰寫計畫 <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ApplicationFormData = {
  projectCategory: string;
  projectName: string;
  projectStartDate: string;
  projectEndDate: string;
  projectMonths: string;
  companyName: string;
  leaderName: string;
  submitYear: string;
  submitMonth: string;
  foundingDate: string;
  mainBusinessItems: string;
  summary: string;
  innovationFocus: string;
  executionAdvantage: string;
  benefitValue: string;
  benefitNewProduct: string;
  benefitDerivedProduct: string;
  benefitAdditionalRnD: string;
  benefitInvestment: string;
  benefitCostReduction: string;
  benefitEmployment: string;
  benefitNewCompany: string;
  benefitInventionPatent: string;
  benefitUtilityPatent: string;
  qualitativeBenefits: string;
  files: Array<{
    id: string;
    name: string;
    size: string;
    status: "uploading" | "uploaded" | "error";
    drive: { webViewLink?: string } | null;
    error: string | null;
  }>;
  companyProfile: CompanyProfileValue;
  planContent: PlanContentValue;
  expectedBenefits: ExpectedBenefitsValue;
  scheduleCheckpoints: ScheduleCheckpointsValue;
  humanBudget: HumanBudgetValue;
};

function ApplicationForm({ user, onLogout }: { user: UserContext; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [formData, setFormData] = useState<ApplicationFormData>({
    // 第一頁籤：封面
    projectCategory: '', projectName: '',
    projectStartDate: '', projectEndDate: '', projectMonths: '',
    companyName: '', leaderName: '',
    submitYear: '115', submitMonth: '',
    // 第二頁籤：公司簡介 (其中 companyName 和 leaderName 共用)
    foundingDate: '', mainBusinessItems: '',
    // 第二頁籤：計畫摘要與優勢
    summary: '', innovationFocus: '', executionAdvantage: '',
    // 第二頁籤：預期效益 (量化 10 項)
    benefitValue: '', benefitNewProduct: '', benefitDerivedProduct: '',
    benefitAdditionalRnD: '', benefitInvestment: '', benefitCostReduction: '',
    benefitEmployment: '', benefitNewCompany: '', benefitInventionPatent: '', benefitUtilityPatent: '',
    // 第二頁籤：預期效益 (非量化)
    qualitativeBenefits: '',
    // 附件
    files: [],
    // Tab 3-7 data containers (for draft + PDF filling)
    companyProfile: undefined,
    planContent: undefined,
    expectedBenefits: undefined,
    scheduleCheckpoints: undefined,
    humanBudget: undefined,
  });

  const tabs = [
    { id: 1, title: '封面與基本資料' },
    { id: 2, title: '計畫書摘要表' },
    { id: 3, title: '壹、公司概況' },
    { id: 4, title: '貳、計畫內容與實施方式' },
    { id: 5, title: '參、預期效益' },
    { id: 6, title: '肆、預定進度及查核點' },
    { id: 7, title: '伍、人力及經費需求表' },
    { id: 8, title: '陸、附件上傳' }
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };

      // 自動計算：計畫相差月數（避免在 effect 中 setState）
      if (name === 'projectStartDate' || name === 'projectEndDate') {
        const start = new Date(next.projectStartDate);
        const end = new Date(next.projectEndDate);

        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          const isLastDayOfMonth = end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
          if (end.getDate() >= start.getDate() || isLastDayOfMonth) months += 1;
          next.projectMonths = months.toString();
        } else {
          next.projectMonths = '';
        }
      }
      return next;
    });
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    // 儲存到後端（本機草稿）
    fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData }),
    })
      .then(() => {
        setLastSaved(new Date().toLocaleTimeString());
      })
      .finally(() => setIsSaving(false));
  };

  const handleNext = () => {
    handleSaveDraft();
    if (activeTab < tabs.length) setActiveTab(activeTab + 1);
  };

  const handleTabChange = (nextTab: number) => {
    if (nextTab === activeTab) return;
    handleSaveDraft();
    setActiveTab(nextTab);
  };

  const handleGeneratePdf = async () => {
    handleSaveDraft();
    const safeBaseName = makeSafeFilenameBase(formData.projectName) || "sbir-plan";
    const filename = `${safeBaseName}.pdf`;
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, filename }),
    });
    if (!res.ok) {
      const err = await res.json().catch(async () => ({ error: await res.text().catch(() => 'PDF 產製失敗') }));
      alert(`PDF 產製失敗：${err?.error || '未知錯誤'}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSubmitToDrive = async () => {
    // 先產製 PDF，再送到後端上傳 Drive（需設定 service account 環境變數）
    handleSaveDraft();
    const safeBaseName = makeSafeFilenameBase(formData.projectName) || "sbir-plan";
    const filename = `${safeBaseName}.pdf`;
    const pdfRes = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, filename }),
    });
    if (!pdfRes.ok) {
      const err = await pdfRes.json().catch(async () => ({ error: await pdfRes.text().catch(() => 'PDF 產製失敗') }));
      alert(`PDF 產製失敗：${err?.error || '未知錯誤'}`);
      return;
    }
    const buf = await pdfRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64, filename }),
    });
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">K</div>
          <span className="font-medium tracking-wide text-slate-800">地方型 SBIR 線上撰寫系統</span>
          <span className="ml-4 px-2 py-1 bg-amber-50 text-amber-600 text-[10px] tracking-widest rounded border border-amber-100">DRAFT</span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={onLogout}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 bg-white px-3 py-1.5 rounded-lg shadow-sm"
          >
            返回首頁
          </button>
          {lastSaved && (
            <span className="text-xs text-slate-400 flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" />已儲存草稿 ({lastSaved})</span>
          )}
          <div className="text-sm text-slate-500 flex items-center gap-2 border-l border-slate-100 pl-6"><User size={16} />{user.name}</div>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16} />離開</button>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] w-full mx-auto p-6 gap-6 items-start">
        <aside className="w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden sticky top-24">
          <div className="p-5 border-b border-slate-50"><h3 className="text-xs font-semibold text-slate-400 tracking-widest uppercase">計畫書章節</h3></div>
          <nav className="p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200 ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-light'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                  activeTab === tab.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                }`}>{tab.id}</div>
                {tab.title}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] min-h-[70vh] flex flex-col">
          <div className="p-8 md:p-12 flex-1">
            
            {/* 只在非封面頁顯示一般標題 */}
            {activeTab !== 1 && (
               <h2 className="text-2xl font-medium tracking-wide text-slate-800 mb-8 border-b border-slate-100 pb-4">
                 {tabs.find(t => t.id === activeTab)?.title}
               </h2>
            )}

            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* 第 1 頁籤：正式封面設計 */}
              {activeTab === 1 && (
                <div className="bg-white p-8 md:p-16 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[600px]">
                  
                  {/* 頂部標題 */}
                  <div className="text-center space-y-4 mb-16">
                     <h2 className="text-2xl md:text-4xl font-semibold tracking-[0.2em] text-slate-800">115年度基隆市政府地方產業創新研發推動計畫</h2>
                     <h3 className="text-xl md:text-2xl font-medium tracking-[0.3em] text-slate-600">（地方型 SBIR）</h3>
                  </div>

                  {/* 類別選擇 */}
                  <div className="flex justify-center gap-12 mb-16">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="projectCategory" value="創新技術" checked={formData.projectCategory === '創新技術'} onChange={handleInputChange} className="w-5 h-5 text-blue-600 border-slate-400 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-lg font-medium text-slate-700 group-hover:text-blue-600 transition-colors tracking-widest">創新技術</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="projectCategory" value="創新服務" checked={formData.projectCategory === '創新服務'} onChange={handleInputChange} className="w-5 h-5 text-blue-600 border-slate-400 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-lg font-medium text-slate-700 group-hover:text-blue-600 transition-colors tracking-widest">創新服務</span>
                    </label>
                  </div>
                  <div className="text-center text-xs text-slate-500 font-light -mt-10 mb-14 leading-relaxed">
                    建議選擇與本案主要研發標的最一致的類別（技術/服務）。若兩者皆有，請以「補助成果驗收的核心」為主。
                  </div>

                  {/* 計畫名稱 */}
                  <div className="max-w-2xl mx-auto space-y-4 mb-16 text-center w-full">
                    <p className="text-slate-500 font-medium tracking-[0.5em] text-xl">＜申請計畫名稱＞</p>
                    <input 
                      type="text" 
                      name="projectName" 
                      value={formData.projectName} 
                      onChange={handleInputChange} 
                      className="w-full text-center text-2xl md:text-3xl py-4 font-bold border-b-2 border-t-0 border-l-0 border-r-0 border-slate-300 rounded-none bg-transparent focus:ring-0 focus:border-blue-500 px-0 transition-colors placeholder:font-light placeholder:text-slate-300" 
                      placeholder="請填寫計畫名稱" 
                    />
                    <p className="text-slate-400 text-base tracking-[0.5em] mt-4">(草 案)</p>
                    <p className="text-xs text-slate-500 font-light leading-relaxed">
                      請使用「一句話看懂」的命名方式：目標客群 + 解決的問題 + 核心技術/服務（避免只有產品代號）。
                    </p>
                  </div>

                  {/* 計畫期間與公司資料 */}
                  <div className="max-w-2xl mx-auto space-y-10 w-full">
                    
                    {/* 【優化更新】計畫期間 (日曆與自動計算) */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 text-slate-700 text-lg tracking-wide w-full">
                       <div className="flex items-center gap-2">
                         <span className="font-medium whitespace-nowrap">計畫期間：自</span>
                         <input type="date" name="projectStartDate" value={formData.projectStartDate} onChange={handleInputChange} className="form-input py-1.5 text-center text-base w-[150px] cursor-pointer text-slate-600" />
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="font-medium whitespace-nowrap">至</span>
                         <input type="date" name="projectEndDate" value={formData.projectEndDate} onChange={handleInputChange} className="form-input py-1.5 text-center text-base w-[150px] cursor-pointer text-slate-600" />
                         <span className="font-medium whitespace-nowrap">止</span>
                       </div>
                       <div className="flex items-center gap-2 mt-2 md:mt-0">
                         <span className="font-medium whitespace-nowrap">(共</span>
                         <input type="number" name="projectMonths" value={formData.projectMonths} className="form-input w-20 py-1.5 text-center text-base bg-slate-100 text-slate-500 cursor-not-allowed font-semibold" readOnly placeholder="0" />
                         <span className="font-medium whitespace-nowrap">個月)</span>
                       </div>
                    </div>
                    <div className="text-center text-xs text-slate-500 font-light leading-relaxed">
                      計畫期間請與後續「預定進度及查核點」一致；若跨年度，仍以實際起訖日填寫（系統會自動計算月數）。
                    </div>

                    {/* 公司名稱與負責人 */}
                    <div className="space-y-6 pt-8 border-t border-slate-100">
                      <div className="flex items-center justify-center gap-4 text-lg">
                        <span className="text-slate-700 font-medium tracking-widest w-32 text-right">公司名稱：</span>
                        <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} className="form-input w-80 py-2 text-center text-base" placeholder="申請公司全名" />
                      </div>
                      <div className="flex items-center justify-center gap-4 text-lg">
                        <span className="text-slate-700 font-medium tracking-widest w-32 text-right">負責人：</span>
                        <input type="text" name="leaderName" value={formData.leaderName} onChange={handleInputChange} className="form-input w-80 py-2 text-center text-base" placeholder="請填寫負責人姓名" />
                      </div>
                    </div>
                    <div className="text-center text-xs text-slate-500 font-light leading-relaxed">
                      公司名稱請填公司登記全名；負責人請填公司登記負責人（後續章節會自動帶入）。
                    </div>

                    {/* 填寫日期 */}
                    <div className="mt-16 pt-12 text-center text-slate-700 font-medium text-xl tracking-[0.2em] flex items-center justify-center gap-2">
                       中華民國 
                       <input type="text" name="submitYear" value={formData.submitYear} onChange={handleInputChange} className="form-input inline-block w-20 py-1 text-center text-lg mx-2" /> 
                       年 
                       <input type="text" name="submitMonth" value={formData.submitMonth} onChange={handleInputChange} className="form-input inline-block w-16 py-1 text-center text-lg mx-2" placeholder="O" /> 
                       月
                    </div>
                    <div className="text-center text-xs text-slate-500 font-light leading-relaxed">
                      本日期為計畫書填表日期（可先填預估月份，後續仍可調整）。
                    </div>
                  </div>
                </div>
              )}

              {/* 第 2 頁籤：計畫書摘要表 */}
              {activeTab === 2 && (
                <div className="space-y-10">
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-2 text-sm text-blue-700 font-light">
                    本摘要得於政府相關網站上公開發佈。請重點條列說明，並以1頁為原則。本摘要所有格式不得刪減、調整。
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">公司簡介</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputGroup label="(一) 公司名稱" required hint="會從封面自動帶入；請確認與公司登記全名一致。">
                        <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} className="form-input" />
                      </InputGroup>
                      <InputGroup label="(二) 設立日期" required hint="請填公司設立登記日期；後續公司概況也會引用此欄位。">
                        <input type="date" name="foundingDate" value={formData.foundingDate} onChange={handleInputChange} className="form-input text-slate-600 cursor-pointer" />
                      </InputGroup>
                      <InputGroup label="(三) 負責人" required hint="會從封面自動帶入；請填公司登記負責人。">
                        <input type="text" name="leaderName" value={formData.leaderName} onChange={handleInputChange} className="form-input" />
                      </InputGroup>
                      <InputGroup label="(四) 主要營業項目" required hint="請用 3–5 個關鍵詞，對應公司實際營運（例如：智慧製造、數位行銷、SaaS）。">
                        <input type="text" name="mainBusinessItems" value={formData.mainBusinessItems} onChange={handleInputChange} className="form-input" />
                      </InputGroup>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">計畫摘要 (此摘要內容屬可公開部份)</h3>
                    <InputGroup
                      label="(一) 計畫內容摘要 (約100字)"
                      required
                      hint="建議格式：目標（做什麼）→方法（怎麼做）→產出（交付物）→對象（誰受益）。避免放商業機密。"
                    >
                      <textarea name="summary" value={formData.summary} onChange={handleInputChange} className="form-textarea h-24" placeholder="請簡述計畫目標、主要工作項目等..." />
                    </InputGroup>
                    <InputGroup
                      label="(二) 計畫創新重點 (約100字)"
                      required
                      hint="請聚焦 1–3 個可驗證的創新點：相較既有方案的差異、突破點、量化指標（例如效能/成本/時間）。"
                    >
                      <textarea name="innovationFocus" value={formData.innovationFocus} onChange={handleInputChange} className="form-textarea h-24" placeholder="請說明本計畫與現有技術/服務的差異與創新之處..." />
                    </InputGroup>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">執行優勢</h3>
                    <InputGroup
                      label="請說明公司執行本計畫優勢為何？"
                      required
                      hint="建議條列：團隊能力（技術/產業）、資源（資料/設備/合作夥伴）、通路（客戶/場域）、過往成果（案例/專利/認證）。"
                    >
                      <textarea name="executionAdvantage" value={formData.executionAdvantage} onChange={handleInputChange} className="form-textarea h-24" placeholder="例如團隊技術背景、市場通路掌握度等..." />
                    </InputGroup>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">預期效益 (結案三年內產出)</h3>
                    <div className="text-sm text-slate-500 mb-2 font-light">
                      (一) 量化效益：量化效益應客觀評估，並作為本計畫驗收成果之參考，若無請填「0」。
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">1. 增加產值</span>
                        <input type="number" name="benefitValue" value={formData.benefitValue} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">2. 產出新產品或服務共</span>
                        <input type="number" name="benefitNewProduct" value={formData.benefitNewProduct} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">項</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">3. 衍生商品或服務數共</span>
                        <input type="number" name="benefitDerivedProduct" value={formData.benefitDerivedProduct} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">項</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">4. 額外投入研發費用</span>
                        <input type="number" name="benefitAdditionalRnD" value={formData.benefitAdditionalRnD} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">5. 促成投資額</span>
                        <input type="number" name="benefitInvestment" value={formData.benefitInvestment} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">6. 降低成本</span>
                        <input type="number" name="benefitCostReduction" value={formData.benefitCostReduction} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">7. 增加就業人數</span>
                        <input type="number" name="benefitEmployment" value={formData.benefitEmployment} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">人</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">8. 成立新公司</span>
                        <input type="number" name="benefitNewCompany" value={formData.benefitNewCompany} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">家</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">9. 發明專利共</span>
                        <input type="number" name="benefitInventionPatent" value={formData.benefitInventionPatent} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">件</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 w-40 flex-shrink-0">10. 新型/新式樣專利共</span>
                        <input type="number" name="benefitUtilityPatent" value={formData.benefitUtilityPatent} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" />
                        <span className="text-sm text-slate-500 w-10 flex-shrink-0">件</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2 font-light leading-relaxed">
                      ※增加產值(因本計畫產生之營業額)、額外投入研發費用(不含政府補助款與自籌款)、促成投資額(自行增資或吸引外在投資)、增加就業人數(需加保勞保，若其為計畫編列之待聘人員需聘用超過3個月)
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100">
                      <InputGroup
                        label="(二) 非量化效益"
                        required
                        hint="例如：建立研發制度、提升品質/交付能力、品牌信任、跨域合作、產業示範效應等（可條列）。"
                      >
                        <textarea name="qualitativeBenefits" value={formData.qualitativeBenefits} onChange={handleInputChange} className="form-textarea h-24" placeholder="請以敘述性方式說明，例如對公司的影響等..." />
                      </InputGroup>
                    </div>
                  </div>
                </div>
              )}

              {/* 第 8 頁籤 */}
              {activeTab === 8 && (
                <FileUploadUI formData={formData} setFormData={setFormData} />
              )}

              {/* 第 3 分頁載入做好的 CompanyProfileForm，其餘佔位 */}
              <>
                {activeTab === 3 && (
                  <CompanyProfileForm
                    shared={{
                      companyName: formData.companyName,
                      establishDate: formData.foundingDate,
                      representative: formData.leaderName,
                    }}
                    onSharedChange={(next) =>
                      setFormData((prev) => ({
                        ...prev,
                        companyName: next.companyName,
                        foundingDate: next.establishDate,
                        leaderName: next.representative,
                      }))
                    }
                    value={formData.companyProfile || undefined}
                    onChange={(nextCompanyProfile) =>
                      setFormData((prev) => ({
                        ...prev,
                        companyProfile: nextCompanyProfile,
                      }))
                    }
                  />
                )}

                {activeTab === 4 && <PlanContentImplementationForm />}
                {activeTab === 4 && (
                  <PlanContentImplementationForm
                    value={formData.planContent || undefined}
                    onChange={(next) => setFormData((p) => ({ ...p, planContent: next }))}
                  />
                )}
                {activeTab === 5 && (
                  <ExpectedBenefitsForm
                    value={formData.expectedBenefits || undefined}
                    onChange={(next) => setFormData((p) => ({ ...p, expectedBenefits: next }))}
                  />
                )}
                {activeTab === 6 && (
                  <ScheduleCheckpointsForm
                    value={formData.scheduleCheckpoints || undefined}
                    onChange={(next) => setFormData((p) => ({ ...p, scheduleCheckpoints: next }))}
                  />
                )}
                {activeTab === 7 && (
                  <HumanBudgetRequirementsForm
                    companyName={formData.companyName}
                    value={formData.humanBudget || undefined}
                    onChange={(next) => setFormData((p) => ({ ...p, humanBudget: next }))}
                  />
                )}
              </>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center rounded-b-2xl">
            <button 
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium text-sm shadow-sm"
            >
              <Save size={16} className={isSaving ? 'animate-pulse' : ''} />
              {isSaving ? '儲存中...' : '儲存草稿'}
            </button>
            
            <div className="flex items-center gap-3">
              {activeTab === 8 && (
                <>
                  <button
                    onClick={handleGeneratePdf}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
                  >
                    撰寫完成產製PDF檔
                  </button>
                  <button
                    onClick={handleSubmitToDrive}
                    className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
                  >
                    確定送出
                  </button>
                </>
              )}
              {activeTab !== 8 && (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-8 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm shadow-sm"
                >
                  儲存並前往下一步
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>

        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .form-input {
          width: 100%; padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;
          background-color: #f8fafc; color: #1e293b; font-weight: 300; outline: none; transition: all 0.2s;
        }
        .form-input:focus { background-color: #ffffff; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .form-textarea {
          width: 100%; padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;
          background-color: #f8fafc; color: #1e293b; font-weight: 300; outline: none; transition: all 0.2s; resize: vertical;
        }
        .form-textarea:focus { background-color: #ffffff; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
      `}} />
    </div>
  );
}

function makeSafeFilenameBase(input: unknown) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  // Windows forbidden characters: < > : " / \ | ? * and control chars
  const cleaned = raw
    .replace(/[<>:"/\\\\|?*]/g, ' ')
    .replace(/[\\u0000-\\u001F\\u007F]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
  // Avoid trailing dots/spaces (Windows)
  return cleaned.replace(/[\\.\\s]+$/g, '').slice(0, 80);
}

// 輔助表單元件：欄位群組
function InputGroup({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <div className="text-xs text-slate-500 font-light leading-relaxed">{hint}</div>}
      {children}
    </div>
  );
}

// 輔助表單元件：附件上傳區塊
function FileUploadUI({
  formData,
  setFormData,
}: {
  formData: ApplicationFormData;
  setFormData: React.Dispatch<React.SetStateAction<ApplicationFormData>>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingIds, setUploadingIds] = useState(() => new Set<string>());

  const uploadOne = async (file: File, localId: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('filename', file.name);

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const err = data?.error || 'Upload failed';
      const hint = data?.hint ? `（${data.hint}）` : '';
      setFormData(prev => ({
        ...prev,
        files: prev.files.map(f => (f.id === localId ? { ...f, status: 'error', error: `${err}${hint}` } : f))
      }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      files: prev.files.map(f => (f.id === localId ? { ...f, status: 'uploaded', drive: data.file } : f))
    }));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);

    const newItems: ApplicationFormData["files"] = list.map((file) => {
      const id = Math.random().toString(36).slice(2, 10);
      return {
        id,
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        status: 'uploading',
        drive: null,
        error: null,
      };
    });

    setFormData(prev => ({ ...prev, files: [...prev.files, ...newItems] }));
    setUploadingIds(prev => new Set([...Array.from(prev), ...newItems.map(i => i.id)]));

    await Promise.all(
      newItems.map((item, idx) => uploadOne(list[idx], item.id))
    );

    setUploadingIds(prev => {
      const next = new Set(prev);
      newItems.forEach(i => next.delete(i.id));
      return next;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFormData(prev => ({ ...prev, files: prev.files.filter(f => f.id !== id) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
        <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 font-light leading-relaxed">
          <p className="font-medium mb-1">上傳提醒：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>請依申請須知備妥相關文件，如：公司登記證明、無欠稅證明、會計師報表等。</li>
            <li>若為聯合申請，請務必上傳<strong className="font-medium">聯合合作協議書</strong>。</li>
            <li>檔案格式限定為 PDF, JPG, PNG，單一檔案大小請勿超過 10MB。</li>
          </ul>
        </div>
      </div>

      <div 
        className={`relative w-full p-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 bg-slate-50/50 ${
          isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); void handleFiles(e.dataTransfer.files); }}
      >
        <UploadCloud size={48} className={`mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
        <p className="text-slate-700 font-medium mb-1">拖曳檔案至此，或點擊選擇檔案</p>
        <p className="text-xs text-slate-400 font-light">支援 PDF, DOCX, JPG, PNG 格式</p>
        
        <input 
          type="file" 
          multiple 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          onChange={handleFileSelect}
        />
      </div>

      {formData.files.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-slate-700 mb-4 tracking-wide">已上傳之附件清單</h4>
          <div className="space-y-3">
            {formData.files.map(file => (
              <div key={file.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-blue-500 border border-slate-100">
                    <File size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400 font-light mt-0.5">
                      {file.size}
                      {file.status === 'uploading' && <span className="ml-2 text-blue-600">上傳中...</span>}
                      {file.status === 'uploaded' && file.drive?.webViewLink && (
                        <a className="ml-2 text-blue-600 hover:underline" href={file.drive.webViewLink} target="_blank" rel="noreferrer">
                          Drive 連結
                        </a>
                      )}
                      {file.status === 'error' && <span className="ml-2 text-red-600">上傳失敗</span>}
                    </p>
                    {file.status === 'error' && file.error && (
                      <p className="text-[11px] text-red-600 mt-1">
                        {String(file.error)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  disabled={uploadingIds.has(file.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 輔助圖示元件
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      <path fill="none" d="M1 1h22v22H1z"/>
    </svg>
  );
}