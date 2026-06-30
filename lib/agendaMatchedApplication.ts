import {
  getReviewMeetingConfig,
  isAgendaJointProposal,
  type AgendaCase,
  type ReviewMeetingDate,
} from "@/lib/reviewMeetingAgenda";
import { matchApplicationToAgenda } from "@/lib/matchApplicationToAgenda";

export type ResolvedAgendaPlacement = {
  meetingDate: ReviewMeetingDate;
  agendaOrder: number;
  agendaCase: AgendaCase;
  isJoint: boolean;
};

/** 案件是否可對應現行議程（0622 + 0701）；無法對應者僅自委員／決算清表隱藏。 */
export function resolveAgendaPlacement(input: {
  title: string | null;
  companyName?: string | null;
}): ResolvedAgendaPlacement | null {
  const hit = matchApplicationToAgenda({
    title: input.title,
    companyName: input.companyName,
  });
  if (!hit) return null;

  const config = getReviewMeetingConfig(hit.meetingDate);
  const agendaCase = config.cases.find((c) => c.order === hit.order);
  if (!agendaCase) return null;

  return {
    meetingDate: hit.meetingDate,
    agendaOrder: hit.order,
    agendaCase,
    isJoint: isAgendaJointProposal(agendaCase),
  };
}

export function isOnCurrentAgenda(input: {
  title: string | null;
  companyName?: string | null;
}): boolean {
  return resolveAgendaPlacement(input) != null;
}
