import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { DRIVE_FOLDER_ID, getDriveOauthClient } from "../../_driveOauth";

const SID_COOKIE = "sbir_sid";

function hashEmailKey(email: string) {
  return crypto.createHash("sha256").update(email).digest("hex").slice(0, 32);
}

function draftName(key: string) {
  return `draft-${key}.json`;
}

async function findDraftFileId(key: string) {
  const drive = getDriveOauthClient();
  const name = draftName(key);
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id || null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const jar = await cookies();
  const sid = jar.get(SID_COOKIE)?.value || null;
  const email = session.user.email || null;

  const emailKey = email ? hashEmailKey(email) : null;
  const sidKey = sid || null;

  const [emailFileId, sidFileId] = await Promise.all([
    emailKey ? findDraftFileId(emailKey) : Promise.resolve(null),
    sidKey ? findDraftFileId(sidKey) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ok: true,
    user: {
      hasSession: Boolean(session?.user),
      email: email,
    },
    keys: {
      emailKey,
      sidKey,
    },
    expectedFilenames: {
      email: emailKey ? draftName(emailKey) : null,
      sid: sidKey ? draftName(sidKey) : null,
    },
    foundOnDrive: {
      emailFileId,
      sidFileId,
    },
    driveFolderId: DRIVE_FOLDER_ID,
  });
}

