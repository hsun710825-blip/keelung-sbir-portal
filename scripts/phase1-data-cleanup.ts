/**
 * 階段一：資料備份與清洗
 *
 * 用法：
 *   npx tsx scripts/phase1-data-cleanup.ts backup
 *   npx tsx scripts/phase1-data-cleanup.ts verify
 *   npx tsx scripts/phase1-data-cleanup.ts delete --confirm
 *
 * delete 必須先 backup + verify 通過，且加上 --confirm 才會執行。
 */
import {
  BACKUP_DIR,
  executePhase1Delete,
  exportPhase1Backup,
  verifyPhase1Backup,
} from "../lib/phase1DataCleanup";

async function main() {
  const command = process.argv[2] || "help";
  const confirm = process.argv.includes("--confirm");

  if (command === "backup") {
    const { manifestPath, manifest } = await exportPhase1Backup();
    console.log("✓ 備份完成");
    console.log(`  目錄：${BACKUP_DIR}`);
    console.log(`  manifest：${manifestPath}`);
    console.log(`  待刪案件：${manifest.counts.applications} 筆`);
    console.log(`  關聯申請帳號（USER）：${manifest.counts.users} 筆`);
    console.log(`  附件 metadata：${manifest.counts.attachments} 筆`);
    return;
  }

  if (command === "verify") {
    const result = await verifyPhase1Backup();
    if (result.ok) {
      console.log("✓ 備份驗證通過，可執行 delete --confirm");
      console.log(JSON.stringify(result.manifest?.counts, null, 2));
      return;
    }
    console.error("✗ 備份驗證失敗");
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (command === "delete") {
    if (!confirm) {
      console.error("刪除需加上 --confirm。例：npx tsx scripts/phase1-data-cleanup.ts delete --confirm");
      process.exit(1);
    }
    const result = await executePhase1Delete();
    console.log("✓ 刪除完成");
    console.log(`  已刪除案件：${result.deletedApplications} 筆`);
    console.log(`  已刪除孤立申請帳號（USER）：${result.deletedUsers} 筆`);
    return;
  }

  console.log(`階段一資料清洗腳本

指令：
  backup          匯出非 PRE_REVIEW_PASSED 案件至 backup_data/
  verify          驗證備份完整性
  delete --confirm  驗證通過後刪除（需先 backup）

保留狀態：PRE_REVIEW_PASSED（初審通過）`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
