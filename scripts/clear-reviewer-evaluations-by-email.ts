#!/usr/bin/env npx tsx
/**
 * 清除指定委員帳號的評分資料（保留帳號與角色）
 * 用法：npx tsx --env-file=.env --env-file=.env.local scripts/clear-reviewer-evaluations-by-email.ts
 */
import { clearReviewerScoresByEmails } from "@/lib/deleteReviewerUser";
import { ensureEvaluationSchema } from "@/lib/ensureEvaluationSchema";
import { prisma } from "@/lib/prisma";

const TEST_REVIEWER_EMAILS = [
  "hsunbarba@gmail.com",
  "fan25120607@gmail.com",
  "c0918123@gmail.com",
];

async function main() {
  await ensureEvaluationSchema();
  const result = await clearReviewerScoresByEmails(TEST_REVIEWER_EMAILS);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
