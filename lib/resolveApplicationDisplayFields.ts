import { pickRegistryFieldsFromFormData } from "@/app/api/_registrySheet";
import { resolveOnlineDraftViewPayload } from "@/lib/adminOnlineDraftResolve";
import { parseKeyValueDescription } from "@/lib/parseMigratedDescription";

export type ApplicationDisplayFields = {
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  source: "draft" | "description" | "none";
};

type AnyRecord = Record<string, unknown>;

/** Drive 草稿 JSON 可能是 { formData: {...} } 或直接為 formData 欄位 */
export function extractFormDataFromDraftPayload(payload: AnyRecord | null | undefined): AnyRecord {
  if (!payload || typeof payload !== "object") return {};
  if (payload.formData && typeof payload.formData === "object") {
    return payload.formData as AnyRecord;
  }
  return payload;
}

function pickFirst(parsed: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = String(parsed[k] || "").trim();
    if (v) return v;
  }
  return "";
}

export function resolveDisplayFieldsFromFormData(
  payload: AnyRecord | null | undefined,
): ApplicationDisplayFields {
  const formData = extractFormDataFromDraftPayload(payload);
  const reg = pickRegistryFieldsFromFormData(formData);
  const companyName = reg.companyName.trim();
  const contactPerson = (reg.contactPerson || reg.planHost || reg.responsiblePerson).trim();
  const contactPhone = reg.phone.trim();
  if (companyName || contactPerson || contactPhone) {
    return {
      companyName,
      contactPerson,
      contactPhone,
      source: "draft",
    };
  }
  return { companyName: "", contactPerson: "", contactPhone: "", source: "none" };
}

export function resolveDisplayFieldsFromDescription(
  description: string | null | undefined,
): ApplicationDisplayFields {
  const parsed = parseKeyValueDescription(description);
  const companyName = pickFirst(parsed, ["公司名稱", "公司", "申請公司", "企業名稱"]);
  const contactPerson = pickFirst(parsed, ["聯絡人", "計畫主持人", "負責人", "主持人"]);
  const contactPhone = pickFirst(parsed, ["聯絡電話", "聯絡電話含分機", "手機", "電話"]);
  if (companyName || contactPerson || contactPhone) {
    return { companyName, contactPerson, contactPhone, source: "description" };
  }
  return { companyName: "", contactPerson: "", contactPhone: "", source: "none" };
}

export async function resolveApplicationDisplayFields(input: {
  id: string;
  submissionMode: string;
  description: string | null;
}): Promise<ApplicationDisplayFields> {
  const fromDescription = resolveDisplayFieldsFromDescription(input.description);
  if (fromDescription.companyName) {
    return fromDescription;
  }

  const mode = String(input.submissionMode || "ONLINE").toUpperCase();
  if (mode === "ONLINE" || mode === "UPLOAD") {
    try {
      const draftState = await resolveOnlineDraftViewPayload(input.id);
      if (draftState.kind === "ok") {
        const fromDraft = resolveDisplayFieldsFromFormData(draftState.draft);
        if (fromDraft.companyName || fromDraft.contactPerson || fromDraft.contactPhone) {
          return fromDraft;
        }
      }
    } catch (error) {
      console.warn(`[resolveApplicationDisplayFields] draft load failed for ${input.id}:`, error);
    }
  }

  if (fromDescription.contactPerson || fromDescription.contactPhone) {
    return fromDescription;
  }

  return { companyName: "", contactPerson: "", contactPhone: "", source: "none" };
}

export async function resolveApplicationDisplayFieldsBatch(
  apps: Array<{
    id: string;
    submissionMode: string;
    description: string | null;
  }>,
  concurrency = 6,
): Promise<Map<string, ApplicationDisplayFields>> {
  const out = new Map<string, ApplicationDisplayFields>();
  let index = 0;

  async function worker() {
    while (index < apps.length) {
      const current = index++;
      const app = apps[current];
      const fields = await resolveApplicationDisplayFields(app);
      out.set(app.id, fields);
    }
  }

  const workers = Math.min(concurrency, Math.max(1, apps.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}
