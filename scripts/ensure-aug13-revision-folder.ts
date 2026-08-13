/**
 * 確保修改版根資料夾下已有「8/13後重新修改」子資料夾。
 * 用法：npx tsx --env-file=.env --env-file=.env.local scripts/ensure-aug13-revision-folder.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const p = path.join(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = val;
      }
    }
  }
}
loadEnvFiles();

async function main() {
  const { getDriveOauthClient } = await import("../app/api/_driveOauth");
  const { APPLICANT_REVISION_AUG13_SUBFOLDER_NAME, APPLICANT_REVISION_UPLOAD_FOLDER_ID } =
    await import("../lib/applicantRevisionAccess");
  const { resolveApplicantRevisionUploadFolderId } = await import("../lib/applicantRevisionUpload");

  const drive = getDriveOauthClient();
  const id = await resolveApplicantRevisionUploadFolderId(drive);
  console.log(
    `OK parent=${APPLICANT_REVISION_UPLOAD_FOLDER_ID} subfolder="${APPLICANT_REVISION_AUG13_SUBFOLDER_NAME}" id=${id}`,
  );
  console.log(`https://drive.google.com/drive/folders/${id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
