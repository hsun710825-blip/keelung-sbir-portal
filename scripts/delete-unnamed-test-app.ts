#!/usr/bin/env npx tsx
import { deleteUnnamedTestApplications } from "@/lib/settlementTable";
import { prisma } from "@/lib/prisma";

async function main() {
  const deleted = await deleteUnnamedTestApplications();
  console.log(JSON.stringify({ ok: true, deletedApplications: deleted }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
