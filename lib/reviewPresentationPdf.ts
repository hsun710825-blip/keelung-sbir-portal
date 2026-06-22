import { getDriveSaClient } from "@/app/api/_driveSa";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import { matchApplicationToAgenda } from "@/lib/matchApplicationToAgenda";
import { normalizeCompanyLabel, parseReviewPdfFilename } from "@/lib/reviewCompleteProposalPdf";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";
import { isReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

/** 業者上傳簡報彙整根資料夾（子資料夾 0622 / 0701） */
export const PRESENTATION_ROOT_FOLDER_ID = "1TaRpmHR1t8XeVa8UgfE4hTjcczdlwTOi";

export type PresentationFolderIndex = {
  byMeetingOrder: Record<string, string>;
  byMeetingCompany: Record<string, string>;
};

type DrivePresentationFile = {
  id: string;
  name: string;
  order: number | null;
  label: string;
};

let cachedIndex: { builtAt: number; index: PresentationFolderIndex } | null = null;
const INDEX_TTL_MS = 10 * 60 * 1000;

export function normalizePresentationCompanyLabel(raw: string): string {
  return normalizeCompanyLabel(
    String(raw || "")
      .replace(/簡報/g, "")
      .replace(/\s*[-–—]\s*.+$/, "")
      .replace(/\(主提案\)/g, ""),
  );
}

/** 簡報檔名：1.公司簡報.pdf、10同心企業有限公司簡報.pdf */
export function parsePresentationFilename(name: string): { order: number | null; label: string } | null {
  const base = String(name || "")
    .replace(/\.(pdf|pptx?)$/i, "")
    .trim();
  if (!base) return null;

  const fromReview = parseReviewPdfFilename(name);
  if (fromReview) {
    return { order: fromReview.order, label: fromReview.label };
  }

  const direct = base.match(/^(\d+)([^.\d].+)$/);
  if (direct) {
    const order = Number(direct[1]);
    const label = direct[2]?.trim() || "";
    if (Number.isInteger(order) && order > 0 && label) {
      return { order, label };
    }
  }

  return { order: null, label: base };
}

async function listMeetingSubfolders(): Promise<Map<ReviewMeetingDate, string>> {
  const drive = await getDriveSaClient();
  const res = await withGoogleApiRetry("presentation.listRoot", () =>
    drive.files.list({
      q: `'${PRESENTATION_ROOT_FOLDER_ID}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id,name)",
      pageSize: 20,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  );

  const out = new Map<ReviewMeetingDate, string>();
  for (const file of res.data.files ?? []) {
    const name = String(file.name || "").trim();
    const id = String(file.id || "").trim();
    if (id && isReviewMeetingDate(name)) {
      out.set(name, id);
    }
  }
  return out;
}

async function listFolderPresentationFiles(folderId: string): Promise<DrivePresentationFile[]> {
  const drive = await getDriveSaClient();
  const res = await withGoogleApiRetry(`presentation.list.${folderId}`, () =>
    drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (mimeType='application/pdf' or mimeType='application/vnd.google-apps.presentation')`,
      fields: "files(id,name)",
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  );

  const out: DrivePresentationFile[] = [];
  for (const file of res.data.files ?? []) {
    const id = String(file.id || "").trim();
    const name = String(file.name || "").trim();
    if (!id || !name) continue;
    const parsed = parsePresentationFilename(name);
    if (!parsed) continue;
    out.push({ id, name, order: parsed.order, label: parsed.label });
  }
  return out;
}

export async function buildPresentationFolderIndex(force = false): Promise<PresentationFolderIndex> {
  const now = Date.now();
  if (!force && cachedIndex && now - cachedIndex.builtAt < INDEX_TTL_MS) {
    return cachedIndex.index;
  }

  const byMeetingOrder: Record<string, string> = {};
  const byMeetingCompany: Record<string, string> = {};
  const meetingFolders = await listMeetingSubfolders();

  for (const [meetingDate, folderId] of meetingFolders.entries()) {
    const files = await listFolderPresentationFiles(folderId);
    for (const file of files) {
      if (file.order != null) {
        byMeetingOrder[`${meetingDate}:${file.order}`] = file.id;
      }
      const companyKey = normalizePresentationCompanyLabel(file.label);
      if (companyKey) {
        byMeetingCompany[`${meetingDate}:${companyKey}`] = file.id;
      }
    }
  }

  const index = { byMeetingOrder, byMeetingCompany };
  cachedIndex = { builtAt: now, index };
  return index;
}

export async function resolvePresentationPdfFileId(input: {
  reviewMeetingDate?: string | null;
  reviewAgendaOrder?: number | null;
  title?: string | null;
  companyName?: string | null;
  index?: PresentationFolderIndex | null;
}): Promise<string | null> {
  let meetingDate = input.reviewMeetingDate;
  let agendaOrder = input.reviewAgendaOrder;

  if (!isReviewMeetingDate(String(meetingDate || "")) || agendaOrder == null) {
    const hit = matchApplicationToAgenda({
      title: input.title ?? null,
      companyName: input.companyName ?? null,
    });
    if (!hit) return null;
    meetingDate = hit.meetingDate;
    agendaOrder = hit.order;
  }

  if (!isReviewMeetingDate(String(meetingDate || "")) || agendaOrder == null) {
    return null;
  }

  const meeting = meetingDate as ReviewMeetingDate;
  const index = input.index ?? (await buildPresentationFolderIndex());

  const fromOrder = index.byMeetingOrder[`${meeting}:${agendaOrder}`];
  if (fromOrder) return fromOrder;

  const companyNorm = normalizePresentationCompanyLabel(input.companyName || "");
  if (companyNorm) {
    const fromCompany = index.byMeetingCompany[`${meeting}:${companyNorm}`];
    if (fromCompany) return fromCompany;

    for (const [key, fileId] of Object.entries(index.byMeetingCompany)) {
      if (!key.startsWith(`${meeting}:`)) continue;
      const label = key.slice(meeting.length + 1);
      if (label.includes(companyNorm) || companyNorm.includes(label)) {
        return fileId;
      }
    }
  }

  return null;
}
