import { importSettlementFromReferenceJson } from "@/lib/importSettlementFromReference";

async function main() {
  const result = await importSettlementFromReferenceJson();
  console.log(`Matched ${result.matched} applications.`);
  if (result.unmatched.length > 0) {
    console.warn("Unmatched rows:");
    for (const line of result.unmatched) console.warn(`  - ${line}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
