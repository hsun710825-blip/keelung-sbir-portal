"use client";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { 
  Calendar, CircleDollarSign, ShieldCheck, ArrowRight, User, 
  LogOut, Phone, Building2, FileText, CheckSquare, 
  UploadCloud, Save, ChevronRight, ChevronLeft, AlertCircle, Trash2, File, CheckCircle2 
} from 'lucide-react';
import CompanyProfileForm from '@/components/CompanyProfileForm'; 
import PlanContentImplementationForm from '@/components/PlanContentImplementationForm';
import ExpectedBenefitsForm from '@/components/ExpectedBenefitsForm';
import ScheduleCheckpointsForm from '@/components/ScheduleCheckpointsForm';
import HumanBudgetRequirementsForm from '@/components/HumanBudgetRequirementsForm';
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { formatRocDateLongFromIso, isoDateToRocParts, rocYmdToIso, rocYearOptions } from "@/lib/dateRoc";
import { isSubmitLockScheduleActiveNow } from "@/lib/planLockSchedule";
import {
  formatSubmittedAtForDisplay,
  formatTaipeiDateTime,
  formatTaipeiTimeOnly,
  getTaipeiFullYear,
} from "@/lib/taipeiTime";
import { applicationStatusLabel } from "@/lib/applicationStatusLabels";
import type { ApplicationStatus } from "@prisma/client";

type UserRole = "applicant" | "reviewer";
type UserContext = { name: string; role: UserRole; email: string };
const REGISTRY_ENSURE_KEY = "sbir_registry_ensure_email";
const LOGIN_DIALOG_OK_KEY = "sbir_login_dialog_ok";

type CompanyProfileValue = React.ComponentProps<typeof CompanyProfileForm>["value"];
type PlanContentValue = React.ComponentProps<typeof PlanContentImplementationForm>["value"];
type ExpectedBenefitsValue = React.ComponentProps<typeof ExpectedBenefitsForm>["value"];
type ScheduleCheckpointsValue = React.ComponentProps<typeof ScheduleCheckpointsForm>["value"];
type HumanBudgetValue = React.ComponentProps<typeof HumanBudgetRequirementsForm>["value"];

export default function App() {
  const { data: session, status } = useSession();
  const [isSimulatingLogin, setIsSimulatingLogin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>("applicant");
  const [authNotice, setAuthNotice] = useState<string>("");
  const [enterApplicantMode, setEnterApplicantMode] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const auth = params.get("auth");
      const error = params.get("error");
      if (auth === "forbidden") {
        setAuthNotice("權限不足：此帳號無法進入管理員後台（Prisma 需為 ADMIN 或 COMMITTEE）。");
      } else if (error === "AccessDenied") {
        setAuthNotice("登入遭拒：Google 帳號缺少 email，或已被系統拒絕登入。");
      } else if (error) {
        setAuthNotice(`登入發生錯誤（${error}）。請稍後再試。`);
      }
      if (params.get("enter") === "applicant") {
        setEnterApplicantMode(true);
        params.delete("enter");
        params.delete("auth");
        params.delete("error");
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.replaceState({}, "", next);
      } else if (auth || error) {
        params.delete("auth");
        params.delete("error");
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        window.history.replaceState({}, "", next);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleGoogleLogin = (role: UserRole) => {
    setUserRole(role);
    // 智慧按鈕：已登入則直接進對應區塊；未登入才觸發 OAuth。
    if (status === "authenticated" && session?.user?.email) {
      if (role === "reviewer") {
        window.location.href = "/admin";
      } else {
        setEnterApplicantMode(true);
      }
      return;
    }
    setIsSimulatingLogin(true);
    const callbackUrl = role === "reviewer" ? "/admin" : "/?enter=applicant";
    void signIn("google", { callbackUrl }).finally(() => setIsSimulatingLogin(false));
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(REGISTRY_ENSURE_KEY);
      sessionStorage.removeItem(LOGIN_DIALOG_OK_KEY);
    } catch {
      // ignore
    }
    void signOut({ callbackUrl: "/" });
  };

  const userContext: UserContext | null =
    status === "authenticated" && session?.user?.email
      ? {
          name: session.user.name ?? "申請者",
          email: session.user.email,
          role: userRole,
        }
      : null;

  const downloadFiles = [
    { name: "115年度SBIR-申請者文件檢查表.odt", type: "odt" as const },
    { name: "115年度SBIR-計畫申請表.odt", type: "odt" as const },
    { name: "115年度SBIR-聯合合作協議書.odt", type: "odt" as const },
    { name: "115年度基隆市政府地方產業創新研發推動申請須知.pdf", type: "pdf" as const },
    { name: "環勞衛切結書.odt", type: "odt" as const },
  ];

  if (enterApplicantMode && userContext) {
    return <Dashboard user={userContext} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-800 selection:bg-blue-100">
      <header role="banner" aria-label="基隆 SBIR 首頁頁首">
        <h1 className="sr-only">基隆市地方型 SBIR 申請系統首頁</h1>
      <nav
        className="absolute top-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent text-white"
        aria-label="頁首：單位識別與開發用選項"
      >
        <div className="text-sm tracking-wider font-light flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" aria-hidden />
          基隆市政府
        </div>
      </nav>

      <div className="relative w-full h-[65vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-top bg-slate-800"
          style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-[#fafafa]" aria-hidden />
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
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-20 pb-20">
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
                {authNotice && <p className="mt-3 text-xs text-rose-600">{authNotice}</p>}
              </div>
              <div className="space-y-4">
                <button 
                  type="button"
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
                  <div id="admin-login-section" className="space-y-0">
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                      <div className="relative flex justify-center text-xs"><span className="bg-white px-4 text-slate-400 font-light tracking-widest">內部人員</span></div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleGoogleLogin('reviewer')}
                      disabled={isSimulatingLogin}
                      className="w-full group relative flex items-center justify-center gap-3 bg-slate-50 border border-slate-200 text-slate-600 px-6 py-3.5 rounded-xl hover:bg-slate-100 transition-all duration-200 disabled:opacity-50"
                    >
                      <ShieldCheck size={18} className="text-slate-400" aria-hidden />
                      <span className="font-medium tracking-wide text-sm">管理員 / 審查委員 登入</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-8 text-center">
                <p className="text-[11px] text-slate-400 font-light">登入即表示您同意本計畫之隱私權政策與資訊安全規範。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 transition-all">
          <div className="w-full">
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-lg font-medium text-slate-800 tracking-wide flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                相關文件下載
              </h3>
              {/* @ai-ignore: 靜態檔案下載區塊已確認路徑與排版無誤，未來進行任何系統修改或擴充時，絕對不可更動此區塊的結構、檔案路徑與圖示設定。 */}
              <div className="mt-2 text-sm text-gray-500 leading-relaxed mb-6 space-y-2 font-light">
                <p>1. 請務必下載閱讀後依據補助須知規定登入系統撰寫計畫書</p>
                <p>2. 申請者文件檢查表、計畫申請表、環勞衛切結書請務必下載填寫用印後掃描為pdf檔上傳於計畫書系統&quot;附件上傳&quot;區</p>
                <p>3. 聯合提案者請務必再下載&quot;聯合合作協議書&quot;雙方皆須檢視填寫相關資料併用印後上傳，前項內容之&quot;申請者文件檢查表&quot;內文件，除第一張檢查表由雙方一起確認並用印，其他切結書如符合或必附之文件，請雙方皆須各自填寫用印上傳</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {downloadFiles.map((file) => {
                  const href = `/downloads/${encodeURIComponent(file.name)}`;
                  const isPdf = file.type === "pdf";
                  return (
                    <div
                      key={file.name}
                      className="flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/50"
                    >
                      <img
                        src={isPdf ? "/icon/pdf-icon.png" : "/icon/odt-icon.png"}
                        alt={isPdf ? "PDF 文件" : "ODT 文件"}
                        className="w-8 h-8 object-contain flex-shrink-0"
                      />
                      <span className="line-clamp-2 flex-1">{file.name}</span>
                      <a
                        href={href}
                        download
                        className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:scale-[1.03] hover:bg-blue-100"
                      >
                        <img
                          src="/icon/download-icon.png"
                          alt="下載"
                          className="w-5 h-5 object-contain"
                        />
                        <span>下載</span>
                      </a>
                    </div>
                  );
                })}
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
      </main>

      <footer className="w-full py-6 mt-auto text-center text-sm text-gray-500">
        <p>
          Copyright &copy; {getTaipeiFullYear()} 嘉澄股份有限公司 版權所有 <span className="mx-2">|</span> 連絡電話：(04)2326-8281
          <span className="mx-2">|</span>
          <Link href="/privacy" className="hover:text-slate-700 underline-offset-2 hover:underline">隱私權政策</Link>
          <span className="mx-2">|</span>
          <Link href="/terms" className="hover:text-slate-700 underline-offset-2 hover:underline">服務條款</Link>
        </p>
      </footer>
    </div>
  );
}

function Dashboard({ user, onLogout }: { user: UserContext | null; onLogout: () => void }) {
  const [hasAgreed, setHasAgreed] = useState(false);
  const [authGate, setAuthGate] = useState<"loading" | "dialog" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;

    const run = async () => {
      try {
        if (typeof window !== "undefined" && sessionStorage.getItem(LOGIN_DIALOG_OK_KEY) === user.email) {
          if (!cancelled) setAuthGate("ready");
          return;
        }
      } catch {
        // ignore sessionStorage errors
      }

      const post = () => fetch("/api/registry/ensure", { method: "POST", credentials: "include" });
      const delays = [0, 800, 1500];
      for (let i = 0; i < delays.length; i += 1) {
        if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
        const res = await post();
        if (res.ok) {
          try {
            if (typeof window !== "undefined") sessionStorage.setItem(REGISTRY_ENSURE_KEY, user.email);
          } catch {
            // ignore
          }
          if (!cancelled) setAuthGate("dialog");
          return;
        }
      }
      if (!cancelled) setAuthGate("failed");
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  if (authGate === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6" aria-busy="true">
        <h1 className="sr-only">基隆市地方型 SBIR 申請系統</h1>
        <p className="text-slate-600 text-center">正在完成登入驗證，請稍候...</p>
      </main>
    );
  }

  if (authGate === "failed") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fafafa] px-6">
        <h1 className="sr-only">基隆市地方型 SBIR 申請系統</h1>
        <p className="text-red-600 text-center">登入資料寫入失敗，請重新整理後再試。</p>
      </main>
    );
  }

  if (authGate === "dialog") {
    return (
      <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center px-4" role="presentation">
        <div
          className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registry-email-confirm-title"
        >
          <p id="registry-email-confirm-title" className="text-slate-800 leading-relaxed break-all">
            系統寫入帳號為 {user?.email || ""}
          </p>
          <button
            type="button"
            className="mt-6 w-full py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              try {
                if (user?.email) sessionStorage.setItem(LOGIN_DIALOG_OK_KEY, user.email);
              } catch {
                // ignore
              }
              setAuthGate("ready");
            }}
          >
            確定
          </button>
        </div>
      </div>
    );
  }

  if (!hasAgreed) {
    return <ConsentView onAgree={() => setHasAgreed(true)} onLogout={onLogout} />;
  }
  if (!user) return null;
  return <ApplicationForm user={user} onLogout={onLogout} />;
}

function ConsentView({ onAgree, onLogout }: { onAgree: () => void; onLogout: () => void }) {
  const [isChecked, setIsChecked] = useState(false);
  const consentCheckId = useId();

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-800 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col h-[85vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
          <div>
            <h2 className="text-xl font-medium tracking-wide text-slate-800">計畫申請規範與同意書</h2>
            <p className="text-sm text-slate-500 font-light mt-1">開始撰寫前，請務必詳閱以下須知與規範</p>
          </div>
          <button type="button" onClick={onLogout} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">取消並登出</button>
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
          <label htmlFor={consentCheckId} className="flex items-center gap-3 cursor-pointer group mb-6">
            <input
              id={consentCheckId}
              type="checkbox"
              className="sr-only"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
            />
            <span
              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-blue-500 border-blue-500 overflow-hidden' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}
              aria-hidden
            >
              {isChecked && <CheckSquare size={14} className="text-white" />}
            </span>
            <span className="text-sm font-medium text-slate-700">我已詳閱並同意上述申請規範與個人資料蒐集條款，且聲明本企業無違反環保、勞工等相關法令之重大情事。</span>
          </label>
          <div className="flex justify-end">
            <button 
              type="button"
              onClick={onAgree}
              disabled={!isChecked}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-medium tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 shadow-sm"
            >
              開始撰寫計畫 <ArrowRight size={18} className="shrink-0" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FoundingRocSelectors({
  value,
  onChange,
  labelledBy,
}: {
  value: string;
  onChange: (iso: string) => void;
  labelledBy?: string;
}) {
  const parts = isoDateToRocParts(value);
  const years = rocYearOptions();
  const rocY = parts?.rocY;
  const month = parts?.month;
  const day = parts?.day;

  return (
    <div
      className="flex flex-wrap gap-2 items-center"
      role={labelledBy ? "group" : undefined}
      aria-labelledby={labelledBy}
    >
      <select
        className="form-input min-w-[9rem]"
        aria-label="設立日期：民國年"
        value={rocY ? String(rocY) : ""}
        onChange={(e) => {
          const y = parseInt(e.target.value || "0", 10);
          if (!y) return onChange("");
          onChange(rocYmdToIso(y, month ?? 1, day ?? 1));
        }}
      >
        <option value="">選擇民國年</option>
        {years.map((y) => (
          <option key={y} value={y}>
            民國{y}年
          </option>
        ))}
      </select>
      <select
        className="form-input w-[6.5rem]"
        disabled={!rocY}
        aria-label="設立日期：月"
        value={month ? String(month) : ""}
        onChange={(e) => {
          if (!rocY) return;
          onChange(rocYmdToIso(rocY, parseInt(e.target.value || "1", 10), day ?? 1));
        }}
      >
        <option value="">月</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select
        className="form-input w-[6.5rem]"
        disabled={!rocY}
        aria-label="設立日期：日"
        value={day ? String(day) : ""}
        onChange={(e) => {
          if (!rocY) return;
          onChange(rocYmdToIso(rocY, month ?? 1, parseInt(e.target.value || "1", 10)));
        }}
      >
        <option value="">日</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
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
  attachmentChecks: { a1: boolean; a2: boolean; a3: boolean; a4: boolean; a5: boolean };
  files: Array<{
    id: string;
    name: string;
    size: string;
    status: "uploading" | "uploaded" | "error";
    drive: { webViewLink?: string } | null;
    error: string | null;
    attachmentIndex?: 1 | 2 | 3 | 4 | 5;
  }>;
  companyProfile: CompanyProfileValue;
  planContent: PlanContentValue;
  expectedBenefits: ExpectedBenefitsValue;
  scheduleCheckpoints: ScheduleCheckpointsValue;
  humanBudget: HumanBudgetValue;
  workflowStatus?: "draft" | "submitted";
  submittedAt?: string;
  expiresAt?: string;
  deletedAt?: string;
  isDeleted?: boolean;
};

type MeApplicationRow = {
  id: string;
  title: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

function getPlanLockState(formData: Partial<ApplicationFormData>) {
  // 前端顯示層鎖定判定：僅負責控制互動（真正阻擋仍由 API 端執行）。
  const status = String(formData.workflowStatus || "").toLowerCase();
  const deleted = Boolean(formData.isDeleted || formData.deletedAt);
  const expiresAtTs = formData.expiresAt ? Date.parse(String(formData.expiresAt)) : NaN;
  const expired = Number.isFinite(expiresAtTs) && expiresAtTs < Date.now();
  const submittedLocks = status === "submitted" && isSubmitLockScheduleActiveNow();
  const locked = deleted || expired || submittedLocks;
  const reason = deleted ? "已刪除" : expired ? "已過期" : submittedLocks ? "已送出" : "";
  return { locked, reason };
}

async function compressImageDataUrl(
  dataUrl: string,
  opts?: { maxSide?: number; qualitySteps?: number[]; targetChars?: number }
): Promise<string> {
  const raw = String(dataUrl || "");
  if (!raw.startsWith("data:image/")) return raw;
  // Keep small images untouched.
  if (raw.length < 450_000) return raw;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("圖片壓縮失敗"));
    i.src = raw;
  });

  const maxSide = Math.max(900, Math.min(2200, opts?.maxSide ?? 1600));
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);

  const qualitySteps = opts?.qualitySteps ?? [0.84, 0.74, 0.66, 0.58, 0.5, 0.42];
  let out = raw;
  for (const q of qualitySteps) {
    out = canvas.toDataURL("image/jpeg", q);
    const target = opts?.targetChars ?? 520_000;
    if (out.length <= target) break;
  }
  return out;
}

function stripTransientBlobUrls(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((v) => stripTransientBlobUrls(v));
  if (!input || typeof input !== "object") return input;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "url" && typeof v === "string" && v.startsWith("blob:")) {
      out[k] = "";
      continue;
    }
    out[k] = stripTransientBlobUrls(v);
  }
  return out;
}

function collectDataUrlRefs(input: unknown): Array<{ holder: Record<string, unknown>; key: string }> {
  const refs: Array<{ holder: Record<string, unknown>; key: string }> = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (k === "dataUrl" && typeof v === "string" && v.startsWith("data:image/")) {
        refs.push({ holder: rec, key: k });
      } else {
        walk(v);
      }
    }
  };
  walk(input);
  return refs;
}

async function optimizePayloadForTransport<T>(payload: T): Promise<T> {
  const stripped = stripTransientBlobUrls(payload) as T;
  let json = JSON.stringify(stripped);
  // Vercel edge/serverless request body guardrail.
  const budget = 3_800_000;
  if (json.length <= budget) return stripped;

  const refs = collectDataUrlRefs(stripped).sort((a, b) => {
    const al = String(a.holder[a.key] ?? "").length;
    const bl = String(b.holder[b.key] ?? "").length;
    return bl - al;
  });
  const passes: Array<{ maxSide: number; targetChars: number; qualitySteps: number[] }> = [
    { maxSide: 1400, targetChars: 420_000, qualitySteps: [0.78, 0.68, 0.58, 0.48] },
    { maxSide: 1200, targetChars: 320_000, qualitySteps: [0.72, 0.62, 0.52, 0.44] },
    { maxSide: 1000, targetChars: 240_000, qualitySteps: [0.66, 0.56, 0.48, 0.4] },
  ];
  for (const pass of passes) {
    for (const r of refs) {
      const cur = String(r.holder[r.key] ?? "");
      if (!cur.startsWith("data:image/")) continue;
      r.holder[r.key] = await compressImageDataUrl(cur, pass);
      json = JSON.stringify(stripped);
      if (json.length <= budget) return stripped;
    }
  }
  return stripped;
}

type RawTreeNode = {
  id?: string;
  text?: string;
  name?: string;
  weight?: string | number;
  execUnit?: string;
  unit?: string;
  children?: unknown[];
  subItems?: unknown[];
  parentId?: string;
};
type ScheduleBoundWorkItem = { id: string; item: string };

function cleanTreeData(input: unknown): RawTreeNode | null {
  if (!input || typeof input !== "object") return null;
  const n = input as RawTreeNode;
  const text = String(n.text ?? n.name ?? "").trim();
  if (!text) return null;
  const childrenRaw = Array.isArray(n.children)
    ? n.children
    : Array.isArray(n.subItems)
      ? n.subItems
      : [];
  const cleanedChildren = childrenRaw.map((c) => cleanTreeData(c)).filter(Boolean) as RawTreeNode[];
  const out: RawTreeNode = {
    id: typeof n.id === "string" ? n.id : undefined,
    text,
    weight: String(n.weight ?? "").trim(),
    execUnit: String(n.execUnit ?? n.unit ?? "").trim(),
  };
  if (cleanedChildren.length > 0) out.children = cleanedChildren;
  return out;
}

function sanitizePlanContent(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const plan = { ...(input as Record<string, unknown>) };
  const cleanedTree = cleanTreeData(plan.architectureTree);
  if (cleanedTree) {
    plan.architectureTree = cleanedTree;
    const formData = { ...((plan.formData as Record<string, unknown> | undefined) ?? {}) };
    formData.architectureTreeJson = JSON.stringify(cleanedTree);
    plan.formData = formData;
  } else {
    plan.architectureTree = null;
    const formData = { ...((plan.formData as Record<string, unknown> | undefined) ?? {}) };
    formData.architectureTreeJson = "";
    plan.formData = formData;
  }
  return plan;
}

function coerceArchitectureTreeForSchedule(parsed: unknown): RawTreeNode | null {
  if (parsed == null) return null;
  if (Array.isArray(parsed)) {
    const arr = parsed.filter((x) => x && typeof x === "object") as RawTreeNode[];
    if (!arr.length) return null;
    return { id: "__root_array__", text: "", children: arr };
  }
  if (typeof parsed !== "object") return null;
  const root = parsed as RawTreeNode & { nodes?: unknown[]; wbs?: unknown[]; items?: unknown[] };
  const nestedKids = Array.isArray(root.children)
    ? root.children
    : Array.isArray(root.subItems)
      ? root.subItems
      : [];
  if (nestedKids.length) return root;
  const flatCandidates = [root.nodes, root.wbs, root.items].find((a) => Array.isArray(a) && a.length) as unknown[] | undefined;
  if (!flatCandidates?.length) return root;
  const flat = flatCandidates.filter((x) => x && typeof x === "object") as Array<RawTreeNode & { parentId?: string }>;
  const hasParentLink = flat.some((n) => String(n.parentId ?? "").trim().length > 0);
  if (!hasParentLink) {
    return { id: "__root_flat__", text: "", children: flat };
  }
  type TNode = RawTreeNode & { id: string; children: RawTreeNode[] };
  const nodes: TNode[] = flat.map((n, i) => {
    const id = String(n.id ?? `__gen_${i}`).trim() || `__gen_${i}`;
    const text = String(n.text ?? n.name ?? "").trim();
    return { ...n, id, text, children: [] as RawTreeNode[] };
  });
  const byId = new Map<string, TNode>();
  for (const n of nodes) byId.set(String(n.id), n);
  const roots: TNode[] = [];
  for (const n of nodes) {
    const pid = String(n.parentId ?? "").trim();
    const p = pid ? byId.get(pid) : undefined;
    if (p) p.children.push(n);
    else roots.push(n);
  }
  if (roots.length === 0) return { id: "__root_rebuilt__", text: "", children: nodes };
  if (roots.length === 1) return roots[0]!;
  return { id: "__root_multi__", text: "", children: roots };
}

function buildScheduleBoundWorkItems(planContent: PlanContentValue | undefined): ScheduleBoundWorkItem[] {
  if (!planContent || typeof planContent !== "object") return [];
  const rawTree = (planContent as { architectureTree?: unknown; formData?: { architectureTreeJson?: string } }).architectureTree;
  const rawTreeJson = (planContent as { formData?: { architectureTreeJson?: string } }).formData?.architectureTreeJson;
  let parsed: unknown = null;
  if (rawTree && typeof rawTree === "object") parsed = rawTree;
  if (!parsed && typeof rawTreeJson === "string" && rawTreeJson.trim()) {
    try {
      parsed = JSON.parse(rawTreeJson);
    } catch {
      parsed = null;
    }
  }
  const tree = coerceArchitectureTreeForSchedule(parsed);
  if (!tree) return [];

  const normalizeName = (src: unknown, fallback = "") => {
    const raw = String(src ?? "").trim();
    const noPrefix = raw.replace(/^[A-Za-z](?:\d+)?\s*[-.．、]\s*/, "").trim();
    return noPrefix || raw || fallback;
  };

  const firstLevel = Array.isArray(tree.children) ? (tree.children as RawTreeNode[]) : [];
  const items: ScheduleBoundWorkItem[] = [];
  const seen = new Set<string>();

  const alphaCode = (idx: number): string => {
    let n = idx;
    let out = "";
    while (n >= 0) {
      out = String.fromCharCode(65 + (n % 26)) + out;
      n = Math.floor(n / 26) - 1;
    }
    return out;
  };

  const extractCode = (src: unknown): string => {
    const raw = String(src ?? "").trim();
    const m = raw.match(/^([A-Za-z]+[0-9]*)\s*[.．、\-]/);
    return (m?.[1] || "").toUpperCase();
  };

  const allocUniqueCode = (base: string) => {
    let b = (base || "W").toUpperCase();
    if (!b) b = "W";
    let out = b;
    let n = 0;
    while (seen.has(out)) {
      n += 1;
      out = `${b}~${n}`;
    }
    return out;
  };

  const walk = (node: RawTreeNode | null | undefined, siblingIndex: number, parentCode?: string) => {
    if (!node || typeof node !== "object") return;
    const rawLabel = node.text ?? node.name;
    const isSyntheticRoot =
      node.id === "__root_array__" || node.id === "__root_flat__" || node.id === "__root_multi__" || node.id === "__root_rebuilt__";
    if (isSyntheticRoot && !String(rawLabel ?? "").trim()) {
      const children = Array.isArray(node.children)
        ? (node.children as RawTreeNode[])
        : Array.isArray(node.subItems)
          ? (node.subItems as RawTreeNode[])
          : [];
      for (let i = 0; i < children.length; i++) walk(children[i], i, parentCode);
      return;
    }
    const explicitCode = extractCode(rawLabel);
    const computedCode = explicitCode || (parentCode ? `${parentCode}${siblingIndex + 1}` : alphaCode(siblingIndex));
    const baseCode = String(computedCode || "").trim().toUpperCase() || "W";
    const code = allocUniqueCode(baseCode);
    seen.add(code);

    const fallback = parentCode ? "工作項目" : "分項計畫";
    items.push({ id: code, item: `${code}. ${normalizeName(rawLabel, fallback)}` });

    const children = Array.isArray(node.children)
      ? (node.children as RawTreeNode[])
      : Array.isArray(node.subItems)
        ? (node.subItems as RawTreeNode[])
        : [];
    for (let i = 0; i < children.length; i++) {
      walk(children[i], i, code);
    }
  };

  for (let i = 0; i < firstLevel.length; i++) {
    walk(firstLevel[i], i);
  }
  return items;
}

async function buildDraftPayload(input: unknown): Promise<unknown> {
  if (Array.isArray(input)) {
    const out = await Promise.all(input.map((v) => buildDraftPayload(v)));
    return out;
  }
  if (!input || typeof input !== "object") return input;

  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "planContent") {
      out[k] = await buildDraftPayload(sanitizePlanContent(v));
    } else if (k === "dataUrl" && typeof v === "string") {
      // Preserve all applicant-uploaded image content, but compress oversized inline image payloads.
      out[k] = await compressImageDataUrl(v);
    } else if (k === "url" && typeof v === "string" && v.startsWith("blob:")) {
      // objectURL 僅在當前瀏覽器 session 有效，存入草稿會造成回載警告與 payload 膨脹。
      out[k] = "";
    } else {
      out[k] = await buildDraftPayload(v);
    }
  }
  return out;
}

/** 草稿 POST：遇冷啟／暫時性錯誤時重試；小 payload 時使用 keepalive 降低切換分頁被瀏覽器中止的機率 */
async function postDraftWithRetry(body: unknown, maxAttempts = 3): Promise<Response> {
  const serialized = JSON.stringify(body);
  const useKeepalive = serialized.length > 0 && serialized.length < 55_000;
  let last: Response | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serialized,
      credentials: "include",
      keepalive: useKeepalive,
    });
    if (last.ok) return last;
    if (last.status === 413) return last;
    const retry =
      attempt < maxAttempts - 1 &&
      (last.status === 502 || last.status === 503 || last.status === 504 || last.status === 0);
    if (!retry) return last;
    await new Promise((r) => setTimeout(r, 1600));
  }
  return last!;
}

async function buildTransportFormDataPayload(formData: ApplicationFormData): Promise<ApplicationFormData> {
  const draftPayload = (await buildDraftPayload(formData)) as ApplicationFormData;
  const optimized = (await optimizePayloadForTransport(draftPayload)) as ApplicationFormData;
  const serialized = JSON.stringify({ formData: optimized });
  if (serialized.length > 4_500_000) {
    throw new Error("草稿內容與圖片總量過大，請減少單張圖片尺寸或張數後再儲存。");
  }
  return optimized;
}

function formatApiErrorForAlert(prefix: string, err: unknown): string {
  const e = (err || {}) as {
    error?: string;
    hint?: string;
    detail?: { stage?: string; name?: string; code?: unknown; cause?: string; stackTop?: string | null };
  };
  const lines: string[] = [`${prefix}：${e.error || "未知錯誤"}`];
  if (e.hint) lines.push(`提示：${e.hint}`);
  if (e.detail) {
    lines.push(
      `detail => stage=${e.detail.stage || "-"}, name=${e.detail.name || "-"}, code=${String(e.detail.code ?? "-")}`
    );
    if (e.detail.cause) lines.push(`cause => ${e.detail.cause}`);
    if (e.detail.stackTop) lines.push(`stackTop =>\n${e.detail.stackTop}`);
  }
  return lines.join("\n");
}

function ApplicationForm({ user, onLogout }: { user: UserContext; onLogout: () => void }) {
  const coverFieldUid = useId();
  const benefitFieldUid = useId();
  const coverId = (suffix: string) => `${coverFieldUid}-${suffix}`;
  const benefitId = (suffix: string) => `${benefitFieldUid}-${suffix}`;

  const [activeTab, setActiveTab] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [lastPdfBlob, setLastPdfBlob] = useState<Blob | null>(null);
  const [lastPdfFilename, setLastPdfFilename] = useState<string>("");
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);
  // PDF 防連點狀態：避免短時間重複觸發 /api/pdf。
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  // 畫面唯讀鎖定：deleted／過期；送件後鎖定則依 planLockSchedule（預設 2026/5/5 起）。
  const [isPlanLocked, setIsPlanLocked] = useState(false);
  const [planLockReason, setPlanLockReason] = useState<string>("");
  const [dbApplications, setDbApplications] = useState<MeApplicationRow[]>([]);
  const lastAutoPreviewKeyRef = useRef<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSidebarHint, setShowSidebarHint] = useState(true);
  const [showIdleModal, setShowIdleModal] = useState(false);
  const lastActivityRef = useRef(Date.now());

  const refreshMyApplications = useCallback(() => {
    fetch("/api/applications/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { ok?: boolean; applications?: MeApplicationRow[] }) => {
        if (data?.ok && Array.isArray(data.applications)) {
          setDbApplications(data.applications);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshMyApplications();
  }, [refreshMyApplications]);

  const IDLE_MS = 15 * 60 * 1000;
  useEffect(() => {
    if (isPlanLocked || !draftLoaded) return;
    const bump = () => {
      lastActivityRef.current = Date.now();
      setShowIdleModal(false);
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    const id = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_MS) setShowIdleModal(true);
    }, 30_000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      window.clearInterval(id);
    };
  }, [isPlanLocked, draftLoaded]);

  useEffect(() => {
    const syncSidebarByViewport = () => {
      setIsSidebarOpen(window.innerWidth >= 1024);
    };
    syncSidebarByViewport();
    window.addEventListener("resize", syncSidebarByViewport);
    return () => window.removeEventListener("resize", syncSidebarByViewport);
  }, []);

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
    attachmentChecks: { a1: false, a2: false, a3: false, a4: false, a5: false },
    files: [],
    // Tab 3-7 data containers (for draft + PDF filling)
    companyProfile: undefined,
    planContent: undefined,
    expectedBenefits: undefined,
    scheduleCheckpoints: undefined,
    humanBudget: undefined,
  });

  const formSaveBlocked = useMemo(() => {
    const planMonthsNum = parseInt(formData.projectMonths, 10);
    const planTooLong =
      Boolean(formData.projectStartDate && formData.projectEndDate) &&
      Number.isFinite(planMonthsNum) &&
      planMonthsNum > 10;
    const summaryOver = Array.from(formData.summary || "").length > 110 || Array.from(formData.innovationFocus || "").length > 110;
    return planTooLong || summaryOver;
  }, [formData]);

  const scheduleBoundWorkItems = useMemo(
    () => buildScheduleBoundWorkItems(formData.planContent),
    [formData.planContent]
  );

  // 登入後自動載入先前草稿（若有）
  useEffect(() => {
    fetch('/api/draft')
      .then((res) => res.json())
      .then((data: { ok?: boolean; draft?: { formData?: ApplicationFormData } }) => {
        if (data?.ok && data?.draft?.formData) {
          const next = { ...data.draft!.formData };
          const lock = getPlanLockState(next);
          setIsPlanLocked(lock.locked);
          setPlanLockReason(lock.reason);
          setFormData((prev) => ({ ...prev, ...next }));
          if (next.submittedAt) {
            const shown = formatSubmittedAtForDisplay(next.submittedAt);
            if (shown) setLastSubmittedAt(shown);
          }
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setDraftLoaded(true));
  }, []);

  const tabs = [
    { id: 1, title: '封面與基本資料' },
    { id: 2, title: '計畫書摘要表' },
    { id: 3, title: '壹、公司概況' },
    { id: 4, title: '貳、計畫內容與實施方式' },
    { id: 5, title: '參、預期效益' },
    { id: 6, title: '肆、預定進度及查核點' },
    { id: 7, title: '伍、人力及經費需求表' },
    { id: 8, title: '陸、附件（依計畫實際情況檢附，無則免附）' },
    { id: 9, title: '柒、送出前PDF預覽' },
  ];

  useEffect(() => {
    if (!statusToast) return;
    const t = setTimeout(() => setStatusToast(null), 2800);
    return () => clearTimeout(t);
  }, [statusToast]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (isPlanLocked) return;
    const { name, value } = e.target;
    setFormData(prev => {
      let inputValue = value;
      if (name === "summary" || name === "innovationFocus") {
        const chars = Array.from(value);
        if (chars.length > 110) inputValue = chars.slice(0, 110).join("");
      }
      const next = { ...prev, [name]: inputValue };

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

  const saveDraftCore = async (): Promise<boolean> => {
    if (!draftLoaded) return false;
    if (isPlanLocked) {
      alert(`此計畫書目前為鎖定狀態（${planLockReason || "已鎖定"}），不可再修改。`);
      return false;
    }
    if (formSaveBlocked) {
      alert(
        formData.projectStartDate &&
          formData.projectEndDate &&
          parseInt(formData.projectMonths || "0", 10) > 10
          ? "已超過10個月請撰寫者重新輸入"
          : "計畫摘要與創新重點需在 110 字以內"
      );
      return false;
    }
    setIsSaving(true);
    try {
      const draftPayload = await buildTransportFormDataPayload(formData);
      const res = await postDraftWithRetry({ formData: draftPayload });
      if (!res.ok) {
        if (res.status === 413) {
          alert("草稿儲存失敗：內容或圖片過大（413）。請減少圖片張數或尺寸後重試。");
          return false;
        }
        const err = await res.json().catch(async () => ({ error: await res.text().catch(() => "草稿儲存失敗") }));
        alert(`草稿儲存失敗：${err?.error || "未知錯誤"}`);
        return false;
      }
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!body?.ok) {
        alert(`草稿儲存失敗：${body?.error || "未知錯誤"}`);
        return false;
      }
      setLastSaved(formatTaipeiTimeOnly());
      refreshMyApplications();
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async (opts?: { autoDownload?: boolean }): Promise<boolean> => {
    const ok = await saveDraftCore();
    if (!ok) return false;
    setStatusToast("草稿已儲存");
    if (opts?.autoDownload) {
      await handleGeneratePdf({ download: true, openPreview: true });
    }
    return true;
  };

  const handleNext = async () => {
    if (isPlanLocked) {
      if (activeTab < tabs.length) setActiveTab(activeTab + 1);
      return;
    }
    const ok = await saveDraftCore();
    if (!ok) {
      alert("草稿暫時無法儲存，已先帶您前往下一步；請稍後再按儲存草稿。");
    }
    if (activeTab < tabs.length) setActiveTab(activeTab + 1);
  };

  const handleTabChange = async (nextTab: number) => {
    if (nextTab === activeTab) return;
    if (isPlanLocked) {
      setActiveTab(nextTab);
      return;
    }
    const ok = await saveDraftCore();
    if (!ok) {
      alert("草稿暫時無法儲存，已先切換頁籤；請稍後再按儲存草稿。");
    }
    setActiveTab(nextTab);
  };

  const handleGeneratePdf = async (opts?: { download?: boolean; openPreview?: boolean }) => {
    if (formSaveBlocked || isSaving || isSubmitting || isPdfGenerating) return;
    setIsPdfGenerating(true);
    try {
    const saved = await saveDraftCore();
    if (!saved) return;
    const payloadFormData = await buildTransportFormDataPayload(formData);
    const safeBaseName = makeSafeFilenameBase(formData.projectName) || "sbir-plan";
    const filename = `${safeBaseName}.pdf`;
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData: payloadFormData, filename }),
    });
    if (!res.ok) {
      const err = await res.json().catch(async () => ({ error: await res.text().catch(() => 'PDF 產製失敗') }));
      alert(formatApiErrorForAlert("PDF 產製失敗", err));
      return;
    }
    const blob = await res.blob();
    setLastPdfBlob(blob);
    setLastPdfFilename(filename);
    if (opts?.openPreview) {
      const p = URL.createObjectURL(blob);
      setPreviewPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return p;
      });
    }
    if (opts?.download !== false) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleDownloadLastPdf = () => {
    if (!lastPdfBlob || !lastPdfFilename) return;
    const url = URL.createObjectURL(lastPdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = lastPdfFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const previewDataKey = useMemo(() => {
    if (activeTab !== 9) return "";
    return JSON.stringify({
      projectName: formData.projectName,
      companyName: formData.companyName,
      projectCategory: formData.projectCategory,
      projectStartDate: formData.projectStartDate,
      projectEndDate: formData.projectEndDate,
      projectMonths: formData.projectMonths,
      summary: formData.summary,
      innovationFocus: formData.innovationFocus,
      executionAdvantage: formData.executionAdvantage,
      expectedBenefits: formData.expectedBenefits,
      companyProfile: formData.companyProfile,
      planContent: formData.planContent,
      scheduleCheckpoints: formData.scheduleCheckpoints,
      humanBudget: formData.humanBudget,
      files: formData.files,
      attachmentChecks: formData.attachmentChecks,
    });
  }, [activeTab, formData]);

  useEffect(() => {
    if (activeTab !== 9 || !previewDataKey) return;
    if (isSaving || isSubmitting || isPdfGenerating || formSaveBlocked) return;
    if (lastAutoPreviewKeyRef.current === previewDataKey) return;
    lastAutoPreviewKeyRef.current = previewDataKey;
    void handleGeneratePdf({ download: false, openPreview: true });
  }, [activeTab, previewDataKey, isSaving, isSubmitting, isPdfGenerating, formSaveBlocked]);

  const handleSubmitToDrive = async () => {
    if (isPlanLocked) {
      alert(`此計畫書目前為鎖定狀態（${planLockReason || "已鎖定"}），不可再送出或修改。`);
      return;
    }
    if (formSaveBlocked) {
      alert(
        formData.projectStartDate &&
          formData.projectEndDate &&
          parseInt(formData.projectMonths || "0", 10) > 10
          ? "已超過10個月請撰寫者重新輸入"
          : "計畫摘要與創新重點需在 110 字以內"
      );
      return;
    }
    if (isSaving || isSubmitting) return;
    setIsSubmitting(true);
    setStatusToast("送出中（上傳 Drive 中，可能需數分鐘，請勿關閉頁面）");

    const controller = new AbortController();
    const timeoutMs = 5 * 60 * 1000; // 5 分鐘避免無限期卡住
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 先產製 PDF，再送到後端上傳 Drive（需設定 service account 環境變數）
      const saved = await saveDraftCore();
      if (!saved) return;
      const payloadFormData = await buildTransportFormDataPayload(formData);

      const safeBaseName = makeSafeFilenameBase(formData.projectName) || "sbir-plan";
      const filename = `${safeBaseName}.pdf`;
      const pdfRes = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: payloadFormData, filename }),
        signal: controller.signal,
      });
      if (!pdfRes.ok) {
        const err = await pdfRes
          .json()
          .catch(async () => ({ error: await pdfRes.text().catch(() => "PDF 產製失敗") }));
        alert(formatApiErrorForAlert("PDF 產製失敗", err));
        return;
      }
      const submitRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Let backend generate/upload PDF from formData to avoid large base64 conversion in browser.
        body: JSON.stringify({ formData: payloadFormData, filename, projectName: formData.projectName }),
        signal: controller.signal,
      });

      if (!submitRes.ok) {
        const err = await submitRes
          .json()
          .catch(async () => ({ error: await submitRes.text().catch(() => "送出失敗") }));
        alert(`送出失敗：${err?.error || "未知錯誤"}`);
        return;
      }

      const stamp = formatTaipeiDateTime(new Date());
      setLastSubmittedAt(stamp);
      setFormData((prev) => {
        const next = { ...prev, workflowStatus: "submitted" as const, submittedAt: stamp };
        const lock = getPlanLockState(next);
        setIsPlanLocked(lock.locked);
        setPlanLockReason(lock.reason);
        return next;
      });
      setStatusToast(`已於${stamp}成功送出`);
      alert(`已於${stamp}成功送出`);
      refreshMyApplications();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        alert("送出逾時：上傳流程可能尚未完成。請稍後再檢查狀態，必要時可再送出一次。");
        setStatusToast("送出逾時，請稍後重試");
      } else {
        alert(`送出失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
        setStatusToast("送出失敗");
      }
    } finally {
      clearTimeout(t);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-slate-800 flex flex-col">
      {isSaving && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-6"
          role="alertdialog"
          aria-live="assertive"
          aria-busy="true"
          aria-label="草稿儲存中"
        >
          <div className="pointer-events-auto max-w-md rounded-2xl bg-white px-8 py-10 shadow-xl text-center space-y-4 border border-slate-100">
            <div className="text-3xl" aria-hidden>
              ⏳
            </div>
            <p className="text-lg font-semibold text-slate-800">草稿儲存中，請稍候...</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              （您可以先喝口茶🍵稍作休息或進行別的工作稍後再回來繼續喔）
            </p>
          </div>
        </div>
      )}
      {showIdleModal && !isPlanLocked && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="idle-modal-title"
        >
          <div className="pointer-events-auto max-w-lg rounded-2xl bg-amber-50 border-2 border-amber-300 px-8 py-8 shadow-xl space-y-4">
            <h2 id="idle-modal-title" className="text-lg font-bold text-amber-900">
              ⚠️ 您已閒置一段時間，為避免資料遺失，請先點擊儲存草稿。
            </h2>
            <p className="text-sm text-amber-900/90 leading-relaxed">
              系統偵測到您超過 15 分鐘未操作。若您剛完成編輯，請儲存草稿後再離開或休息。
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-amber-600 px-4 py-3 text-white font-medium hover:bg-amber-700"
              onClick={() => {
                lastActivityRef.current = Date.now();
                setShowIdleModal(false);
              }}
            >
              我知道了
            </button>
          </div>
        </div>
      )}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">K</div>
          <span className="font-medium tracking-wide text-slate-800">地方型 SBIR 線上撰寫系統</span>
          <span className="ml-4 px-2 py-1 bg-amber-50 text-amber-600 text-[10px] tracking-widest rounded border border-amber-100">DRAFT</span>
        </div>
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 bg-white px-3 py-1.5 rounded-lg shadow-sm"
          >
            返回首頁
          </button>
          {lastSaved && (
            <span className="text-xs text-slate-400 flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" />已儲存草稿 ({lastSaved})</span>
          )}
          {lastSubmittedAt && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-600" />
              已於{lastSubmittedAt}成功送出
            </span>
          )}
          <div className="text-sm text-slate-500 flex items-center gap-2 border-l border-slate-100 pl-6"><User size={16} />{user.name}</div>
          <button type="button" onClick={onLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16} aria-hidden />離開</button>
        </div>
      </header>

      <div className="flex flex-1 w-full p-4 lg:p-6 gap-4 lg:gap-6 items-start">
        <aside
          className={`${
            isSidebarOpen ? "w-64" : "w-16"
          } flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden sticky top-24 transition-all duration-300 ease-in-out`}
        >
          <div className="p-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
            {isSidebarOpen ? (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 tracking-widest uppercase">案件進度</h3>
                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">以下為系統資料庫紀錄，與管理員後台 Prisma 總表同步。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="收合左側章節選單"
                  title="收合選單"
                >
                  <ChevronLeft size={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="展開左側章節選單"
                title="展開選單"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
          {isSidebarOpen ? (
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            {dbApplications.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                尚無案件。儲存草稿後會出現「草稿」；確認送件後狀態為「已送件」。
              </p>
            ) : (
              <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-0.5" aria-label="我的申請案件列表">
                {dbApplications.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs shadow-sm"
                  >
                    <p className="font-medium text-slate-800 line-clamp-2" title={row.title?.trim() || undefined}>
                      {row.title?.trim() || "（未命名計畫）"}
                    </p>
                    <p className="mt-0.5 tabular-nums text-[11px] text-slate-400">
                      {formatTaipeiDateTime(row.updatedAt)} 更新
                    </p>
                    <span className="mt-1 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                      {applicationStatusLabel(row.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          ) : (
            <div className="p-3 border-b border-slate-100 bg-slate-50/60 text-center text-[10px] text-slate-400 tracking-widest">章節</div>
          )}
          {isSidebarOpen && <div className="p-5 border-b border-slate-50"><h3 className="text-xs font-semibold text-slate-400 tracking-widest uppercase">計畫書章節</h3></div>}
          <nav className="p-2 space-y-1" aria-label="計畫書章節導覽">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => void handleTabChange(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
                aria-label={`第 ${tab.id} 章：${tab.title}`}
                className={`w-full flex items-center ${isSidebarOpen ? "justify-start gap-3 px-4" : "justify-center px-2"} py-3 text-sm rounded-xl transition-all duration-200 ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-light'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                  activeTab === tab.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                }`} aria-hidden>{tab.id}</div>
                {isSidebarOpen && tab.title}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] min-h-[70vh] flex flex-col">
          <div className="p-8 md:p-12 flex-1">
            
            {/* 只在非封面頁顯示一般標題 */}
            {activeTab !== 1 && (
               <h2 className="text-2xl font-medium tracking-wide text-slate-800 mb-8 border-b border-slate-100 pb-4">
                 {tabs.find(t => t.id === activeTab)?.title}
               </h2>
            )}

            <div
              className={`space-y-8 animate-in fade-in duration-300 ${
                isPlanLocked ? "opacity-75" : ""
              } ${isPlanLocked && activeTab !== 9 ? "pointer-events-none" : ""}`}
            >
              {showSidebarHint && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-start justify-between gap-3">
                  <p>💡 筆電使用者請注意：若覺得編輯畫面太擠，可點擊左側【收合選單】按鈕，展開全螢幕編輯體驗！</p>
                  <button
                    type="button"
                    onClick={() => setShowSidebarHint(false)}
                    className="shrink-0 text-blue-700 hover:text-blue-900 font-medium"
                    aria-label="關閉版面提示"
                  >
                    ✖ 關閉
                  </button>
                </div>
              )}
              {isPlanLocked && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  此計畫書目前為鎖定狀態（{planLockReason || "已鎖定"}），僅可檢視，不可再修改或上傳附件。
                </div>
              )}
              
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
                    <p id={coverId("project-name-label")} className="text-slate-500 font-medium tracking-[0.5em] text-xl">＜申請計畫名稱＞</p>
                    <input 
                      type="text" 
                      name="projectName" 
                      value={formData.projectName} 
                      onChange={handleInputChange} 
                      className="w-full text-center text-2xl md:text-3xl py-4 font-bold border-b-2 border-t-0 border-l-0 border-r-0 border-slate-300 rounded-none bg-transparent focus:ring-0 focus:border-blue-500 px-0 transition-colors placeholder:font-light placeholder:text-slate-300" 
                      placeholder="請填寫計畫名稱" 
                      aria-labelledby={coverId("project-name-label")}
                    />
                    <p className="text-slate-400 text-base tracking-[0.5em] mt-4">(草 案)</p>
                    <p className="text-xs text-slate-500 font-light leading-relaxed">
                      請使用「一句話看懂」的命名方式：目標客群 + 解決的問題 + 核心技術/服務（避免只有產品代號）。
                    </p>
                  </div>

                  {/* 計畫期間與公司資料 */}
                  <div className="max-w-2xl mx-auto space-y-10 w-full">
                    
                    {/* 【優化更新】計畫期間 (日曆與自動計算) */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 text-slate-700 text-lg tracking-wide w-full" role="group" aria-label="計畫執行期間">
                       <div className="flex items-center gap-2">
                         <span id={coverId("period-start-label")} className="font-medium whitespace-nowrap">計畫期間：自</span>
                         <input type="date" name="projectStartDate" value={formData.projectStartDate} onChange={handleInputChange} className="form-input py-1.5 text-center text-base w-[150px] cursor-pointer text-slate-600" aria-labelledby={coverId("period-start-label")} />
                       </div>
                       <div className="flex items-center gap-2">
                         <span id={coverId("period-end-label")} className="font-medium whitespace-nowrap">至</span>
                         <input type="date" name="projectEndDate" value={formData.projectEndDate} onChange={handleInputChange} className="form-input py-1.5 text-center text-base w-[150px] cursor-pointer text-slate-600" aria-labelledby={coverId("period-end-label")} />
                         <span className="font-medium whitespace-nowrap">止</span>
                         {formData.projectMonths ? (
                          <span className="text-slate-600 text-base font-semibold whitespace-nowrap">共 {formData.projectMonths} 個月</span>
                         ) : null}
                       </div>
                       <div className="flex items-center gap-2 mt-2 md:mt-0">
                         <span className="font-medium whitespace-nowrap">(共</span>
                         <input type="number" name="projectMonths" value={formData.projectMonths} className="form-input w-20 py-1.5 text-center text-base bg-slate-100 text-slate-500 cursor-not-allowed font-semibold" readOnly placeholder="0" aria-label="計畫總月數（自動計算）" />
                         <span className="font-medium whitespace-nowrap">個月)</span>
                       </div>
                    </div>
                    {formData.projectStartDate &&
                    formData.projectEndDate &&
                    formData.projectMonths &&
                    parseInt(formData.projectMonths, 10) > 10 ? (
                      <p className="text-center text-sm text-red-600 font-medium whitespace-pre-wrap break-words px-2">
                        已超過10個月請撰寫者重新輸入
                      </p>
                    ) : null}
                    <div className="text-center text-xs text-slate-500 font-light leading-relaxed whitespace-pre-wrap break-words">
                      計畫期間請與後續「預定進度及查核點」一致；若跨年度，仍以實際起訖日填寫（系統會自動計算月數）。
                    </div>

                    {/* 公司名稱與負責人 */}
                    <div className="space-y-6 pt-8 border-t border-slate-100">
                      <div className="flex items-center justify-center gap-4 text-lg">
                        <span id={coverId("company-name-label")} className="text-slate-700 font-medium tracking-widest w-32 text-right">公司名稱：</span>
                        <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} className="form-input w-80 py-2 text-center text-base" placeholder="申請公司全名" aria-labelledby={coverId("company-name-label")} />
                      </div>
                      <div className="flex items-center justify-center gap-4 text-lg">
                        <span id={coverId("leader-name-label")} className="text-slate-700 font-medium tracking-widest w-32 text-right">負責人：</span>
                        <input type="text" name="leaderName" value={formData.leaderName} onChange={handleInputChange} className="form-input w-80 py-2 text-center text-base" placeholder="請填寫負責人姓名" aria-labelledby={coverId("leader-name-label")} />
                      </div>
                    </div>
                    <div className="text-center text-xs text-slate-500 font-light leading-relaxed">
                      公司名稱請填公司登記全名；負責人請填公司登記負責人（後續章節會自動帶入）。
                    </div>

                    {/* 填寫日期 */}
                    <div className="mt-16 pt-12 text-center text-slate-700 font-medium text-xl tracking-[0.2em] flex items-center justify-center gap-2 flex-wrap" role="group" aria-label="計畫書填寫日期（民國）">
                       中華民國 
                       <input type="text" name="submitYear" value={formData.submitYear} onChange={handleInputChange} className="form-input inline-block w-20 py-1 text-center text-lg mx-2" aria-label="填表日期：民國年" /> 
                       年 
                       <input type="text" name="submitMonth" value={formData.submitMonth} onChange={handleInputChange} className="form-input inline-block w-16 py-1 text-center text-lg mx-2" placeholder="O" aria-label="填表日期：月" /> 
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
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-2 text-sm text-blue-700 font-light whitespace-pre-wrap break-words">
                    本摘要得於政府相關網站上公開發佈。請重點條列說明，並以1頁為原則。本摘要所有格式不得刪減、調整。
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">公司簡介</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputGroup label="(一) 公司名稱" required hint="會從封面自動帶入；請確認與公司登記全名一致。">
                        <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} className="form-input" />
                      </InputGroup>
                      <InputGroup label="(二) 設立日期（民國）" required associate="founding" hint="請以民國日期填寫（支援民國 50 年起）；後續公司概況也會同步帶入。">
                        <FoundingRocSelectors
                          value={formData.foundingDate}
                          onChange={(iso) => setFormData((prev) => ({ ...prev, foundingDate: iso }))}
                        />
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
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">二、計畫摘要 (此摘要內容屬可公開部份)</h3>
                    <InputGroup
                      label="(一) 計畫內容摘要（110字以內）"
                      required
                      hint="建議格式：目標（做什麼）→方法（怎麼做）→產出（交付物）→對象（誰受益）。避免放商業機密。"
                    >
                      <textarea name="summary" value={formData.summary} onChange={handleInputChange} className="form-textarea h-24" placeholder="請簡述計畫目標、主要工作項目等..." />
                      <p className="text-xs text-slate-400 mt-1">{Array.from(formData.summary || "").length} / 110 字</p>
                    </InputGroup>
                    <InputGroup
                      label="(二) 計畫創新重點（110字以內）"
                      required
                      hint="請聚焦 1–3 個可驗證的創新點：相較既有方案的差異、突破點、量化指標（例如效能/成本/時間）。"
                    >
                      <textarea name="innovationFocus" value={formData.innovationFocus} onChange={handleInputChange} className="form-textarea h-24" placeholder="請說明本計畫與現有技術/服務的差異與創新之處..." />
                      <p className="text-xs text-slate-400 mt-1">{Array.from(formData.innovationFocus || "").length} / 110 字</p>
                    </InputGroup>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">三、執行優勢</h3>
                    <InputGroup
                      label="請說明公司執行本計畫優勢為何？"
                      required
                      hint="建議條列：團隊能力（技術/產業）、資源（資料/設備/合作夥伴）、通路（客戶/場域）、過往成果（案例/專利/認證）。"
                    >
                      <textarea name="executionAdvantage" value={formData.executionAdvantage} onChange={handleInputChange} className="form-textarea h-24" placeholder="例如團隊技術背景、市場通路掌握度等..." />
                    </InputGroup>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-800 border-b border-slate-100 pb-2">四、預期效益 (結案三年內產出)</h3>
                    <div className="text-sm text-slate-500 mb-2 font-light whitespace-pre-wrap break-words">
                      (一) 量化效益（{formatRocDateLongFromIso(formData.projectEndDate) || "請先於封面填寫計畫期間結束日期"}結案前可產出之效益）：量化效益應客觀評估，並作為本計畫驗收成果之參考，若無請填「0」。
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l1")} className="text-sm text-slate-700 w-40 flex-shrink-0">1. 增加產值</span>
                        <input type="number" name="benefitValue" value={formData.benefitValue} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l1")} ${benefitId("u1")}`} />
                        <span id={benefitId("u1")} className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l2")} className="text-sm text-slate-700 w-40 flex-shrink-0">2. 產出新產品或服務共</span>
                        <input type="number" name="benefitNewProduct" value={formData.benefitNewProduct} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l2")} ${benefitId("u2")}`} />
                        <span id={benefitId("u2")} className="text-sm text-slate-500 w-10 flex-shrink-0">項</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l3")} className="text-sm text-slate-700 w-40 flex-shrink-0">3. 衍生商品或服務數共</span>
                        <input type="number" name="benefitDerivedProduct" value={formData.benefitDerivedProduct} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l3")} ${benefitId("u3")}`} />
                        <span id={benefitId("u3")} className="text-sm text-slate-500 w-10 flex-shrink-0">項</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l4")} className="text-sm text-slate-700 w-40 flex-shrink-0">4. 額外投入研發費用</span>
                        <input type="number" name="benefitAdditionalRnD" value={formData.benefitAdditionalRnD} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l4")} ${benefitId("u4")}`} />
                        <span id={benefitId("u4")} className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l5")} className="text-sm text-slate-700 w-40 flex-shrink-0">5. 促成投資額</span>
                        <input type="number" name="benefitInvestment" value={formData.benefitInvestment} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l5")} ${benefitId("u5")}`} />
                        <span id={benefitId("u5")} className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l6")} className="text-sm text-slate-700 w-40 flex-shrink-0">6. 降低成本</span>
                        <input type="number" name="benefitCostReduction" value={formData.benefitCostReduction} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l6")} ${benefitId("u6")}`} />
                        <span id={benefitId("u6")} className="text-sm text-slate-500 w-10 flex-shrink-0">千元</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l7")} className="text-sm text-slate-700 w-40 flex-shrink-0">7. 增加就業人數</span>
                        <input type="number" name="benefitEmployment" value={formData.benefitEmployment} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l7")} ${benefitId("u7")}`} />
                        <span id={benefitId("u7")} className="text-sm text-slate-500 w-10 flex-shrink-0">人</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l8")} className="text-sm text-slate-700 w-40 flex-shrink-0">8. 成立新公司</span>
                        <input type="number" name="benefitNewCompany" value={formData.benefitNewCompany} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l8")} ${benefitId("u8")}`} />
                        <span id={benefitId("u8")} className="text-sm text-slate-500 w-10 flex-shrink-0">家</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l9")} className="text-sm text-slate-700 w-40 flex-shrink-0">9. 發明專利共</span>
                        <input type="number" name="benefitInventionPatent" value={formData.benefitInventionPatent} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l9")} ${benefitId("u9")}`} />
                        <span id={benefitId("u9")} className="text-sm text-slate-500 w-10 flex-shrink-0">件</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span id={benefitId("l10")} className="text-sm text-slate-700 w-40 flex-shrink-0">10. 新型/新式樣專利共</span>
                        <input type="number" name="benefitUtilityPatent" value={formData.benefitUtilityPatent} onChange={handleInputChange} className="form-input py-1.5 text-right w-full" placeholder="0" aria-labelledby={`${benefitId("l10")} ${benefitId("u10")}`} />
                        <span id={benefitId("u10")} className="text-sm text-slate-500 w-10 flex-shrink-0">件</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2 font-light leading-relaxed whitespace-pre-wrap break-words">
                      ※增加產值(因本計畫產生之營業額)、額外投入研發費用(不含政府補助款與自籌款)、促成投資額(自行增資或吸引外在投資)、增加就業人數(需加保勞保，若其為計畫編列之待聘人員需聘用超過3個月)
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100">
                      <InputGroup
                        label="(二) 非量化效益（請以敘述性方式說明，例如對公司的影響等）"
                        required
                        hint="例如：建立研發制度、提升品質/交付能力、品牌信任、跨域合作、產業示範效應等（可條列）。"
                      >
                        <textarea name="qualitativeBenefits" value={formData.qualitativeBenefits} onChange={handleInputChange} className="form-textarea h-24" placeholder="請以敘述性方式說明，例如對公司的影響等..." />
                      </InputGroup>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                      填表說明：
                      {"\n"}1. 本摘要得於政府相關網站上公開發佈。
                      {"\n"}2. 請重點條列說明，並以1頁為原則。
                      {"\n"}3. 本摘要所有格式不得刪減、調整。
                      {"\n"}4. 量化效益應客觀評估，並作為本計畫驗收成果之參考，若無請填「0」。
                    </div>
                  </div>
                </div>
              )}

              {/* 第 8 頁籤 */}
              {activeTab === 8 && (
                <FileUploadUI
                  formData={formData}
                  setFormData={setFormData}
                  projectName={formData.projectName}
                  locked={isPlanLocked}
                />
              )}
              {activeTab === 9 && (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600 whitespace-pre-wrap break-words">
                    請先檢視完整計畫書 PDF，確認內容正確後再送出。
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadLastPdf}
                      disabled={!lastPdfBlob || isSaving || isPdfGenerating}
                      className="px-4 py-2 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      下載PDF檔
                    </button>
                  </div>
                  <div className="relative">
                    {previewPdfUrl ? (
                      <iframe title="計畫書預覽" src={previewPdfUrl} className="w-full h-[760px] rounded-lg border border-slate-200 bg-white" />
                    ) : (
                      <div className="h-[760px] rounded-lg border border-slate-200 bg-white flex items-center justify-center text-sm text-slate-500">
                        最新 PDF 產製中，請稍候...
                      </div>
                    )}
                    {isPdfGenerating && (
                      <div className="absolute inset-0 rounded-lg border border-slate-200 bg-white/85 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3">
                        <div
                          className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin"
                          aria-hidden
                        />
                        <p className="text-sm text-slate-700 font-medium">最新 PDF 產製中，請稍候...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 第 3 分頁載入做好的 CompanyProfileForm，其餘佔位 */}
              <>
                {activeTab === 3 && (
                  <CompanyProfileForm
                    shared={{
                      companyName: formData.companyName,
                      establishDate: formData.foundingDate,
                      representative: formData.leaderName,
                      mainBusiness: formData.mainBusinessItems,
                    }}
                    onSharedChange={(next) =>
                      setFormData((prev) => ({
                        ...prev,
                        companyName: next.companyName,
                        foundingDate: next.establishDate,
                        leaderName: next.representative,
                        mainBusinessItems: next.mainBusiness,
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
                {activeTab === 6 &&
                  (draftLoaded ? (
                    <ScheduleCheckpointsForm
                      draftHydrated={draftLoaded}
                      projectStartDate={formData.projectStartDate}
                      projectEndDate={formData.projectEndDate}
                      boundWorkItems={scheduleBoundWorkItems}
                      value={formData.scheduleCheckpoints || undefined}
                      onChange={(next) => setFormData((p) => ({ ...p, scheduleCheckpoints: next }))}
                    />
                  ) : (
                    <div className="py-16 text-center text-slate-500 text-sm">載入草稿中，請稍候…</div>
                  ))}
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
              type="button"
              onClick={() => void handleSaveDraft({ autoDownload: true })}
              disabled={isSaving || isSubmitting || isPdfGenerating || formSaveBlocked || isPlanLocked}
              className="flex items-center gap-2 px-6 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium text-sm shadow-sm disabled:opacity-60 disabled:pointer-events-none"
            >
              <Save size={16} className={isSaving ? 'animate-pulse' : ''} aria-hidden />
              {isSaving ? '儲存中...' : '儲存草稿'}
            </button>
            
            <div className="flex items-center gap-3">
              {activeTab === 8 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab((prev) => Math.max(1, prev - 1))}
                    disabled={isSaving || isSubmitting || isPlanLocked}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                  >
                    上一步
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleNext()}
                    disabled={isSaving || isSubmitting || isPlanLocked}
                    className="flex items-center gap-2 px-8 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                  >
                    下一步
                    <ChevronRight size={16} aria-hidden />
                  </button>
                </>
              )}
              {activeTab !== 8 && activeTab !== 9 && (
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  disabled={isSaving || isSubmitting || isPlanLocked}
                  className="flex items-center gap-2 px-8 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                >
                  儲存並前往下一步
                  <ChevronRight size={16} aria-hidden />
                </button>
              )}
              {activeTab === 9 && (
                <button
                  type="button"
                  onClick={() => void handleSubmitToDrive()}
                  disabled={isSaving || isSubmitting || isPdfGenerating || formSaveBlocked || isPlanLocked}
                  className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                >
                  {isSubmitting ? "送出中..." : "確認完成送出計畫書"}
                </button>
              )}
            </div>
          </div>

          <div className="px-6 pb-4 text-center text-sm text-gray-500">
            Copyright &copy; {getTaipeiFullYear()} 嘉澄股份有限公司 版權所有 <span className="mx-2">|</span> 連絡電話：(04)2326-8281
            <span className="mx-2">|</span>
            <Link href="/privacy" className="hover:text-slate-700 underline-offset-2 hover:underline">隱私權政策</Link>
            <span className="mx-2">|</span>
            <Link href="/terms" className="hover:text-slate-700 underline-offset-2 hover:underline">服務條款</Link>
          </div>

        </main>
      </div>

      {statusToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-lg" role="status" aria-live="polite">
          {statusToast}
        </div>
      )}

      <footer className="w-full py-6 mt-auto text-center text-sm text-gray-500">
        <p>
          Copyright &copy; {getTaipeiFullYear()} 嘉澄股份有限公司 版權所有 <span className="mx-2">|</span> 連絡電話：(04)2326-8281
          <span className="mx-2">|</span>
          <Link href="/privacy" className="hover:text-slate-700 underline-offset-2 hover:underline">隱私權政策</Link>
          <span className="mx-2">|</span>
          <Link href="/terms" className="hover:text-slate-700 underline-offset-2 hover:underline">服務條款</Link>
        </p>
      </footer>

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

// 輔助表單元件：欄位群組（label 與第一個可填控制項以 htmlFor/id 或 group labelledby 關聯）
function InputGroup({
  label,
  required,
  hint,
  children,
  associate,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  associate?: "founding";
}) {
  const controlId = React.useId();
  const foundingLabelId = React.useId();

  const body = React.Children.map(children, (child, index) => {
    if (index !== 0 || !React.isValidElement(child)) return child;
    if (associate === "founding") {
      return React.cloneElement(child as React.ReactElement<{ labelledBy?: string }>, {
        labelledBy: foundingLabelId,
      });
    }
    const el = child as React.ReactElement<{ id?: string }>;
    if (typeof el.type === "string" && ["input", "textarea", "select"].includes(el.type)) {
      return React.cloneElement(el, { id: controlId });
    }
    return child;
  });

  return (
    <div className="space-y-2">
      {associate === "founding" ? (
        <div id={foundingLabelId} className="block text-sm font-medium text-slate-700 tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </div>
      ) : (
        <label htmlFor={controlId} className="block text-sm font-medium text-slate-700 tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {hint && <div className="text-xs text-slate-500 font-light leading-relaxed whitespace-pre-wrap break-words">{hint}</div>}
      {body}
    </div>
  );
}

// 輔助表單元件：附件上傳區塊
function FileUploadUI({
  formData,
  setFormData,
  projectName,
  locked,
}: {
  formData: ApplicationFormData;
  setFormData: React.Dispatch<React.SetStateAction<ApplicationFormData>>;
  projectName: string;
  locked: boolean;
}) {
  type AttachmentKey = "a1" | "a2" | "a3" | "a4" | "a5";
  const [uploadingIds, setUploadingIds] = useState(() => new Set<string>());
  const MAX_BYTES = 10 * 1024 * 1024;
  const attachmentDescriptions: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "附件一、委外或技術合作/引進合約書",
    2: "附件二、聘任顧問及國內外專家背景說明/合約書/原任職單位同意函",
    3: "附件三、與本案相關專利證書或申請中專利文件",
    4: "附件四、其他參考資料(如：相關產品型錄或國外技轉公司背景資料等)",
    5: "附件五、申請本計畫相關登記證件、切結書及其他相關附件",
  };

  const uploadOne = async (file: File, localId: string) => {
    if (locked) return false;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("filename", file.name);
    fd.append("projectName", projectName || "未命名計畫");

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const err = data?.error || "Upload failed";
      const hint = data?.hint ? `（${data.hint}）` : "";
      setFormData((prev) => ({
        ...prev,
        files: prev.files.map((f) => (f.id === localId ? { ...f, status: "error", error: `${err}${hint}` } : f)),
      }));
      return false;
    }

    setFormData((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === localId ? { ...f, status: "uploaded", drive: data.file } : f)),
    }));
    return true;
  };

  const getSlotFiles = (slot: 1 | 2 | 3 | 4 | 5) => formData.files.filter((f) => f.attachmentIndex === slot);

  const toggleChecked = (slot: 1 | 2 | 3 | 4 | 5, checked: boolean) => {
    const key = `a${slot}` as AttachmentKey;
    setFormData((prev) => ({ ...prev, attachmentChecks: { ...prev.attachmentChecks, [key]: checked } }));
  };

  const setSlotFiles = async (slot: 1 | 2 | 3 | 4 | 5, files: FileList | null) => {
    if (locked) return;
    if (!files || files.length === 0) {
      return;
    }
    const list = Array.from(files);
    for (const file of list) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf || file.size > MAX_BYTES) {
        const id = Math.random().toString(36).slice(2, 10);
        const reason = !isPdf ? "檔案格式限定為 PDF。" : "單一檔案大小請勿超過 10MB。";
        setFormData((prev) => ({
          ...prev,
          files: [
            ...prev.files,
            {
              id,
              name: file.name,
              size: (file.size / 1024 / 1024).toFixed(2) + " MB",
              status: "error",
              drive: null,
              error: reason,
              attachmentIndex: slot,
            },
          ],
        }));
        continue;
      }

      const localId = Math.random().toString(36).slice(2, 10);
      setFormData((prev) => ({
        ...prev,
        files: [
          ...prev.files,
          {
            id: localId,
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + " MB",
            status: "uploading",
            drive: null,
            error: null,
            attachmentIndex: slot,
          },
        ],
      }));
      setUploadingIds((prev) => new Set([...Array.from(prev), localId]));
      await uploadOne(file, localId);
      setUploadingIds((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  const removeFile = (id: string) => {
    if (locked) return;
    setFormData((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== id) }));
  };

  const renderSlot = (slot: 1 | 2 | 3 | 4 | 5) => {
    const key = `a${slot}` as AttachmentKey;
    const checked = formData.attachmentChecks[key];
    const slotFiles = getSlotFiles(slot);
    const slotDesc = attachmentDescriptions[slot];

    return (
      <div key={slot} className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            disabled={locked}
            onChange={(e) => toggleChecked(slot, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
          />
          <span className="text-sm font-medium text-slate-700">{slotDesc}</span>
        </label>

        <div className="relative w-full p-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50">
          <UploadCloud size={36} className="mb-2 text-slate-400" />
          <p className="text-sm text-slate-700 font-medium">附件{slot}（PDF）上傳</p>
          <p className="text-xs text-slate-400">檔案格式：PDF；大小限制：10MB</p>
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={locked}
            aria-label={`${slotDesc}：上傳 PDF（可多檔）`}
            onChange={(e) => {
              void setSlotFiles(slot, e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {slotFiles.length > 0 && (
          <div className="space-y-2 pt-1">
            {slotFiles.map((slotFile) => (
              <div key={slotFile.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{slotFile.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {slotFile.size}
                    {slotFile.status === "uploading" && <span className="ml-2 text-blue-600">上傳中...</span>}
                    {slotFile.status === "uploaded" && slotFile.drive?.webViewLink && (
                      <a className="ml-2 text-blue-600 hover:underline" href={slotFile.drive.webViewLink} target="_blank" rel="noreferrer">
                        Drive 連結
                      </a>
                    )}
                    {slotFile.status === "error" && <span className="ml-2 text-red-600">上傳失敗</span>}
                  </p>
                  {slotFile.status === "error" && slotFile.error && (
                    <p className="text-[11px] text-red-600 mt-1">{String(slotFile.error)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(slotFile.id)}
                  disabled={locked || (slotFile.status === "uploading" && uploadingIds.has(slotFile.id))}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label={`移除附件檔案：${slotFile.name}`}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
        <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 font-light leading-relaxed">
          <p className="font-medium mb-1">附件填寫提醒：</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>若確實要檢附該附件，請先勾選後再上傳 PDF。</li>
            <li>每個附件檔案僅限 PDF，且單一檔案大小請勿超過 10MB。</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        {renderSlot(1)}
        {renderSlot(2)}
        {renderSlot(3)}
        {renderSlot(4)}
        {renderSlot(5)}
      </div>
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