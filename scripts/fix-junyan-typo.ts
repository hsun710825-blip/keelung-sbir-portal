import {
  fixJunYanCompanyNameTypos,
  importSettlementFromReferenceJson,
} from "@/lib/importSettlementFromReference";
import { prisma } from "@/lib/prisma";

async function main() {
  const fixed = await fixJunYanCompanyNameTypos();
  console.log(`Fixed 浚沿→浚研 on ${fixed} application(s).`);
  const result = await importSettlementFromReferenceJson();
  console.log(`Settlement import: matched ${result.matched}.`);
  if (result.unmatched.length > 0) {
    console.warn("Unmatched:");
    for (const line of result.unmatched) console.warn(`  - ${line}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
