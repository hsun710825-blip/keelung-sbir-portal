import { getDriveSaClient } from "@/app/api/_driveSa";
import { withGoogleApiRetry } from "@/app/api/_googleApiRetry";
import { matchApplicationToAgenda } from "@/lib/matchApplicationToAgenda";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";
import { isReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

/** PO 整理之審查完整版（含補件）PDF 資料夾 */
export const REVIEW_COMPLETE_PDF_FOLDERS: Record<ReviewMeetingDate, string> = {
  "0622": "1ukleN89nQcHBbdiif6rY96jUCUawHw2X",
  "0701": "1GZSjiOmz0XEXmGjQ25UfMkUDni_ArMH6",
};

export type ReviewFolderPdfIndex = {
  byMeetingOrder: Map<string, string>;
  byMeetingCompany: Map<string, string>;
};

type DrivePdfFile = {
  id: string;
  name: string;
  order: number;
  label: string;
};

let cachedIndex: { builtAt: number; index: ReviewFolderPdfIndex } | null = null;
const INDEX_TTL_MS = 10 * 60 * 1000;

function normalizeCompanyLabel(raw: string): string {
  return String(raw || "")
    .replace(/\.pdf$/i, "")
    .replace(/\(主提案\)/g, "")
    .split("/")[0]
    .split("暨")[0]
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

export function parseReviewPdfFilename(name: string): { order: number; label: string } | null {
  const base = String(name || "")
    .replace(/\.pdf$/i, "")
    .trim();
  const patterns = [/^(\d+)\s*[-.。．]\s*(.+)$/, /^(\d+)\.(.+)$/, /^(\d+)\s+(.+)$/];
  for (const pattern of patterns) {
    const hit = base.match(pattern);
    if (!hit) continue;
    const order = Number(hit[1]);
    const label = hit[2]?.trim() || "";
    if (Number.isInteger(order) && order > 0 && label) {
      return { order, label };
    }
  }
  return null;
}

async function listFolderPdfFiles(folderId: string): Promise<DrivePdfFile[]> {
  const drive = await getDriveSaClient();
  const res = await withGoogleApiRetry(`reviewPdf.list.${folderId}`, () =>
    drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`,
      fields: "files(id,name)",
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  );
  const out: DrivePdfFile[] = [];
  for (const file of res.data.files ?? []) {
    const id = String(file.id || "").trim();
    const name = String(file.name || "").trim();
    if (!id || !name) continue;
    const parsed = parseReviewPdfFilename(name);
    if (!parsed) continue;
    out.push({ id, name, order: parsed.order, label: parsed.label });
  }
  return out;
}

export async function buildReviewFolderPdfIndex(force = false): Promise<ReviewFolderPdfIndex> {
  const now = Date.now();
  if (!force && cachedIndex && now - cachedIndex.builtAt < INDEX_TTL_MS) {
    return cachedIndex.index;
  }

  const byMeetingOrder = new Map<string, string>();
  const byMeetingCompany = new Map<string, string>();

  for (const meetingDate of Object.keys(REVIEW_COMPLETE_PDF_FOLDERS) as ReviewMeetingDate[]) {
    const folderId = REVIEW_COMPLETE_PDF_FOLDERS[meetingDate];
    const files = await listFolderPdfFiles(folderId);
    for (const file of files) {
      byMeetingOrder.set(`${meetingDate}:${file.order}`, file.id);
      const companyKey = normalizeCompanyLabel(file.label);
      if (companyKey) {
        byMeetingCompany.set(`${meetingDate}:${companyKey}`, file.id);
      }
    }
  }

  const index = { byMeetingOrder, byMeetingCompany };
  cachedIndex = { builtAt: now, index };
  return index;
}

export async function resolveReviewCompleteProposalPdfFileId(input: {
  reviewMeetingDate?: string | null;
  reviewAgendaOrder?: number | null;
  title?: string | null;
  companyName?: string | null;
  index?: ReviewFolderPdfIndex | null;
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
  const index = input.index ?? (await buildReviewFolderPdfIndex());
  const orderKey = `${meeting}:${agendaOrder}`;
  const fromOrder = index.byMeetingOrder.get(orderKey);
  if (fromOrder) return fromOrder;

  const companyNorm = normalizeCompanyLabel(input.companyName || "");
  if (companyNorm) {
    const fromCompany = index.byMeetingCompany.get(`${meeting}:${companyNorm}`);
    if (fromCompany) return fromCompany;

    for (const [key, fileId] of index.byMeetingCompany.entries()) {
      if (!key.startsWith(`${meeting}:`)) continue;
      const label = key.slice(meeting.length + 1);
      if (label.includes(companyNorm) || companyNorm.includes(label)) {
        return fileId;
      }
    }
  }

  return null;
}
