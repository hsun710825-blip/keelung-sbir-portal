"use client";

import { useActionState } from "react";

import {
  lockCommitteeMeetingAction,
  type ReviewProgressActionState,
} from "@/app/admin/review-progress/actions";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

export function PoLockMeetingButton({
  meetingDate,
  committeeId,
  committeeLabel,
}: {
  meetingDate: ReviewMeetingDate;
  committeeId: string;
  committeeLabel: string;
}) {
  const [state, action, pending] = useActionState(lockCommitteeMeetingAction, {} as ReviewProgressActionState);
  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="meetingDate" value={meetingDate} />
      <input type="hidden" name="committeeId" value={committeeId} />
      {state.error ? <p className="mb-1 text-xs text-red-600">{state.error}</p> : null}
      {state.message ? <p className="mb-1 text-xs text-emerald-700">{state.message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        title={`鎖定 ${committeeLabel} 於此場次之編輯權限`}
        className="rounded border border-slate-400 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "…" : "鎖定編輯"}
      </button>
    </form>
  );
}
