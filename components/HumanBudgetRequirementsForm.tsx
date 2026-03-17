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

type TeamRow = {
  no: string;
  name: string;
  title: string;
  education: string;
  experience: string;
  achievements: string;
  years: string;
  tasks: string;
  months: string;
};

type ManpowerStatRow = {
  company: string;
  phd: string;
  master: string;
  bachelor: string;
  junior: string;
  male: string;
  female: string;
  avgAge: string;
  avgYears: string;
  toHire: string;
};

type BudgetRow = {
  subject: string;
  item: string;
  gov: string;
  self: string;
  total: string;
  ratio: string;
};

type PersonnelCostRow = {
  name: string;
  avgSalary: string;
  manMonths: string;
  cost: string;
};

type ConsumableRow = {
  item: string;
  unit: string;
  qty: string;
  price: string;
  total: string;
};

type EquipmentRow = {
  name: string;
  assetId: string;
  valueA: string;
  countB: string;
  remainingYears: string;
  monthlyFee: string;
  months: string;
  total: string;
};

export type HumanBudgetDraft = {
  govAllocPct: Record<string, string>;
  piProfile: typeof piProfileInit;
  piEducation: Array<{ school: string; time: string; degree: string; dept: string }>;
  piExperience: Array<{ org: string; time: string; dept: string; title: string }>;
  piProjects: Array<{ org: string; time: string; name: string; task: string }>;
  team: TeamRow[];
  manpowerStats: ManpowerStatRow[];
  budgetRows: BudgetRow[];
  personnelCosts: PersonnelCostRow[];
  consultantCosts: PersonnelCostRow[];
  consumables: ConsumableRow[];
  equipments: { existing: EquipmentRow[]; new: EquipmentRow[] };
};

const piProfileInit = {
  name: "",
  salutation: "先生",
  id: "",
  birth: "",
  applicant: "",
  title: "",
  outsideYears: "",
  insideYears: "",
  field: "",
  achievements: "",
};

export default function HumanBudgetRequirementsForm({
  companyName,
  value,
  onChange,
}: {
  companyName: string;
  value?: HumanBudgetDraft;
  onChange?: (next: HumanBudgetDraft) => void;
}) {
  const toNum = (v: string) => {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toString() : "0");
  const fmtPct = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "0.0");

  const [govAllocPct, setGovAllocPct] = useState<Record<string, string>>({
    personnel: "50",
    consultant: "50",
    consumables: "50",
    equipUse: "50",
  });

  const [piProfile, setPiProfile] = useState(piProfileInit);

  const [piEducation, setPiEducation] = useState([{ school: "", time: "", degree: "", dept: "" }]);
  const [piExperience, setPiExperience] = useState([{ org: "", time: "", dept: "", title: "" }]);
  const [piProjects, setPiProjects] = useState([{ org: "", time: "", name: "", task: "" }]);

  const [team, setTeam] = useState<TeamRow[]>(
    Array.from({ length: 4 }).map((_, i) => ({
      no: String(i + 1),
      name: "",
      title: "",
      education: "",
      experience: "",
      achievements: "",
      years: "",
      tasks: "",
      months: "",
    }))
  );

  const [manpowerStats, setManpowerStats] = useState<ManpowerStatRow[]>([
    {
      company: "",
      phd: "",
      master: "",
      bachelor: "",
      junior: "",
      male: "",
      female: "",
      avgAge: "",
      avgYears: "",
      toHire: "",
    },
  ]);

  const budgetTemplate = useMemo<BudgetRow[]>(
    () => [
      { subject: "1. 人事費", item: "計畫人員", gov: "", self: "", total: "", ratio: "" },
      { subject: "1. 人事費", item: "顧問", gov: "", self: "", total: "", ratio: "" },
      { subject: "1. 人事費", item: "小計", gov: "", self: "", total: "", ratio: "" },
      { subject: "2. 消耗性器材及原材料費", item: "2. 消耗性器材及原材料費", gov: "", self: "", total: "", ratio: "" },
      { subject: "3. 研發設備使用費", item: "3. 研發設備使用費", gov: "", self: "", total: "", ratio: "" },
      { subject: "4. 研發設備維護費", item: "4. 研發設備維護費", gov: "", self: "", total: "", ratio: "" },
      { subject: "5. 技術移轉費", item: "(1) 技術或智慧財產權購買費", gov: "", self: "", total: "", ratio: "" },
      { subject: "5. 技術移轉費", item: "(2) 委託研究費", gov: "", self: "", total: "", ratio: "" },
      { subject: "5. 技術移轉費", item: "(3) 委託勞務費", gov: "", self: "", total: "", ratio: "" },
      { subject: "5. 技術移轉費", item: "小計", gov: "", self: "", total: "", ratio: "" },
      { subject: "合計", item: "合計", gov: "", self: "", total: "", ratio: "" },
      { subject: "百分比", item: "百分比", gov: "", self: "", total: "", ratio: "100%" },
    ],
    []
  );
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>(budgetTemplate);

  const [personnelCosts, setPersonnelCosts] = useState<PersonnelCostRow[]>([
    { name: "", avgSalary: "", manMonths: "", cost: "" },
    { name: "", avgSalary: "", manMonths: "", cost: "" },
  ]);

  const [consultantCosts, setConsultantCosts] = useState<PersonnelCostRow[]>([{ name: "", avgSalary: "", manMonths: "", cost: "" }]);

  const [consumables, setConsumables] = useState<ConsumableRow[]>([
    { item: "", unit: "", qty: "", price: "", total: "" },
    { item: "", unit: "", qty: "", price: "", total: "" },
  ]);

  const [equipments, setEquipments] = useState({
    existing: [{ name: "一、已有設備", assetId: "", valueA: "", countB: "", remainingYears: "", monthlyFee: "", months: "", total: "" } satisfies EquipmentRow],
    new: [{ name: "二、計畫新增設備", assetId: "", valueA: "", countB: "", remainingYears: "", monthlyFee: "", months: "", total: "" } satisfies EquipmentRow],
  });

  useEffect(() => {
    if (!value) return;
    setGovAllocPct(value.govAllocPct);
    setPiProfile(value.piProfile);
    setPiEducation(value.piEducation);
    setPiExperience(value.piExperience);
    setPiProjects(value.piProjects);
    setTeam(value.team);
    setManpowerStats(value.manpowerStats);
    setBudgetRows(value.budgetRows);
    setPersonnelCosts(value.personnelCosts);
    setConsultantCosts(value.consultantCosts);
    setConsumables(value.consumables);
    setEquipments(value.equipments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!onChange) return;
    onChange({
      govAllocPct,
      piProfile,
      piEducation,
      piExperience,
      piProjects,
      team,
      manpowerStats,
      budgetRows,
      personnelCosts,
      consultantCosts,
      consumables,
      equipments,
    });
  }, [
    govAllocPct,
    piProfile,
    piEducation,
    piExperience,
    piProjects,
    team,
    manpowerStats,
    budgetRows,
    personnelCosts,
    consultantCosts,
    consumables,
    equipments,
    onChange,
  ]);

  // ---------- 自動計算：人事費明細 ----------
  const personnelComputed = personnelCosts.map((r) => ({
    ...r,
    costNum: toNum(r.avgSalary) * toNum(r.manMonths),
  }));
  const personnelManMonthsSum = personnelComputed.reduce((acc, r) => acc + toNum(r.manMonths), 0);
  const personnelCostSum = personnelComputed.reduce((acc, r) => acc + r.costNum, 0);

  const consultantComputed = consultantCosts.map((r) => ({
    ...r,
    costNum: toNum(r.avgSalary) * toNum(r.manMonths),
  }));
  const consultantManMonthsSum = consultantComputed.reduce((acc, r) => acc + toNum(r.manMonths), 0);
  const consultantCostSum = consultantComputed.reduce((acc, r) => acc + r.costNum, 0);

  // ---------- 自動計算：消耗性器材 ----------
  const consumablesComputed = consumables.map((r) => ({
    ...r,
    totalNum: toNum(r.qty) * toNum(r.price),
  }));
  const consumablesSum = consumablesComputed.reduce((acc, r) => acc + r.totalNum, 0);

  // ---------- 自動計算：設備使用費 ----------
  const computeExistingMonthlyFee = (r: EquipmentRow) => {
    const A = toNum(r.valueA);
    const B = toNum(r.countB);
    const years = toNum(r.remainingYears);
    if (A <= 0 || B <= 0 || years <= 0) return 0;
    return (A * B) / (years * 12);
  };
  const computeNewMonthlyFee = (r: EquipmentRow) => {
    const A = toNum(r.valueA);
    const B = toNum(r.countB);
    if (A <= 0 || B <= 0) return 0;
    return (A * B) / 60;
  };
  const equipmentsExistingComputed = equipments.existing.map((r) => {
    const monthly = computeExistingMonthlyFee(r);
    const total = monthly * toNum(r.months);
    return { ...r, monthlyNum: monthly, totalNum: total };
  });
  const equipmentsNewComputed = equipments.new.map((r) => {
    const monthly = computeNewMonthlyFee(r);
    const total = monthly * toNum(r.months);
    return { ...r, monthlyNum: monthly, totalNum: total };
  });
  const equipmentsExistingSum = equipmentsExistingComputed.reduce((acc, r) => acc + r.totalNum, 0);
  const equipmentsNewSum = equipmentsNewComputed.reduce((acc, r) => acc + r.totalNum, 0);

  // ---------- 自動計算：經費需求總表 ----------
  const idxPersonnel = budgetRows.findIndex((r) => r.subject === "1. 人事費" && r.item === "計畫人員");
  const idxConsultant = budgetRows.findIndex((r) => r.subject === "1. 人事費" && r.item === "顧問");

  const idxConsumables = budgetRows.findIndex((r) => r.subject.startsWith("2.") && r.item.startsWith("2."));
  const idxEquipUse = budgetRows.findIndex((r) => r.subject.startsWith("3.") && r.item.startsWith("3."));
  const idxEquipMaintain = budgetRows.findIndex((r) => r.subject.startsWith("4.") && r.item.startsWith("4."));

  const idxTechBuy = budgetRows.findIndex((r) => r.subject.startsWith("5.") && r.item.includes("購買費"));
  const idxTechResearch = budgetRows.findIndex((r) => r.subject.startsWith("5.") && r.item.includes("委託研究費"));
  const idxTechService = budgetRows.findIndex((r) => r.subject.startsWith("5.") && r.item.includes("委託勞務費"));

  const isSubtotalRow = (r: BudgetRow) =>
    (r.subject === "1. 人事費" && r.item === "小計") || (r.subject.startsWith("5.") && r.item === "小計");
  const isGrandTotalRow = (r: BudgetRow) => r.subject === "合計" && r.item === "合計";
  const isPercentRow = (r: BudgetRow) => r.subject === "百分比" && r.item === "百分比";

  const getGovSelf = (idx: number) => {
    if (idx < 0) return { gov: 0, self: 0 };
    return { gov: toNum(budgetRows[idx].gov), self: toNum(budgetRows[idx].self) };
  };

  // （二）人事費明細合計（用於回填到（ㄧ））
  const personnelTotal = Math.round(personnelCostSum);
  const consultantTotal = Math.round(consultantCostSum);

  // （三）消耗性器材合計（用於回填到（ㄧ））
  const consumablesTotal = Math.round(consumablesSum);

  // （四）設備使用費合計（用於回填到（ㄧ））
  const equipUseTotal = Math.round(equipmentsExistingSum + equipmentsNewSum);

  const personnelSum = (() => {
    // 回填到（ㄧ）時：gov 可填，self 自動補足 = total - gov
    const aGov = toNum(budgetRows[idxPersonnel]?.gov ?? "");
    const bGov = toNum(budgetRows[idxConsultant]?.gov ?? "");
    const aSelf = Math.max(0, personnelTotal - aGov);
    const bSelf = Math.max(0, consultantTotal - bGov);
    return { gov: aGov + bGov, self: aSelf + bSelf, total: personnelTotal + consultantTotal };
  })();
  const techSum = (() => {
    const a = getGovSelf(idxTechBuy);
    const b = getGovSelf(idxTechResearch);
    const c = getGovSelf(idxTechService);
    return { gov: a.gov + b.gov + c.gov, self: a.self + b.self + c.self };
  })();

  const getRowGovSelf = (idx: number) => {
    const r = budgetRows[idx];
    if (!r) return { gov: 0, self: 0, total: 0 };

    const pct = (key: keyof typeof govAllocPct) => {
      const n = toNum(govAllocPct[key]);
      return Math.min(100, Math.max(0, n));
    };

    // 回填控制：人事費（計畫人員/顧問）、消耗性器材、研發設備使用費 → gov/self 依分攤比例自動帶入
    if (idx === idxPersonnel) {
      const gov = Math.round(personnelTotal * (pct("personnel") / 100));
      return { gov, self: Math.max(0, personnelTotal - gov), total: personnelTotal };
    }
    if (idx === idxConsultant) {
      const gov = Math.round(consultantTotal * (pct("consultant") / 100));
      return { gov, self: Math.max(0, consultantTotal - gov), total: consultantTotal };
    }
    if (idx === idxConsumables) {
      const gov = Math.round(consumablesTotal * (pct("consumables") / 100));
      return { gov, self: Math.max(0, consumablesTotal - gov), total: consumablesTotal };
    }
    if (idx === idxEquipUse) {
      const gov = Math.round(equipUseTotal * (pct("equipUse") / 100));
      return { gov, self: Math.max(0, equipUseTotal - gov), total: equipUseTotal };
    }

    const gov = toNum(r.gov);
    const self = toNum(r.self);
    return { gov, self, total: gov + self };
  };

  const leafIdxs = [idxPersonnel, idxConsultant, idxConsumables, idxEquipUse, idxEquipMaintain, idxTechBuy, idxTechResearch, idxTechService].filter((i) => i >= 0);
  const leaf = leafIdxs.map((i) => getRowGovSelf(i));
  const grandGov = leaf.reduce((acc, r) => acc + r.gov, 0);
  const grandSelf = leaf.reduce((acc, r) => acc + r.self, 0);
  const grandTotal = leaf.reduce((acc, r) => acc + r.total, 0);

  const getComputedBudgetCell = (row: BudgetRow, key: keyof Pick<BudgetRow, "gov" | "self" | "total" | "ratio">) => {
    if (isPercentRow(row)) {
      if (key === "gov") return grandTotal > 0 ? fmtPct((grandGov / grandTotal) * 100) : "0.0";
      if (key === "self") return grandTotal > 0 ? fmtPct((grandSelf / grandTotal) * 100) : "0.0";
      if (key === "total") return "100.0";
      return "100%";
    }

    if (isSubtotalRow(row)) {
      if (row.subject === "1. 人事費") {
        if (key === "gov") return fmtInt(personnelSum.gov);
        if (key === "self") return fmtInt(personnelSum.self);
        if (key === "total") return fmtInt(personnelSum.total);
        return grandTotal > 0 ? fmtPct((personnelSum.total / grandTotal) * 100) : "0.0";
      }
      // 技術移轉小計
      const s = techSum;
      if (key === "gov") return fmtInt(s.gov);
      if (key === "self") return fmtInt(s.self);
      if (key === "total") return fmtInt(s.gov + s.self);
      return grandTotal > 0 ? fmtPct(((s.gov + s.self) / grandTotal) * 100) : "0.0";
    }

    if (isGrandTotalRow(row)) {
      if (key === "gov") return fmtInt(grandGov);
      if (key === "self") return fmtInt(grandSelf);
      if (key === "total") return fmtInt(grandTotal);
      return grandTotal > 0 ? "100.0" : "0.0";
    }

    // 明細回填列：total 鎖定為明細合計，self 自動補足
    const idx = budgetRows.indexOf(row);
    const computed = getRowGovSelf(idx);
    if (key === "gov") {
      if (idx === idxPersonnel || idx === idxConsultant || idx === idxConsumables || idx === idxEquipUse) return fmtInt(computed.gov);
      return row.gov;
    }
    if (key === "self") {
      if (idx === idxPersonnel || idx === idxConsultant || idx === idxConsumables || idx === idxEquipUse) return fmtInt(computed.self);
      return row.self;
    }
    if (key === "total") return fmtInt(computed.total);
    return grandTotal > 0 ? fmtPct((computed.total / grandTotal) * 100) : "0.0";
  };

  return (
    <div className="bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-800 text-white px-8 py-6">
          <h1 className="text-2xl font-semibold tracking-wider">伍、人力及經費需求表</h1>
          <p className="text-gray-300 text-sm mt-2">請依計畫內容與預定進度填寫人力配置與經費預算。</p>
        </div>

        <div className="p-8">
          <section className="mb-12">
            <SectionTitle>一、計畫人員簡歷表</SectionTitle>
            <div className="mb-6">
              <Label>公司名稱</Label>
              <Hint>由封面自動帶入（唯讀）。若封面公司名稱有誤，請回到第 1 章節修正。</Hint>
              <input
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                value={companyName}
                readOnly
                placeholder="（由封面自動帶入）"
              />
            </div>

            <SubTitle>（一）計畫主持人資歷說明</SubTitle>
            <Hint>請填計畫主持人（通常為負責人或計畫負責主管）。建議條列可驗證的代表成就與相關領域經驗。</Hint>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-gray-50/50 p-6 rounded-lg border border-gray-100">
              <div>
                <Label required>姓名</Label>
                <input
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.name}
                  onChange={(e) => setPiProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="請填寫主持人姓名"
                />
              </div>
              <div>
                <Label>稱謂</Label>
                <div className="flex gap-6 items-center mt-2">
                  {["先生", "女士", "其他"].map((v) => (
                    <label key={v} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="piSalutation"
                        value={v}
                        checked={piProfile.salutation === v}
                        onChange={() => setPiProfile((p) => ({ ...p, salutation: v }))}
                        className="w-4 h-4 text-gray-600 focus:ring-gray-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>身分證字號</Label>
                <input
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.id}
                  onChange={(e) => setPiProfile((p) => ({ ...p, id: e.target.value }))}
                  placeholder="例如：A123456789"
                />
              </div>
              <div>
                <Label>出生年月日</Label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.birth}
                  onChange={(e) => setPiProfile((p) => ({ ...p, birth: e.target.value }))}
                />
              </div>
              <div>
                <Label>申請人名稱</Label>
                <input
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.applicant}
                  onChange={(e) => setPiProfile((p) => ({ ...p, applicant: e.target.value }))}
                  placeholder="公司/單位名稱"
                />
              </div>
              <div>
                <Label>職稱</Label>
                <input
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.title}
                  onChange={(e) => setPiProfile((p) => ({ ...p, title: e.target.value }))}
                  placeholder="例如：總經理 / 技術長 / PM"
                />
              </div>
              <div>
                <Label>單位外年資（年）</Label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.outsideYears}
                  onChange={(e) => setPiProfile((p) => ({ ...p, outsideYears: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>單位年資（年）</Label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.insideYears}
                  onChange={(e) => setPiProfile((p) => ({ ...p, insideYears: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="md:col-span-2">
                <Label>專業領域</Label>
                <input
                  className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white"
                  value={piProfile.field}
                  onChange={(e) => setPiProfile((p) => ({ ...p, field: e.target.value }))}
                  placeholder="例如：AI/資安/製造/電商/IoT..."
                />
              </div>
              <div className="md:col-span-2">
                <Label>重要成就</Label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white min-h-[120px] resize-y"
                  value={piProfile.achievements}
                  onChange={(e) => setPiProfile((p) => ({ ...p, achievements: e.target.value }))}
                  placeholder="請條列：重要專案、專利、獎項、發表、量化績效等。"
                />
              </div>
            </div>

            <SubTitle>學歷（大專以上）</SubTitle>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[900px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-16">類別</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">學校（大專以上）</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">時間</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-24">學位</th>
                    <th className="px-4 py-3 border-b border-gray-200">科系</th>
                  </tr>
                </thead>
                <tbody>
                  {piEducation.map((r, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200 font-medium text-gray-700">學歷</td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.school}
                          onChange={(e) => {
                            const next = [...piEducation];
                            next[idx] = { ...next[idx], school: e.target.value };
                            setPiEducation(next);
                          }}
                          placeholder="例如：國立XX大學"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={r.time}
                          onChange={(e) => {
                            const next = [...piEducation];
                            next[idx] = { ...next[idx], time: e.target.value };
                            setPiEducation(next);
                          }}
                          placeholder="YY/MM"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={r.degree}
                          onChange={(e) => {
                            const next = [...piEducation];
                            next[idx] = { ...next[idx], degree: e.target.value };
                            setPiEducation(next);
                          }}
                          placeholder="學士/碩士/博士"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.dept}
                          onChange={(e) => {
                            const next = [...piEducation];
                            next[idx] = { ...next[idx], dept: e.target.value };
                            setPiEducation(next);
                          }}
                          placeholder="例如：資工系"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setPiEducation((p) => [...p, { school: "", time: "", degree: "", dept: "" }])}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增一列
            </button>

            <SubTitle>經歷</SubTitle>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[900px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-16">類別</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">事業單位</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">時間</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">部門</th>
                    <th className="px-4 py-3 border-b border-gray-200">職稱</th>
                  </tr>
                </thead>
                <tbody>
                  {piExperience.map((r, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200 font-medium text-gray-700">經歷</td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.org}
                          onChange={(e) => {
                            const next = [...piExperience];
                            next[idx] = { ...next[idx], org: e.target.value };
                            setPiExperience(next);
                          }}
                          placeholder="例如：XX股份有限公司"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={r.time}
                          onChange={(e) => {
                            const next = [...piExperience];
                            next[idx] = { ...next[idx], time: e.target.value };
                            setPiExperience(next);
                          }}
                          placeholder="YY/MM"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.dept}
                          onChange={(e) => {
                            const next = [...piExperience];
                            next[idx] = { ...next[idx], dept: e.target.value };
                            setPiExperience(next);
                          }}
                          placeholder="例如：研發部"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.title}
                          onChange={(e) => {
                            const next = [...piExperience];
                            next[idx] = { ...next[idx], title: e.target.value };
                            setPiExperience(next);
                          }}
                          placeholder="例如：工程師/主管"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setPiExperience((p) => [...p, { org: "", time: "", dept: "", title: "" }])}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增一列
            </button>

            <SubTitle>曾參與計畫（無可免填）</SubTitle>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[980px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-40">事業單位</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">時間</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">計畫名稱</th>
                    <th className="px-4 py-3 border-b border-gray-200">主要任務</th>
                  </tr>
                </thead>
                <tbody>
                  {piProjects.map((r, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.org}
                          onChange={(e) => {
                            const next = [...piProjects];
                            next[idx] = { ...next[idx], org: e.target.value };
                            setPiProjects(next);
                          }}
                          placeholder="例如：主辦/協辦單位"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1 text-center"
                          value={r.time}
                          onChange={(e) => {
                            const next = [...piProjects];
                            next[idx] = { ...next[idx], time: e.target.value };
                            setPiProjects(next);
                          }}
                          placeholder="YY/MM"
                        />
                      </td>
                      <td className="p-2 border-r border-gray-200">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.name}
                          onChange={(e) => {
                            const next = [...piProjects];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setPiProjects(next);
                          }}
                          placeholder="計畫名稱"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full bg-transparent outline-none px-2 py-1"
                          value={r.task}
                          onChange={(e) => {
                            const next = [...piProjects];
                            next[idx] = { ...next[idx], task: e.target.value };
                            setPiProjects(next);
                          }}
                          placeholder="例如：技術負責/系統設計/測試驗證"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setPiProjects((p) => [...p, { org: "", time: "", name: "", task: "" }])}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增一列
            </button>

            <SubTitle>（二）參與計畫研究發展人員資歷說明</SubTitle>
            <Hint>請將人員投入工作項目（A1/A2…）與「預定進度表/查核點」對齊，避免後續審查時不一致。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1100px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-16">編號</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">姓名</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">職稱</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">最高學歷（學校系所）</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">主要經歷（公司名稱/時間）</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">主要重要成就</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-24">本業年資</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">參與分項計畫及工作項目</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-24">投入月數</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((r, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200 font-medium text-gray-700">{r.no || idx + 1}</td>
                      {(
                        [
                          ["name", "姓名（必填）"],
                          ["title", "職稱"],
                          ["education", "例如：XX大學資工系 碩士"],
                          ["experience", "例如：XX公司/5年"],
                          ["achievements", "例如：專利/獎項/代表作"],
                          ["years", "0"],
                          ["tasks", "例如：A1 需求分析、B2 測試"],
                          ["months", "0"],
                        ] as const
                      ).map(([k, ph], cIdx) => (
                        <td key={k} className={`p-2 ${cIdx < 7 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${k === "months" || k === "years" ? "text-right" : ""}`}
                            value={r[k]}
                            onChange={(e) => {
                              const next = [...team];
                              next[idx] = { ...next[idx], [k]: e.target.value } as TeamRow;
                              setTeam(next);
                            }}
                            placeholder={ph}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200">總計</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-gray-500" colSpan={7}>
                      （可依需要新增列）
                    </td>
                    <td className="px-4 py-3 text-right">
                      {team.reduce((acc, r) => acc + (Number(r.months) || 0), 0).toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                setTeam((p) => [
                  ...p,
                  {
                    no: String(p.length + 1),
                    name: "",
                    title: "",
                    education: "",
                    experience: "",
                    achievements: "",
                    years: "",
                    tasks: "",
                    months: "",
                  },
                ])
              }
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增一列
            </button>

            <SubTitle>（四）計畫人力統計（不含兼職顧問）</SubTitle>
            <Hint>待聘人數建議控制在投入計畫人力的 30% 以內（依申請須知原則）。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1100px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-40">公司名稱</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">博士</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">碩士</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">學士</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">專科(含)以下</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">男性</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">女性</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">平均年齡</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">平均年資</th>
                    <th className="px-4 py-3 border-b border-gray-200">待聘人數</th>
                  </tr>
                </thead>
                <tbody>
                  {manpowerStats.map((r, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      {(
                        [
                          ["company", "公司名稱"],
                          ["phd", "0"],
                          ["master", "0"],
                          ["bachelor", "0"],
                          ["junior", "0"],
                          ["male", "0"],
                          ["female", "0"],
                          ["avgAge", "0"],
                          ["avgYears", "0"],
                          ["toHire", "0"],
                        ] as const
                      ).map(([k, ph], cIdx) => (
                        <td key={k} className={`p-2 ${cIdx < 9 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${k !== "company" ? "text-right" : ""}`}
                            value={r[k]}
                            onChange={(e) => {
                              const next = [...manpowerStats];
                              next[idx] = { ...next[idx], [k]: e.target.value } as ManpowerStatRow;
                              setManpowerStats(next);
                            }}
                            placeholder={ph}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200">總計</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{manpowerStats.reduce((a, r) => a + (Number(r.phd) || 0), 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{manpowerStats.reduce((a, r) => a + (Number(r.master) || 0), 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{manpowerStats.reduce((a, r) => a + (Number(r.bachelor) || 0), 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{manpowerStats.reduce((a, r) => a + (Number(r.junior) || 0), 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{manpowerStats.reduce((a, r) => a + (Number(r.male) || 0), 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right">{manpowerStats.reduce((a, r) => a + (Number(r.female) || 0), 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right text-gray-500">—</td>
                    <td className="px-4 py-3 border-r border-gray-200 text-right text-gray-500">—</td>
                    <td className="px-4 py-3 text-right">{manpowerStats.reduce((a, r) => a + (Number(r.toHire) || 0), 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                setManpowerStats((p) => [
                  ...p,
                  { company: "", phd: "", master: "", bachelor: "", junior: "", male: "", female: "", avgAge: "", avgYears: "", toHire: "" },
                ])
              }
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              新增一列
            </button>
          </section>

          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>二、經費需求總表（計畫總經費預算表）</SectionTitle>
            <div className="text-sm text-gray-600 bg-gray-50/60 border border-gray-100 rounded-lg p-4 leading-relaxed">
              金額單位：仟元。註：各科目政府經費不得佔 50% 以上；百分比請以小數點後 1 位表示。
            </div>
            <div className="mt-4 text-sm text-blue-700 bg-blue-50/60 border border-blue-100 rounded-lg p-4 leading-relaxed">
              填寫說明：請先完成（二）人事費明細、（三）消耗性器材及原材料費、（四）研發設備使用費之細項，系統會自動彙整回填至（ㄧ）經費需求總表的對應項目（「合計」與「公司自籌款」會自動計算）。
            </div>
            <Hint>如需調整政府補助分攤比例，可在下方「政府補助分攤比例（%）」設定；系統會自動更新（ㄧ）的政府補助與自籌。</Hint>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/60 border border-gray-100 rounded-lg p-4">
              {[
                { key: "personnel", label: "（ㄧ）計畫人員：政府補助分攤比例（%）" },
                { key: "consultant", label: "（ㄧ）顧問：政府補助分攤比例（%）" },
                { key: "consumables", label: "（ㄧ）消耗性器材：政府補助分攤比例（%）" },
                { key: "equipUse", label: "（ㄧ）研發設備使用費：政府補助分攤比例（%）" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors bg-white text-right"
                    value={govAllocPct[key as keyof typeof govAllocPct]}
                    onChange={(e) => setGovAllocPct((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder="50"
                  />
                  <div className="text-[11px] text-gray-500 mt-1">自籌款 = 合計 − 政府補助款（自動計算）</div>
                </div>
              ))}
            </div>

            <SubTitle>（一）經費需求總表</SubTitle>
            <div className="overflow-x-auto border border-gray-200 rounded-lg mt-4">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1000px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-56">會計科目</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">項目</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">政府補助款</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">公司自籌款</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">合計</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-40">佔總經費比例（%）</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((r, idx) => (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 border-r border-gray-200 text-left font-medium text-gray-700">{r.subject}</td>
                      <td className="p-2 border-r border-gray-200 text-left">{r.item}</td>
                      {(["gov", "self", "total", "ratio"] as const).map((k, cIdx) => (
                        <td key={k} className={`p-2 ${cIdx < 3 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 text-right ${
                              k === "total" || k === "ratio" || isSubtotalRow(r) || isGrandTotalRow(r) || isPercentRow(r) ? "bg-gray-100/60" : ""
                            } ${
                              (k === "gov" || k === "self") && (isSubtotalRow(r) || isGrandTotalRow(r) || isPercentRow(r)) ? "cursor-not-allowed opacity-70" : ""
                            } ${
                              (k === "total" || k === "ratio") ? "cursor-not-allowed text-gray-700" : ""
                            }`}
                            value={getComputedBudgetCell(r, k)}
                            readOnly={
                              k === "total" ||
                              k === "ratio" ||
                              isSubtotalRow(r) ||
                              isGrandTotalRow(r) ||
                              isPercentRow(r) ||
                              k === "self" ||
                              (k === "gov" && (idx === idxPersonnel || idx === idxConsultant || idx === idxConsumables || idx === idxEquipUse))
                            }
                            onChange={(e) => {
                              if (
                                k === "total" ||
                                k === "ratio" ||
                                isSubtotalRow(r) ||
                                isGrandTotalRow(r) ||
                                isPercentRow(r) ||
                                (k === "gov" && (idx === idxPersonnel || idx === idxConsultant || idx === idxConsumables || idx === idxEquipUse))
                              )
                                return;
                              const next = [...budgetRows];
                              next[idx] = { ...next[idx], [k]: e.target.value } as BudgetRow;
                              setBudgetRows(next);
                            }}
                            placeholder={k === "ratio" ? "0.0" : "0"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SubTitle>（二）人事費明細（計畫人員 / 顧問）</SubTitle>
            <Hint>只需填「平均月薪（A）」與「人月數（B）」，系統會自動計算（A×B）與小計/合計。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[820px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-56">姓名</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">平均月薪（A）</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">人月數（B）</th>
                    <th className="px-4 py-3 border-b border-gray-200">全程費用概算（A×B）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200 text-left" colSpan={4}>
                      一、計畫人員
                    </td>
                  </tr>
                  {personnelCosts.map((r, idx) => {
                    const computedCost = fmtInt(personnelComputed[idx]?.costNum ?? 0);
                    return (
                    <tr key={`p-${idx}`} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      {(["name", "avgSalary", "manMonths", "cost"] as const).map((k, cIdx) => {
                        const isComputed = k === "cost";
                        return (
                        <td key={k} className={`p-2 ${cIdx < 3 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${
                              k === "name" ? "text-left" : "text-right"
                            } ${isComputed ? "bg-gray-100/60 cursor-not-allowed text-gray-700" : ""}`}
                            value={isComputed ? computedCost : r[k]}
                            readOnly={isComputed}
                            onChange={(e) => {
                              if (isComputed) return;
                              const next = [...personnelCosts];
                              next[idx] = { ...next[idx], [k]: e.target.value } as PersonnelCostRow;
                              setPersonnelCosts(next);
                            }}
                            placeholder={k === "name" ? "例如：王小明" : "0"}
                          />
                        </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                  <tr className="bg-white border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 text-left">
                      <button
                        type="button"
                        onClick={() => setPersonnelCosts((p) => [...p, { name: "", avgSalary: "", manMonths: "", cost: "" }])}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + 新增計畫人員
                      </button>
                    </td>
                    <td className="p-2 border-r border-gray-200" />
                    <td className="p-2 border-r border-gray-200" />
                    <td className="p-2" />
                  </tr>
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200">小計</td>
                    <td className="px-4 py-3 border-r border-gray-200" />
                    <td className="px-4 py-3 border-r border-gray-200 text-right">
                      {personnelManMonthsSum.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Math.round(personnelCostSum).toLocaleString()}
                    </td>
                  </tr>

                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200 text-left" colSpan={4}>
                      二、顧問
                    </td>
                  </tr>
                  {consultantCosts.map((r, idx) => {
                    const computedCost = fmtInt(consultantComputed[idx]?.costNum ?? 0);
                    return (
                    <tr key={`c-${idx}`} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      {(["name", "avgSalary", "manMonths", "cost"] as const).map((k, cIdx) => {
                        const isComputed = k === "cost";
                        return (
                        <td key={k} className={`p-2 ${cIdx < 3 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${
                              k === "name" ? "text-left" : "text-right"
                            } ${isComputed ? "bg-gray-100/60 cursor-not-allowed text-gray-700" : ""}`}
                            value={isComputed ? computedCost : r[k]}
                            readOnly={isComputed}
                            onChange={(e) => {
                              if (isComputed) return;
                              const next = [...consultantCosts];
                              next[idx] = { ...next[idx], [k]: e.target.value } as PersonnelCostRow;
                              setConsultantCosts(next);
                            }}
                            placeholder={k === "name" ? "例如：顧問姓名" : "0"}
                          />
                        </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                  <tr className="bg-white border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 text-left">
                      <button
                        type="button"
                        onClick={() => setConsultantCosts((p) => [...p, { name: "", avgSalary: "", manMonths: "", cost: "" }])}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + 新增顧問
                      </button>
                    </td>
                    <td className="p-2 border-r border-gray-200" />
                    <td className="p-2 border-r border-gray-200" />
                    <td className="p-2" />
                  </tr>
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 border-r border-gray-200">合計</td>
                    <td className="px-4 py-3 border-r border-gray-200" />
                    <td className="px-4 py-3 border-r border-gray-200 text-right">
                      {consultantManMonthsSum.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Math.round(consultantCostSum).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubTitle>（三）消耗性器材及原材料費</SubTitle>
            <Hint>只需填「數量」與「單價」，系統會自動計算全程費用概算與合計。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[900px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200">項目</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-24">單位</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">預估數量</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-28">預估單價</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-36">全程費用概算</th>
                  </tr>
                </thead>
                <tbody>
                  {consumables.map((r, idx) => {
                    const computedTotal = fmtInt(consumablesComputed[idx]?.totalNum ?? 0);
                    return (
                    <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      {(["item", "unit", "qty", "price", "total"] as const).map((k, cIdx) => {
                        const isComputed = k === "total";
                        return (
                        <td key={k} className={`p-2 ${cIdx < 4 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${k === "item" ? "text-left" : "text-right"} ${
                              isComputed ? "bg-gray-100/60 cursor-not-allowed text-gray-700" : ""
                            }`}
                            value={isComputed ? computedTotal : r[k]}
                            readOnly={isComputed}
                            onChange={(e) => {
                              if (isComputed) return;
                              const next = [...consumables];
                              next[idx] = { ...next[idx], [k]: e.target.value } as ConsumableRow;
                              setConsumables(next);
                            }}
                            placeholder={k === "item" ? "例如：感測器/材料/雲端資源" : "0"}
                          />
                        </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                  <tr className="bg-white border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 text-left">
                      <button
                        type="button"
                        onClick={() => setConsumables((p) => [...p, { item: "", unit: "", qty: "", price: "", total: "" }])}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + 新增一列
                      </button>
                    </td>
                    <td className="p-2 border-r border-gray-200" />
                    <td className="p-2 border-r border-gray-200" />
                    <td className="p-2 border-r border-gray-200" />
                    <td className="p-2 text-right font-medium">
                      {Math.round(consumablesSum).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubTitle>（四）研發設備使用費</SubTitle>
            <Hint>已有設備：需填剩餘使用年限與投入月數；新增設備：填購置金額與投入月數；系統會自動計算月使用費與全程費用概算。</Hint>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1100px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-44">設備名稱</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">財產編號</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-36">單套帳面價值A</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-24">套數B</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">剩餘使用年限</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">月使用費</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-24">投入月數</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-36">全程費用概算</th>
                  </tr>
                </thead>
                <tbody>
                  {equipments.existing.map((r, idx) => {
                    const monthly = equipmentsExistingComputed[idx]?.monthlyNum ?? 0;
                    const total = equipmentsExistingComputed[idx]?.totalNum ?? 0;
                    return (
                    <tr key={`ex-${idx}`} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      {(["name", "assetId", "valueA", "countB", "remainingYears", "monthlyFee", "months", "total"] as const).map((k, cIdx) => {
                        const isComputed = k === "monthlyFee" || k === "total";
                        const computedValue = k === "monthlyFee" ? fmtInt(monthly) : k === "total" ? fmtInt(total) : r[k];
                        return (
                        <td key={k} className={`p-2 ${cIdx < 7 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${
                              k === "name" || k === "assetId" ? "text-left" : "text-right"
                            } ${isComputed ? "bg-gray-100/60 cursor-not-allowed text-gray-700" : ""}`}
                            value={computedValue}
                            readOnly={isComputed}
                            onChange={(e) => {
                              if (isComputed) return;
                              const next = { ...equipments };
                              const list = [...next.existing];
                              list[idx] = { ...list[idx], [k]: e.target.value } as EquipmentRow;
                              next.existing = list;
                              setEquipments(next);
                            }}
                            placeholder={k === "assetId" ? "財產編號" : k === "name" ? "例如：伺服器/量測儀器" : "0"}
                          />
                        </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                  <tr className="bg-white border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 text-left">
                      <button
                        type="button"
                        onClick={() =>
                          setEquipments((p) => ({
                            ...p,
                            existing: [...p.existing, { name: "", assetId: "", valueA: "", countB: "", remainingYears: "", monthlyFee: "", months: "", total: "" }],
                          }))
                        }
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + 新增已有設備
                      </button>
                    </td>
                    <td className="p-2 border-r border-gray-200" colSpan={6} />
                    <td className="p-2 text-right font-medium">
                      {Math.round(equipmentsExistingSum).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-center text-gray-600 min-w-[1100px]">
                <thead className="text-xs text-gray-700 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-44">設備名稱</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">財產編號</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-36">單套購置金額A</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-24">套數B</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-32">（可填）剩餘使用年限</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200">月使用費</th>
                    <th className="px-4 py-3 border-r border-b border-gray-200 w-24">投入月數</th>
                    <th className="px-4 py-3 border-b border-gray-200 w-36">全程費用概算</th>
                  </tr>
                </thead>
                <tbody>
                  {equipments.new.map((r, idx) => {
                    const monthly = equipmentsNewComputed[idx]?.monthlyNum ?? 0;
                    const total = equipmentsNewComputed[idx]?.totalNum ?? 0;
                    return (
                    <tr key={`new-${idx}`} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                      {(["name", "assetId", "valueA", "countB", "remainingYears", "monthlyFee", "months", "total"] as const).map((k, cIdx) => {
                        const isComputed = k === "monthlyFee" || k === "total";
                        const computedValue = k === "monthlyFee" ? fmtInt(monthly) : k === "total" ? fmtInt(total) : r[k];
                        return (
                        <td key={k} className={`p-2 ${cIdx < 7 ? "border-r border-gray-200" : ""}`}>
                          <input
                            className={`w-full bg-transparent outline-none px-2 py-1 ${
                              k === "name" || k === "assetId" ? "text-left" : "text-right"
                            } ${isComputed ? "bg-gray-100/60 cursor-not-allowed text-gray-700" : ""}`}
                            value={computedValue}
                            readOnly={isComputed}
                            onChange={(e) => {
                              if (isComputed) return;
                              const next = { ...equipments };
                              const list = [...next.new];
                              list[idx] = { ...list[idx], [k]: e.target.value } as EquipmentRow;
                              next.new = list;
                              setEquipments(next);
                            }}
                            placeholder={k === "assetId" ? "（如有）財產編號" : k === "name" ? "例如：測試設備/伺服器" : "0"}
                          />
                        </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                  <tr className="bg-white border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-2 border-r border-gray-200 text-left">
                      <button
                        type="button"
                        onClick={() =>
                          setEquipments((p) => ({
                            ...p,
                            new: [...p.new, { name: "", assetId: "", valueA: "", countB: "", remainingYears: "", monthlyFee: "", months: "", total: "" }],
                          }))
                        }
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + 新增計畫新增設備
                      </button>
                    </td>
                    <td className="p-2 border-r border-gray-200" colSpan={6} />
                    <td className="p-2 text-right font-medium">
                      {Math.round(equipmentsNewSum).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

