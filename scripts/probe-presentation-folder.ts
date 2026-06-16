import { getDriveSaClient } from "../app/api/_driveSa";

const FOLDER_ID = "1TaRpmHR1t8XeVa8UgfE4hTjcczdlwTOi";

async function main() {
  try {
    const drive = await getDriveSaClient();
    const meta = await drive.files.get({
      fileId: FOLDER_ID,
      fields: "id,name,mimeType,capabilities",
      supportsAllDrives: true,
    });
    console.log("FOLDER_META:", JSON.stringify(meta.data, null, 2));

    const list = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id,name,mimeType),nextPageToken",
      pageSize: 30,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = list.data.files ?? [];
    console.log("FILE_COUNT_SAMPLE:", files.length);
    console.log(
      "SAMPLE_FILES:",
      JSON.stringify(
        files.slice(0, 15).map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
        null,
        2,
      ),
    );
    console.log("ACCESS: OK");
  } catch (e) {
    const err = e as { message?: string; code?: number; errors?: unknown };
    console.log("ACCESS: FAILED");
    console.log("ERROR:", err.message || String(e));
    console.log("CODE:", err.code);
    if (err.errors) console.log("DETAILS:", JSON.stringify(err.errors));
    process.exit(1);
  }
}

main();
