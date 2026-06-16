import { resolveOnlineDraftViewPayload } from "@/lib/adminOnlineDraftResolve";
import { extractFormDataFromDraftPayload } from "@/lib/resolveApplicationDisplayFields";

export type ApplicationBudgetAmounts = {
  subsidy: number | null;
  selfFund: number | null;
  total: number | null;
};

type BudgetRow = {
  subject?: string;
  item?: string;
  gov?: string;
  self?: string;
  total?: string;
};

type HumanBudget = {
  budgetRows?: BudgetRow[];
  govAllocPct?: Record<string, string>;
  personnelCosts?: Array<{ cost?: string; avgSalary?: string; manMonths?: string }>;
  consultantCosts?: Array<{ cost?: string; avgSalary?: string; manMonths?: string }>;
  consumables?: Array<{ total?: string; qty?: string; price?: string }>;
  equipments?: { existing?: Array<{ total?: string }>; new?: Array<{ total?: string }> };
  equipmentMaintenanceCosts?: Array<{ gov?: string; self?: string }>;
  techIntroCosts?: {
    buy?: Array<{ gov?: string; self?: string }>;
    research?: Array<{ gov?: string; self?: string }>;
    service?: Array<{ gov?: string; self?: string }>;
    design?: Array<{ gov?: string; self?: string }>;
  };
};

function parseBudgetInt(value: unknown): number | null {
  const t = String(value ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function num(value: unknown): number {
  if (value === "" || value == null) return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function pickGrandBudgetRow(rows: BudgetRow[]): BudgetRow | undefined {
  const normalized = rows.map((r) => ({
    ...r,
    subject: normalizeText(r.subject),
    item: normalizeText(r.item),
  }));
  return (
    normalized.find((r) => r.subject === "合計" && (r.item === "合計" || r.item === "")) ||
    normalized.find((r) => r.subject === "合計") ||
    normalized.find((r) => r.subject.replace(/\s/g, "") === "合計")
  );
}

function rowFunds(row: BudgetRow | undefined): { gov: number; self: number; total: number } {
  const gov = num(row?.gov);
  const self = num(row?.self);
  const totalStored = num(row?.total);
  const total = totalStored > 0 ? totalStored : gov + self;
  return { gov, self, total };
}

function toAmounts(gov: number, self: number, total: number): ApplicationBudgetAmounts | null {
  const roundedGov = Math.round(gov);
  const roundedSelf = Math.round(self);
  const roundedTotal = Math.round(total > 0 ? total : gov + self);
  if (roundedGov <= 0 && roundedSelf <= 0 && roundedTotal <= 0) return null;
  return {
    subsidy: roundedGov > 0 ? roundedGov : null,
    selfFund: roundedSelf > 0 ? roundedSelf : null,
    total: roundedTotal > 0 ? roundedTotal : null,
  };
}

function computeFromBudgetRows(rows: BudgetRow[]): ApplicationBudgetAmounts | null {
  if (!rows.length) return null;

  const grand = pickGrandBudgetRow(rows);
  if (grand) {
    const g = rowFunds(grand);
    if (g.gov > 0 || g.self > 0 || g.total > 0) {
      return toAmounts(g.gov, g.self, g.total);
    }
  }

  const findRow = (matcher: (r: { subject: string; item: string }) => boolean) =>
    rows.find((r) => matcher({ subject: normalizeText(r.subject), item: normalizeText(r.item) }));

  const leafRows = [
    findRow((r) => r.subject.includes("1.") && r.item.includes("計畫人員")),
    findRow((r) => r.subject.includes("1.") && r.item.includes("顧問")),
    findRow((r) => r.subject.startsWith("2.")),
    findRow((r) => r.subject.startsWith("3.")),
    findRow((r) => r.subject.startsWith("4.")),
    findRow((r) => r.subject.startsWith("5.") && r.item.includes("小")),
  ].map((r) => rowFunds(r));

  const grandGov = leafRows.reduce((sum, r) => sum + r.gov, 0);
  const grandSelf = leafRows.reduce((sum, r) => sum + r.self, 0);
  const grandTotal = leafRows.reduce((sum, r) => sum + r.total, 0);
  if (grandGov > 0 || grandSelf > 0 || grandTotal > 0) {
    return toAmounts(grandGov, grandSelf, grandTotal);
  }

  return null;
}

function computeFromDetailTables(humanBudget: HumanBudget): ApplicationBudgetAmounts | null {
  const pct = (key: string) => Math.min(100, Math.max(0, num(humanBudget.govAllocPct?.[key] ?? 50)));

  const personnelTotal = Math.round(
    (humanBudget.personnelCosts ?? []).reduce(
      (sum, row) => sum + (num(row.cost) || num(row.avgSalary) * num(row.manMonths)),
      0,
    ),
  );
  const consultantTotal = Math.round(
    (humanBudget.consultantCosts ?? []).reduce(
      (sum, row) => sum + (num(row.cost) || num(row.avgSalary) * num(row.manMonths)),
      0,
    ),
  );
  const consumablesTotal = Math.round(
    (humanBudget.consumables ?? []).reduce(
      (sum, row) => sum + (num(row.total) || num(row.qty) * num(row.price)),
      0,
    ),
  );
  const equipmentTotal = Math.round(
    (humanBudget.equipments?.existing ?? []).reduce((sum, row) => sum + num(row.total), 0) +
      (humanBudget.equipments?.new ?? []).reduce((sum, row) => sum + num(row.total), 0),
  );

  const maintenance = humanBudget.equipmentMaintenanceCosts ?? [];
  const maintenanceGov = Math.round(maintenance.reduce((sum, row) => sum + num(row.gov), 0));
  const maintenanceSelf = Math.round(maintenance.reduce((sum, row) => sum + num(row.self), 0));

  const sumTech = (rows?: Array<{ gov?: string; self?: string }>) =>
    (rows ?? []).reduce(
      (acc, row) => ({ gov: acc.gov + num(row.gov), self: acc.self + num(row.self) }),
      { gov: 0, self: 0 },
    );
  const tech = {
    buy: sumTech(humanBudget.techIntroCosts?.buy),
    research: sumTech(humanBudget.techIntroCosts?.research),
    service: sumTech(humanBudget.techIntroCosts?.service),
    design: sumTech(humanBudget.techIntroCosts?.design),
  };
  const techGov = Math.round(tech.buy.gov + tech.research.gov + tech.service.gov + tech.design.gov);
  const techSelf = Math.round(tech.buy.self + tech.research.self + tech.service.self + tech.design.self);

  const personnelGov = Math.round(personnelTotal * (pct("personnel") / 100));
  const consultantGov = Math.round(consultantTotal * (pct("consultant") / 100));
  const consumablesGov = Math.round(consumablesTotal * (pct("consumables") / 100));
  const equipmentGov = Math.round(equipmentTotal * (pct("equipUse") / 100));

  const grandGov = personnelGov + consultantGov + consumablesGov + equipmentGov + maintenanceGov + techGov;
  const grandSelf =
    personnelTotal -
    personnelGov +
    (consultantTotal - consultantGov) +
    (consumablesTotal - consumablesGov) +
    (equipmentTotal - equipmentGov) +
    maintenanceSelf +
    techSelf;
  const grandTotal =
    personnelTotal +
    consultantTotal +
    consumablesTotal +
    equipmentTotal +
    maintenanceGov +
    maintenanceSelf +
    techGov +
    techSelf;

  return toAmounts(grandGov, grandSelf, grandTotal);
}

export function extractApplicationBudgetFromFormData(
  payload: Record<string, unknown> | null | undefined,
): ApplicationBudgetAmounts {
  const formData = extractFormDataFromDraftPayload(payload);
  const humanBudget = formData.humanBudget as HumanBudget | undefined;
  if (!humanBudget) {
    return { subsidy: null, selfFund: null, total: null };
  }

  const fromRows = computeFromBudgetRows(humanBudget.budgetRows ?? []);
  if (fromRows && (fromRows.subsidy != null || fromRows.selfFund != null)) {
    return fromRows;
  }

  const fromDetails = computeFromDetailTables(humanBudget);
  if (fromDetails) return fromDetails;

  if (fromRows?.total != null) return fromRows;

  return { subsidy: null, selfFund: null, total: null };
}

export async function resolveApplicationBudgetBatch(
  apps: Array<{ id: string; submissionMode: string }>,
  concurrency = 4,
): Promise<Map<string, ApplicationBudgetAmounts>> {
  const out = new Map<string, ApplicationBudgetAmounts>();
  let index = 0;

  async function worker() {
    while (index < apps.length) {
      const current = index++;
      const app = apps[current];
      const mode = String(app.submissionMode || "ONLINE").toUpperCase();
      if (mode !== "ONLINE" && mode !== "UPLOAD") {
        out.set(app.id, { subsidy: null, selfFund: null, total: null });
        continue;
      }
      try {
        const draftState = await resolveOnlineDraftViewPayload(app.id);
        if (draftState.kind === "ok") {
          out.set(app.id, extractApplicationBudgetFromFormData(draftState.draft));
        } else {
          out.set(app.id, { subsidy: null, selfFund: null, total: null });
        }
      } catch {
        out.set(app.id, { subsidy: null, selfFund: null, total: null });
      }
    }
  }

  const workers = Math.min(concurrency, Math.max(1, apps.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}
