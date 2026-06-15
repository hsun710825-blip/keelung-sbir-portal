export type CommitteeScoreBreakdown = {
  teamAbility: number;
  innovation: number;
  methodology: number;
  benefit: number;
  bonusJoint: number;
  bonusGreen: number;
  bonusHarbor: number;
  bonusFirstTime: number;
  bonusYouth: number;
  bonusAi: number;
  bonusCulture: number;
};

export const BASE_SCORE_FIELDS = [
  { key: "teamAbility" as const, label: "研發團隊實績與執行能力", max: 17 },
  { key: "innovation" as const, label: "計畫創新性、完整性與競爭力", max: 26 },
  { key: "methodology" as const, label: "計畫實施方法、時程與可行性", max: 30 },
  { key: "benefit" as const, label: "計畫預期效益", max: 13 },
];

export const BONUS_SCORE_FIELDS = [
  { key: "bonusJoint" as const, label: "聯合形式申請", options: [0, 2] as const },
  { key: "bonusGreen" as const, label: "綠色永續產業", options: [0, 1, 2] as const },
  { key: "bonusHarbor" as const, label: "港灣經濟", options: [0, 1, 2] as const },
  { key: "bonusFirstTime" as const, label: "首次提出計畫補助", options: [0, 2] as const },
  { key: "bonusYouth" as const, label: "青年創業(設籍本市18-45歲負責人)", options: [0, 2] as const },
  { key: "bonusAi" as const, label: "AI人工智慧應用與技術", options: [0, 1, 2] as const },
  { key: "bonusCulture" as const, label: "文化創意", options: [0, 1, 2] as const },
];

export const BASE_SCORE_MAX = BASE_SCORE_FIELDS.reduce((n, f) => n + f.max, 0);
export const BONUS_SCORE_MAX = 14;
export const TOTAL_SCORE_MAX = BASE_SCORE_MAX + BONUS_SCORE_MAX;

export type EvaluationStatus = "DRAFT" | "SUBMITTED" | "LOCKED";

export type CommitteeReviewSessionStatus = "ACTIVE" | "SUBMITTED_TO_PO" | "LOCKED_BY_PO";

export function emptyScoreBreakdown(): CommitteeScoreBreakdown {
  return {
    teamAbility: 0,
    innovation: 0,
    methodology: 0,
    benefit: 0,
    bonusJoint: 0,
    bonusGreen: 0,
    bonusHarbor: 0,
    bonusFirstTime: 0,
    bonusYouth: 0,
    bonusAi: 0,
    bonusCulture: 0,
  };
}

function parseIntField(raw: FormDataEntryValue | null, max: number, label: string): number | { error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { error: `請填寫「${label}」` };
  const n = parseInt(text, 10);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    return { error: `「${label}」請填 0～${max} 的整數` };
  }
  return n;
}

function parseBonusField(
  raw: FormDataEntryValue | null,
  options: readonly number[],
  label: string,
): number | { error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { error: `請選擇「${label}」` };
  const n = parseInt(text, 10);
  if (!options.includes(n)) {
    return { error: `「${label}」僅能選擇：${options.join("、")}` };
  }
  return n;
}

export function parseScoreBreakdownFromFormData(formData: FormData): CommitteeScoreBreakdown | { error: string } {
  const out = emptyScoreBreakdown();

  for (const field of BASE_SCORE_FIELDS) {
    const parsed = parseIntField(formData.get(field.key), field.max, field.label);
    if (typeof parsed === "object") return parsed;
    out[field.key] = parsed;
  }

  for (const field of BONUS_SCORE_FIELDS) {
    const parsed = parseBonusField(formData.get(field.key), field.options, field.label);
    if (typeof parsed === "object") return parsed;
    out[field.key] = parsed;
  }

  return out;
}

export function computeTotalScore(breakdown: CommitteeScoreBreakdown): number {
  return (
    breakdown.teamAbility +
    breakdown.innovation +
    breakdown.methodology +
    breakdown.benefit +
    breakdown.bonusJoint +
    breakdown.bonusGreen +
    breakdown.bonusHarbor +
    breakdown.bonusFirstTime +
    breakdown.bonusYouth +
    breakdown.bonusAi +
    breakdown.bonusCulture
  );
}

export function parseScoresJson(raw: string | null | undefined): CommitteeScoreBreakdown | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CommitteeScoreBreakdown>;
    const base = emptyScoreBreakdown();
    for (const key of Object.keys(base) as Array<keyof CommitteeScoreBreakdown>) {
      const v = parsed[key];
      if (typeof v === "number" && Number.isFinite(v)) base[key] = v;
    }
    return base;
  } catch {
    return null;
  }
}

export function serializeScoresJson(breakdown: CommitteeScoreBreakdown): string {
  return JSON.stringify(breakdown);
}

export function evaluationStatusLabel(status: string | null | undefined): string {
  switch (String(status || "DRAFT").toUpperCase()) {
    case "SUBMITTED":
      return "已確認送出";
    case "LOCKED":
      return "已鎖定";
    default:
      return "評分中";
  }
}

export function sessionStatusLabel(status: string | null | undefined): string {
  switch (String(status || "ACTIVE").toUpperCase()) {
    case "SUBMITTED_TO_PO":
      return "已送交 PO";
    case "LOCKED_BY_PO":
      return "PO 已鎖定";
    default:
      return "評分中";
  }
}

export function canCommitteeEditEvaluation(
  evalStatus: string | null | undefined,
  sessionStatus: string | null | undefined,
): boolean {
  if (String(sessionStatus || "").toUpperCase() === "LOCKED_BY_PO") return false;
  return true;
}
