#!/usr/bin/env npx tsx
/**
 * 清空所有委員評分測試資料（Evaluation + ApplicationScore + CommitteeReviewSession）
 */
import { prisma } from "@/lib/prisma";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";

async function main() {
  await ensureEvaluationSchema();

  const [evaluations, scores, sessions] = await Promise.all([
    prisma.evaluation.deleteMany({}),
    prisma.applicationScore.deleteMany({}),
    prisma.committeeReviewSession.deleteMany({}),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        deleted: {
          evaluations: evaluations.count,
          applicationScores: scores.count,
          committeeReviewSessions: sessions.count,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
