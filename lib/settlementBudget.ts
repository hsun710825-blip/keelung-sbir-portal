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

function parseBudgetInt(value: unknown): number | null {
  const t = String(value ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function extractApplicationBudgetFromFormData(
  payload: Record<string, unknown> | null | undefined,
): ApplicationBudgetAmounts {
  const formData = extractFormDataFromDraftPayload(payload);
  const humanBudget = formData.humanBudget as { budgetRows?: BudgetRow[] } | undefined;
  const rows = humanBudget?.budgetRows ?? [];
  const grand = rows.find((r) => r.subject === "合計" && r.item === "合計");
  if (!grand) {
    return { subsidy: null, selfFund: null, total: null };
  }
  return {
    subsidy: parseBudgetInt(grand.gov),
    selfFund: parseBudgetInt(grand.self),
    total: parseBudgetInt(grand.total),
  };
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
