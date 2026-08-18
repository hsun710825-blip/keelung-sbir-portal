/**
 * 重跑「修改清單自動初核」（業者上傳當下失敗時可手動補做）。
 *
 * 用法：
 *   npx tsx --env-file=.env --env-file=.env.local scripts/rerun-revision-checklist-compare.ts \
 *     --company "三奇壹號咖啡店" --file-id 1ELXowjXwFaaG-hs4noKwhM3uU6HAzMmI
 *
 * 可重複給多組 --company/--file-id，順序需成對。
 */
import { compareRevisionPdfAndNotify } from "@/lib/revisionChecklistCompare";
import { googleDriveFileViewUrl } from "@/lib/driveLinks";

function collectArgs(flag: string): string[] {
  const out: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag && argv[i + 1]) out.push(argv[i + 1]);
  }
  return out;
}

async function main() {
  const companies = collectArgs("--company");
  const fileIds = collectArgs("--file-id");
  if (!companies.length || companies.length !== fileIds.length) {
    console.error("需成對提供 --company 與 --file-id");
    process.exit(1);
  }

  for (let i = 0; i < companies.length; i++) {
    const companyName = companies[i];
    const fileId = fileIds[i];
    console.log(`[rerun] ${companyName} (${fileId})`);
    try {
      await compareRevisionPdfAndNotify({
        companyName,
        fileId,
        fileUrl: googleDriveFileViewUrl(fileId) || undefined,
      });
      console.log(`[rerun] ${companyName} 完成，已推播 LINE`);
    } catch (err) {
      console.error(
        `[rerun] ${companyName} 失敗：`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

void main();
