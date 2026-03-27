"use client";

import React, { useEffect, useState } from "react";
import { EXPECTED_BENEFITS_HINT } from "../lib/sbirAppendixNotes";

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

export type ExpectedBenefitsDraft = {
  formData: {
    valueAdded: string;
    newProducts: string;
    derivedProducts: string;
    rndInvestment: string;
    inducedInvestment: string;
    costReduction: string;
    employment: string;
    newCompany: string;
    inventionPatent: string;
    utilityPatent: string;
    journalPapers: string;
    conferencePapers: string;
    quantitativeNarrative: string;
    qualitativeBenefits: string;
    impactOnCompany: string;
    impactOnIndustry: string;
  };
};

export default function ExpectedBenefitsForm({
  value,
  onChange,
}: {
  value?: ExpectedBenefitsDraft;
  onChange?: (next: ExpectedBenefitsDraft) => void;
}) {
  const [formData, setFormData] = useState({
    valueAdded: "",
    newProducts: "",
    derivedProducts: "",
    rndInvestment: "",
    inducedInvestment: "",
    costReduction: "",
    employment: "",
    newCompany: "",
    inventionPatent: "",
    utilityPatent: "",
    journalPapers: "",
    conferencePapers: "",

    quantitativeNarrative: "",
    qualitativeBenefits: "",
    impactOnCompany: "",
    impactOnIndustry: "",
  });

  const didInitFromValue = React.useRef(false);
  useEffect(() => {
    if (!value || didInitFromValue.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(value.formData);
    didInitFromValue.current = true;
  }, [value]);

  useEffect(() => {
    if (!onChange) return;
    onChange({ formData });
  }, [formData, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-800 text-white px-8 py-6">
          <h1 className="text-2xl font-semibold tracking-wider">參、預期效益</h1>
          <p className="text-gray-300 text-sm mt-2">請說明結案當年與後兩年可完成之效益（含量化與非量化）。</p>
        </div>

        <div className="px-8 pt-6">
          <div
            className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 text-sm font-semibold leading-relaxed"
            role="note"
          >
            {EXPECTED_BENEFITS_HINT}
          </div>
        </div>

        <div className="p-8">
          <section className="mb-12">
            <SectionTitle>一、量化效益</SectionTitle>
            <div className="text-sm text-gray-600 bg-gray-50/60 border border-gray-100 rounded-lg p-4">
              請依計畫性質提出具體、量化之分析，並填寫產生效益之時間點、必要配合措施與評估基準。若無請填 0。
            </div>

            <SubTitle>（一）量化指標彙整</SubTitle>
            <Hint>若為估算值，請在下方「量化效益分析」說明估算依據（例如：單價×數量、轉換率、產能、客戶數）。</Hint>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-lg border border-gray-100 mt-4">
              <div>
                <Label>增加產值（千元）</Label>
                <Input type="number" name="valueAdded" value={formData.valueAdded} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>產出新產品或服務（項）</Label>
                <Input type="number" name="newProducts" value={formData.newProducts} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>衍生商品或服務（項）</Label>
                <Input type="number" name="derivedProducts" value={formData.derivedProducts} onChange={handleChange} placeholder="0" />
              </div>

              <div>
                <Label>投入研發費用（千元）</Label>
                <Input type="number" name="rndInvestment" value={formData.rndInvestment} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>促成投資額（千元）</Label>
                <Input type="number" name="inducedInvestment" value={formData.inducedInvestment} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>降低成本（千元）</Label>
                <Input type="number" name="costReduction" value={formData.costReduction} onChange={handleChange} placeholder="0" />
              </div>

              <div>
                <Label>增加就業人數（人）</Label>
                <Input type="number" name="employment" value={formData.employment} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>成立新公司（家）</Label>
                <Input type="number" name="newCompany" value={formData.newCompany} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>發明專利（件）</Label>
                <Input type="number" name="inventionPatent" value={formData.inventionPatent} onChange={handleChange} placeholder="0" />
              </div>

              <div>
                <Label>新型/新式樣專利（件）</Label>
                <Input type="number" name="utilityPatent" value={formData.utilityPatent} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>期刊論文（篇）</Label>
                <Input type="number" name="journalPapers" value={formData.journalPapers} onChange={handleChange} placeholder="0" />
              </div>
              <div>
                <Label>研討會論文（篇）</Label>
                <Input type="number" name="conferencePapers" value={formData.conferencePapers} onChange={handleChange} placeholder="0" />
              </div>
            </div>

          </section>

          <section className="mb-12 pt-8 border-t border-gray-200">
            <SectionTitle>二、非量化效益</SectionTitle>
            <Label required>請以敘述性方式說明，例如對公司的影響．．．等。</Label>
            <Hint>建議條列 3–7 點，聚焦可被審查理解的改變：能力建立、制度流程、品質/交付、品牌信任、合作關係等。</Hint>
            <Textarea
              name="qualitativeBenefits"
              value={formData.qualitativeBenefits}
              onChange={handleChange}
              placeholder="請說明非量化效益：品牌提升、技術累積、流程改善、知識資產、合作關係、示範效應等。"
            />
          </section>

          <section className="mb-8 pt-8 border-t border-gray-200">
            <SectionTitle>三、效益影響說明（敘述）</SectionTitle>
            <div className="text-sm text-gray-600 bg-gray-50/60 border border-gray-100 rounded-lg p-4 mb-6 leading-relaxed">
              以下兩項為長文本欄位，請具體說明結案當年與後兩年可完成之效益；可搭配條列與可驗證描述。
            </div>

            <Label required>（一）對公司之影響：</Label>
            <Hint>如研發能量建立、研發人員質／量提升、研發制度建立、跨高科技領域、技術升級、國際化或企業轉型等。</Hint>
            <Textarea
              name="impactOnCompany"
              value={formData.impactOnCompany}
              onChange={handleChange}
              placeholder="請條列說明：能力/制度/流程的提升、團隊成長、產品線延伸、營運指標改善等。"
            />

            <div className="mt-8">
              <Label required>（二）對產業、產業技術所具有之創造、加值、或流通之效益：</Label>
              <Hint>如產值貢獻、對產業技術研發水準之提昇、服務範圍家數之擴大、對產業技術研究機構研發服務之競合、研發服務業之興起、技術商品化時程之縮短、系統化之研究方法、吸引就業人數或引導投資數量等。</Hint>
              <Textarea
                name="impactOnIndustry"
                value={formData.impactOnIndustry}
                onChange={handleChange}
                placeholder="請條列說明：對產業鏈/技術擴散/供應鏈合作/在地產業升級的影響與可外溢效益。"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

