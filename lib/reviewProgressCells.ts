export type ReviewProgressCell = {
  score: number | null;
  status: string;
  comment: string | null;
  hasData: boolean;
};

export type ReviewProgressEvalEntry = {
  score: number;
  status: string;
  comment: string | null;
};

export function getReviewProgressCell(
  evalMap: Record<string, ReviewProgressEvalEntry>,
  committeeId: string,
  applicationId: string,
  sessionStatus: string,
): ReviewProgressCell {
  const ev = evalMap[`${committeeId}:${applicationId}`];
  if (!ev) {
    return { score: null, status: "NONE", comment: null, hasData: false };
  }
  const status =
    String(sessionStatus).toUpperCase() === "LOCKED_BY_PO"
      ? "LOCKED"
      : String(ev.status || "DRAFT").toUpperCase();
  return {
    score: ev.score,
    status,
    comment: ev.comment,
    hasData: true,
  };
}
