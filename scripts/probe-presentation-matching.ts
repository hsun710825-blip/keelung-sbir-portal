import { getDriveSaClient } from "../app/api/_driveSa";
import { getAllAgendaCases } from "../lib/reviewMeetingAgenda";
import {
  buildPresentationFolderIndex,
  normalizePresentationCompanyLabel,
  parsePresentationFilename,
  resolvePresentationPdfFileId,
} from "../lib/reviewPresentationPdf";

const MEETING_SUBFOLDERS: Record<string, string> = {
  "0622": "1XN1scw9ZkXatDG0XNmkKK0pbnl0vfp3R",
  "0701": "1uP8_tXW88D9WDy1YZ6M3tnvrVghImoWP",
};

async function listPdfs(folderId: string) {
  const drive = await getDriveSaClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`,
    fields: "files(id,name)",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files ?? [];
}

async function main() {
  const index = await buildPresentationFolderIndex(true);

  for (const [meeting, folderId] of Object.entries(MEETING_SUBFOLDERS)) {
    const files = await listPdfs(folderId);
    console.log(`\n=== ${meeting} (${files.length} files) ===`);
    for (const f of files) {
      const p = parsePresentationFilename(String(f.name || ""));
      console.log(`  [${p?.order ?? "?"}] ${f.name}`);
    }
  }

  console.log("\n=== MATCH REPORT ===");
  let ok = 0;
  let missing = 0;
  for (const row of getAllAgendaCases()) {
    const fileId = await resolvePresentationPdfFileId({
      reviewMeetingDate: row.meetingDate,
      reviewAgendaOrder: row.order,
      title: row.project,
      companyName: row.company,
      index,
    });
    const status = fileId ? "OK" : "MISSING (no file)";
    if (fileId) ok += 1;
    else missing += 1;
    const companyKey = normalizePresentationCompanyLabel(row.company);
    console.log(`${row.meetingDate} #${String(row.order).padStart(2, "0")} ${row.company} -> ${status}`);
    if (!fileId) console.log(`    agenda company key: ${companyKey}`);
  }
  console.log(`\nSUMMARY: matched ${ok}, missing ${missing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
