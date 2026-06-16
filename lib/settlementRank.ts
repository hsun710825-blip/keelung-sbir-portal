/** 依平均分由高至低排序，同分跳號並列（1,2,3,3,5）。無分者排最後且無總排序。 */
export function sortRowsByAvgScoreDesc<T extends { avgScore: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aScore = a.avgScore;
    const bScore = b.avgScore;
    if (aScore == null && bScore == null) return 0;
    if (aScore == null) return 1;
    if (bScore == null) return -1;
    return bScore - aScore;
  });
}

export function assignSkipTieRanks<T extends { avgScore: number | null; overallRank: number | null }>(
  rows: T[],
): void {
  let position = 0;
  let rank = 0;
  let prevScore: number | null | undefined;

  for (const row of rows) {
    position += 1;
    if (row.avgScore == null) {
      row.overallRank = null;
      continue;
    }
    if (prevScore === undefined || row.avgScore !== prevScore) {
      rank = position;
      prevScore = row.avgScore;
    }
    row.overallRank = rank;
  }
}

export function avgCommitteeScore(scores: Array<number | null>): number | null {
  const nums = scores.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
