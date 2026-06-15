#!/usr/bin/env npx tsx
import { assignReviewMeetingsFromAgenda } from "@/lib/committeeMeetingApplications";
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await assignReviewMeetingsFromAgenda();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
