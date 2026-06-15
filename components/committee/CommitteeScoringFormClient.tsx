"use client";

import { useActionState } from "react";

import {
  saveCommitteeScoringAction,
  type CommitteeMeetingActionState,
} from "@/app/committee/meeting/[date]/actions";
import { CommitteeScoringForm } from "@/components/committee/CommitteeScoringForm";
import type { CommitteeScoreBreakdown } from "@/lib/committeeScoringRubric";

export function CommitteeScoringFormClient({
  applicationId,
  meetingDate,
  initialBreakdown,
  initialComment,
  readOnly,
}: {
  applicationId: string;
  meetingDate: string;
  initialBreakdown: CommitteeScoreBreakdown | null;
  initialComment: string | null;
  readOnly?: boolean;
}) {
  const [state, action] = useActionState(saveCommitteeScoringAction, {} as CommitteeMeetingActionState);
  return (
    <CommitteeScoringForm
      applicationId={applicationId}
      meetingDate={meetingDate}
      initialBreakdown={initialBreakdown}
      initialComment={initialComment}
      readOnly={readOnly}
      action={action}
      state={state}
    />
  );
}
