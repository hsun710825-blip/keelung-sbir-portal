"use client";

import { useActionState, useEffect, useState } from "react";

import {
  saveCommitteeScoringAction,
  type CommitteeMeetingActionState,
} from "@/app/committee/meeting/[date]/actions";
import { CommitteeScoringForm } from "@/components/committee/CommitteeScoringForm";
import { CommitteeSubmitSuccessDialog } from "@/components/committee/CommitteeSubmitSuccessDialog";
import type { CommitteeScoreBreakdown } from "@/lib/committeeScoringRubric";

export function CommitteeScoringFormClient({
  applicationId,
  meetingDate,
  initialBreakdown,
  initialComment,
  readOnly,
  youthVerificationNote = null,
}: {
  applicationId: string;
  meetingDate: string;
  initialBreakdown: CommitteeScoreBreakdown | null;
  initialComment: string | null;
  readOnly?: boolean;
  youthVerificationNote?: string | null;
}) {
  const [state, action] = useActionState(saveCommitteeScoringAction, {} as CommitteeMeetingActionState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<
    CommitteeMeetingActionState["submitted"] | null
  >(null);

  useEffect(() => {
    if (state.submitted) {
      setSubmittedSnapshot(state.submitted);
      setDialogOpen(true);
    }
  }, [state.submitted]);

  return (
    <>
      <CommitteeScoringForm
        applicationId={applicationId}
        meetingDate={meetingDate}
        initialBreakdown={initialBreakdown}
        initialComment={initialComment}
        readOnly={readOnly}
        action={action}
        state={state}
        youthVerificationNote={youthVerificationNote}
      />

      {dialogOpen && submittedSnapshot ? (
        <CommitteeSubmitSuccessDialog
          planTitle={submittedSnapshot.planTitle}
          totalScore={submittedSnapshot.totalScore}
          meetingDate={submittedSnapshot.meetingDate}
          nextApplicationId={submittedSnapshot.nextApplicationId}
          onEditCurrent={() => setDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
