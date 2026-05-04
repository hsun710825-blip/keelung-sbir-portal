/**
 * 與 /api/draft 相同之草稿 formData 正規化，供管理員唯讀預覽與草稿 API 共用。
 */

function normalizeScheduleCheckpointsDraft(input: unknown) {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as {
    rows?: Array<{ id?: unknown; item?: unknown; weight?: unknown; manMonths?: unknown; months?: Record<string, unknown> }>;
    kpis?: Array<Record<string, unknown>>;
    notes?: { progressNote?: unknown; kpiNote?: unknown };
    testReportImages?: Array<{ id?: unknown; name?: unknown; size?: unknown; url?: unknown }>;
  };
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .map((r) => {
          const id = String(r?.id ?? "").trim();
          if (!id) return null;
          const item = String(r?.item ?? "").trim();
          const monthsRaw = r?.months && typeof r.months === "object" ? r.months : {};
          const months = Object.fromEntries(
            Object.entries(monthsRaw).map(([k, v]) => {
              const o = v && typeof v === "object" ? (v as { progress?: unknown; checkpoint?: unknown }) : {};
              return [k, { progress: !!o.progress, checkpoint: !!o.checkpoint }];
            }),
          );
          return {
            id,
            item,
            weight: String(r?.weight ?? ""),
            manMonths: String(r?.manMonths ?? ""),
            months,
          };
        })
        .filter(Boolean)
    : [];
  const kpis = Array.isArray(raw.kpis)
    ? raw.kpis.map((k, idx) => ({
        id: String((k as { id?: unknown })?.id ?? `kpi-${idx + 1}`),
        code: String((k as { code?: unknown })?.code ?? ""),
        description: String((k as { description?: unknown })?.description ?? ""),
        period: String((k as { period?: unknown })?.period ?? ""),
        weight: String((k as { weight?: unknown })?.weight ?? "0"),
        staffCode: String((k as { staffCode?: unknown })?.staffCode ?? ""),
        workKey: String((k as { workKey?: unknown })?.workKey ?? ""),
        periodStartYear: (k as { periodStartYear?: unknown })?.periodStartYear != null ? String((k as { periodStartYear?: unknown }).periodStartYear) : undefined,
        periodStartMonth: (k as { periodStartMonth?: unknown })?.periodStartMonth != null ? String((k as { periodStartMonth?: unknown }).periodStartMonth) : undefined,
        periodEndYear: (k as { periodEndYear?: unknown })?.periodEndYear != null ? String((k as { periodEndYear?: unknown }).periodEndYear) : undefined,
        periodEndMonth: (k as { periodEndMonth?: unknown })?.periodEndMonth != null ? String((k as { periodEndMonth?: unknown }).periodEndMonth) : undefined,
      }))
    : [];
  const notes = {
    progressNote: String(raw.notes?.progressNote ?? ""),
    kpiNote: String(raw.notes?.kpiNote ?? ""),
  };
  const testReportImages = Array.isArray(raw.testReportImages)
    ? raw.testReportImages
        .map((img, idx) => ({
          id: String(img?.id ?? `img-${idx + 1}`),
          name: String(img?.name ?? ""),
          size: String(img?.size ?? ""),
          url: String(img?.url ?? ""),
        }))
        .filter((img) => !!img.url)
    : [];
  return { rows, kpis, notes, testReportImages };
}

export function normalizeDraftFormDataShape(payload: Record<string, unknown>) {
  const out = { ...payload } as Record<string, unknown>;
  const formData = (out.formData && typeof out.formData === "object" ? { ...(out.formData as Record<string, unknown>) } : {}) as Record<string, unknown>;
  const schedule = normalizeScheduleCheckpointsDraft(formData.scheduleCheckpoints);
  if (schedule) formData.scheduleCheckpoints = schedule;
  if (formData.humanBudget && typeof formData.humanBudget === "object") {
    const hb = { ...(formData.humanBudget as Record<string, unknown>) };
    const tc = hb.techIntroCosts && typeof hb.techIntroCosts === "object" ? (hb.techIntroCosts as Record<string, unknown>) : {};
    const normalizeRows = (src: unknown, fallbackLabel: string) =>
      (Array.isArray(src) ? src : [{ item: fallbackLabel, gov: "", self: "" }]).map((r, idx) => {
        const row = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
        return {
          item: String(row.item ?? (idx === 0 ? fallbackLabel : "")),
          gov: String(row.gov ?? ""),
          self: String(row.self ?? ""),
        };
      });
    hb.techIntroCosts = {
      buy: normalizeRows(tc.buy, "(1) 技術或智慧財產權購買費"),
      research: normalizeRows(tc.research, "(2) 委託研究費"),
      service: normalizeRows(tc.service, "(3) 委託勞務費"),
      design: normalizeRows(tc.design, "(4) 委託設計費"),
    };
    hb.equipmentMaintenanceCosts = (Array.isArray(hb.equipmentMaintenanceCosts) ? hb.equipmentMaintenanceCosts : [{ item: "研發設備維護費", gov: "", self: "" }]).map((r, idx) => {
      const row = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
      return {
        item: String(row.item ?? (idx === 0 ? "研發設備維護費" : "")),
        gov: String(row.gov ?? ""),
        self: String(row.self ?? ""),
      };
    });
    formData.humanBudget = hb;
  }
  out.formData = formData;
  return out;
}
