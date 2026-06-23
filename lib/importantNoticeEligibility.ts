import type { AgendaMatch } from "@/lib/matchApplicationToAgenda";

export function canSelectImportantNoticeStatus(
  agendaMatch: AgendaMatch | null,
  currentStatus: string,
): boolean {
  return agendaMatch != null || currentStatus === "IMPORTANT_NOTICE";
}
