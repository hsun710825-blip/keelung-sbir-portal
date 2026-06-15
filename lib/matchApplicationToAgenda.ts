import { normalizePlanTitleForDedupe } from "@/lib/applicationDedupeKey";
import {
  getAllAgendaCases,
  type AgendaCase,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";

function normalizeForMatch(raw: string): string {
  return normalizePlanTitleForDedupe(
    String(raw || "")
      .replace(/[「」『』"']/g, "")
      .replace(/[|｜]/g, "|")
      .replace(/[：:]/g, ":")
      .replace(/[－—–-]/g, "-")
      .replace(/[（(]聯合案[）)]/g, "")
      .replace(/\(簡報\)/g, "")
      .trim(),
  );
}

function normalizeCompany(raw: string): string {
  return String(raw || "")
    .replace(/\(主提案\)/g, "")
    .split("/")[0]
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function scoreTitleMatch(appTitle: string, agendaProject: string): number {
  const a = normalizeForMatch(appTitle);
  const b = normalizeForMatch(agendaProject);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const aParts = a.split(/[\s:：|]+/).filter((p) => p.length >= 2);
  const bParts = b.split(/[\s:：|]+/).filter((p) => p.length >= 2);
  let hits = 0;
  for (const p of aParts) {
    if (b.includes(p)) hits += 1;
  }
  if (hits >= 3) return 60 + hits;
  return hits * 10;
}

export type AgendaMatch = {
  meetingDate: ReviewMeetingDate;
  order: number;
  agendaCase: AgendaCase;
  score: number;
};

export function matchApplicationToAgenda(input: {
  title: string | null;
  companyName?: string | null;
}): AgendaMatch | null {
  const title = input.title?.trim() || "";
  if (!title) return null;

  const companyNorm = input.companyName ? normalizeCompany(input.companyName) : "";
  let best: AgendaMatch | null = null;

  for (const row of getAllAgendaCases()) {
    let score = scoreTitleMatch(title, row.project);
    if (companyNorm) {
      const agendaCompany = normalizeCompany(row.company);
      if (agendaCompany && (agendaCompany.includes(companyNorm) || companyNorm.includes(agendaCompany))) {
        score += 15;
      }
    }
    if (!best || score > best.score) {
      best = {
        meetingDate: row.meetingDate,
        order: row.order,
        agendaCase: row,
        score,
      };
    }
  }

  if (!best || best.score < 50) return null;
  return best;
}
