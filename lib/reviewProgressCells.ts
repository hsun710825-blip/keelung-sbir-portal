export type ReviewProgressCell = {
  score: number | null;
  status: string;
  comment: string | null;
  hasData: boolean;
};

export function getReviewProgressCell(
  evalMap: Map<string, { score: number; status: string; comment: string | null }>,
  committeeId: string,
  applicationId: string,
  sessionStatus: string,
): ReviewProgressCell {
  const ev = evalMap.get(`${committeeId}:${applicationId}`);
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
