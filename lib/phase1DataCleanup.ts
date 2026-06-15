import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ApplicationStatus, Prisma, Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const PHASE1_KEEP_STATUS = ApplicationStatus.PRE_REVIEW_PASSED;
export const BACKUP_DIR = path.join(process.cwd(), "backup_data");

const DELETE_WHERE: Prisma.ApplicationWhereInput = {
  status: { not: PHASE1_KEEP_STATUS },
};

export type Phase1BackupManifest = {
  version: 1;
  exportedAt: string;
  keepStatus: ApplicationStatus;
  deleteStatusFilter: "status != PRE_REVIEW_PASSED";
  counts: {
    applications: number;
    users: number;
    attachments: number;
    statusHistory: number;
    evaluations: number;
    applicationScores: number;
    emailNotifications: number;
  };
  files: {
    applications: string;
    users: string;
  };
  checksums: {
    applicationsSha256: string;
    usersSha256: string;
  };
};

function serializeJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Date) return v.toISOString();
      return v;
    },
    2,
  );
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function exportPhase1Backup(): Promise<{
  manifestPath: string;
  manifest: Phase1BackupManifest;
}> {
  await mkdir(BACKUP_DIR, { recursive: true });

  const applications = await prisma.application.findMany({
    where: DELETE_WHERE,
    include: {
      applicant: true,
      attachments: true,
      statusHistory: true,
      evaluations: true,
      scores: true,
      emailLogs: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const applicantIds = [...new Set(applications.map((a) => a.applicantUserId))];
  const users =
    applicantIds.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { in: applicantIds },
            role: Role.USER,
          },
        })
      : [];

  const applicationsJson = serializeJson(applications);
  const usersJson = serializeJson(users);
  const applicationsFile = path.join(BACKUP_DIR, "applications-non-pre-review-passed.json");
  const usersFile = path.join(BACKUP_DIR, "users-linked-to-deleted-applications.json");

  await writeFile(applicationsFile, applicationsJson, "utf8");
  await writeFile(usersFile, usersJson, "utf8");

  const manifest: Phase1BackupManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    keepStatus: PHASE1_KEEP_STATUS,
    deleteStatusFilter: "status != PRE_REVIEW_PASSED",
    counts: {
      applications: applications.length,
      users: users.length,
      attachments: applications.reduce((n, a) => n + a.attachments.length, 0),
      statusHistory: applications.reduce((n, a) => n + a.statusHistory.length, 0),
      evaluations: applications.reduce((n, a) => n + a.evaluations.length, 0),
      applicationScores: applications.reduce((n, a) => n + a.scores.length, 0),
      emailNotifications: applications.reduce((n, a) => n + a.emailLogs.length, 0),
    },
    files: {
      applications: path.basename(applicationsFile),
      users: path.basename(usersFile),
    },
    checksums: {
      applicationsSha256: sha256(applicationsJson),
      usersSha256: sha256(usersJson),
    },
  };

  const manifestPath = path.join(BACKUP_DIR, "manifest.json");
  await writeFile(manifestPath, serializeJson(manifest), "utf8");

  return { manifestPath, manifest };
}

export async function verifyPhase1Backup(): Promise<{
  ok: boolean;
  manifest: Phase1BackupManifest | null;
  errors: string[];
}> {
  const errors: string[] = [];
  const manifestPath = path.join(BACKUP_DIR, "manifest.json");

  let manifest: Phase1BackupManifest;
  try {
    const raw = await readFile(manifestPath, "utf8");
    manifest = JSON.parse(raw) as Phase1BackupManifest;
  } catch {
    return { ok: false, manifest: null, errors: ["找不到或無法讀取 backup_data/manifest.json"] };
  }

  const applicationsPath = path.join(BACKUP_DIR, manifest.files.applications);
  const usersPath = path.join(BACKUP_DIR, manifest.files.users);

  let applicationsRaw = "";
  let usersRaw = "";
  try {
    applicationsRaw = await readFile(applicationsPath, "utf8");
    usersRaw = await readFile(usersPath, "utf8");
  } catch {
    errors.push("備份 JSON 檔案不存在或無法讀取");
    return { ok: false, manifest, errors };
  }

  if (sha256(applicationsRaw) !== manifest.checksums.applicationsSha256) {
    errors.push("applications 備份檔 checksum 不符");
  }
  if (sha256(usersRaw) !== manifest.checksums.usersSha256) {
    errors.push("users 備份檔 checksum 不符");
  }

  let applicationsParsed: unknown[] = [];
  let usersParsed: unknown[] = [];
  try {
    applicationsParsed = JSON.parse(applicationsRaw) as unknown[];
    usersParsed = JSON.parse(usersRaw) as unknown[];
  } catch {
    errors.push("備份 JSON 格式無法解析");
    return { ok: false, manifest, errors };
  }

  if (applicationsParsed.length !== manifest.counts.applications) {
    errors.push(
      `applications 筆數不符：manifest ${manifest.counts.applications} vs 檔案 ${applicationsParsed.length}`,
    );
  }
  if (usersParsed.length !== manifest.counts.users) {
    errors.push(`users 筆數不符：manifest ${manifest.counts.users} vs 檔案 ${usersParsed.length}`);
  }

  const currentDeleteCount = await prisma.application.count({ where: DELETE_WHERE });
  if (currentDeleteCount !== manifest.counts.applications) {
    errors.push(
      `資料庫待刪案件數已變更：備份時 ${manifest.counts.applications}，目前 ${currentDeleteCount}`,
    );
  }

  return { ok: errors.length === 0, manifest, errors };
}

export async function executePhase1Delete(): Promise<{
  deletedApplications: number;
  deletedUsers: number;
}> {
  const verification = await verifyPhase1Backup();
  if (!verification.ok || !verification.manifest) {
    throw new Error(`備份驗證未通過，已中止刪除：${verification.errors.join("；")}`);
  }

  const deleteResult = await prisma.application.deleteMany({
    where: DELETE_WHERE,
  });

  const orphanUsers = await prisma.user.findMany({
    where: {
      role: Role.USER,
      applications: { none: {} },
    },
    select: { id: true },
  });

  const userDelete =
    orphanUsers.length > 0
      ? await prisma.user.deleteMany({
          where: { id: { in: orphanUsers.map((u) => u.id) } },
        })
      : { count: 0 };

  return {
    deletedApplications: deleteResult.count,
    deletedUsers: userDelete.count,
  };
}
