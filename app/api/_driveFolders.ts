import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]/authOptions";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "./_driveOauth";

type DriveClient = ReturnType<typeof getDriveOauthClient>;

function sanitizeFolderName(input: string) {
  const raw = String(input || "").trim();
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "未命名計畫";
}

function safeUserKeyFromSession(session: Awaited<ReturnType<typeof getServerSession>>) {
  const u = (session as { user?: { email?: string | null; name?: string | null } } | null)?.user;
  const raw = (u?.email || u?.name || "anonymous").toString().trim();
  if (!raw) return "anonymous";
  return raw
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

async function ensureFolderByName(opts: {
  drive: DriveClient;
  parentId: string;
  name: string;
}) {
  const { drive, parentId } = opts;
  const name = sanitizeFolderName(opts.name);
  const q = [
    `'${parentId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${name.replace(/'/g, "\\'")}'`,
  ].join(" and ");

  const found = await drive.files.list({
    q,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
    pageSize: 1,
  });

  const existing = found.data.files?.[0];
  if (existing?.id) return { id: existing.id, name: existing.name ?? name };

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id,name",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("Failed to create folder in Drive");
  return { id: created.data.id, name: created.data.name ?? name };
}

export async function getDriveAndSession() {
  const session = await getServerSession(authOptions);
  const drive = getDriveOauthClient();
  return { drive, session };
}

export async function ensureUserFolder(drive: DriveClient, session: Awaited<ReturnType<typeof getServerSession>>) {
  const userKey = safeUserKeyFromSession(session);
  const folder = await ensureFolderByName({ drive, parentId: DRIVE_FOLDER_ID, name: userKey });
  return { userKey, folderId: folder.id, folderName: folder.name };
}

export async function ensureProjectFolder(opts: {
  drive: DriveClient;
  userFolderId: string;
  projectName: string;
}) {
  const { drive, userFolderId } = opts;
  const projectFolderName = sanitizeFolderName(opts.projectName);
  const folder = await ensureFolderByName({ drive, parentId: userFolderId, name: projectFolderName });
  return { folderId: folder.id, folderName: folder.name };
}

export function emailHashKey(email: string) {
  return crypto.createHash("sha256").update(String(email || "")).digest("hex").slice(0, 32);
}

