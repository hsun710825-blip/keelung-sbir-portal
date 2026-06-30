import { Prisma } from "@prisma/client";

import { ensureYouthVerificationSchema } from "@/lib/ensureYouthVerificationSchema";
import { prisma } from "@/lib/prisma";
import type { YouthResponsiblePerson } from "@/lib/youthId/types";

export type StoredYouthPerson = {
  applicationId: string;
  personIndex: number;
  responsibleName: string | null;
  registeredCity: string | null;
  age: number | null;
  qualifies: boolean | null;
  poSaved: boolean;
  sourceDriveFileId: string | null;
  ocrRocBirthYear: number | null;
};

export async function loadStoredYouthPersons(
  applicationIds: string[],
): Promise<Map<string, StoredYouthPerson[]>> {
  if (applicationIds.length === 0) return new Map();
  await ensureYouthVerificationSchema();

  const rows = await prisma.$queryRaw<
    Array<{
      applicationId: string;
      personIndex: number;
      responsibleName: string | null;
      registeredCity: string | null;
      age: number | null;
      qualifies: boolean | null;
      poSaved: boolean;
      sourceDriveFileId: string | null;
      ocrRocBirthYear: number | null;
    }>
  >`
    SELECT "applicationId", "personIndex", "responsibleName", "registeredCity", "age", "qualifies",
           "poSaved", "sourceDriveFileId", "ocrRocBirthYear"
    FROM "YouthVerificationPerson"
    WHERE "applicationId" IN (${Prisma.join(applicationIds)})
    ORDER BY "applicationId", "personIndex"
  `;

  const out = new Map<string, StoredYouthPerson[]>();
  for (const row of rows) {
    const list = out.get(row.applicationId) ?? [];
    list.push({
      applicationId: row.applicationId,
      personIndex: row.personIndex,
      responsibleName: row.responsibleName,
      registeredCity: row.registeredCity,
      age: row.age,
      qualifies: row.qualifies,
      poSaved: row.poSaved,
      sourceDriveFileId: row.sourceDriveFileId,
      ocrRocBirthYear: row.ocrRocBirthYear,
    });
    out.set(row.applicationId, list);
  }
  return out;
}

export async function upsertOcrYouthPerson(
  applicationId: string,
  personIndex: number,
  driveFileId: string,
  data: {
    responsibleName: string | null;
    registeredCity: string | null;
    age: number | null;
    qualifies: boolean | null;
    ocrRocBirthYear: number | null;
  },
): Promise<void> {
  await ensureYouthVerificationSchema();
  await prisma.$executeRaw`
    INSERT INTO "YouthVerificationPerson" (
      "applicationId", "personIndex", "responsibleName", "registeredCity", "age", "qualifies",
      "poSaved", "sourceDriveFileId", "ocrRocBirthYear", "ocrAt", "updatedAt"
    ) VALUES (
      ${applicationId}, ${personIndex}, ${data.responsibleName}, ${data.registeredCity}, ${data.age},
      ${data.qualifies}, false, ${driveFileId}, ${data.ocrRocBirthYear}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("applicationId", "personIndex") DO UPDATE SET
      "responsibleName" = CASE WHEN "YouthVerificationPerson"."poSaved" THEN "YouthVerificationPerson"."responsibleName" ELSE EXCLUDED."responsibleName" END,
      "registeredCity" = CASE WHEN "YouthVerificationPerson"."poSaved" THEN "YouthVerificationPerson"."registeredCity" ELSE EXCLUDED."registeredCity" END,
      "age" = CASE WHEN "YouthVerificationPerson"."poSaved" THEN "YouthVerificationPerson"."age" ELSE EXCLUDED."age" END,
      "qualifies" = CASE WHEN "YouthVerificationPerson"."poSaved" THEN "YouthVerificationPerson"."qualifies" ELSE EXCLUDED."qualifies" END,
      "sourceDriveFileId" = EXCLUDED."sourceDriveFileId",
      "ocrRocBirthYear" = EXCLUDED."ocrRocBirthYear",
      "ocrAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function savePoYouthPerson(
  applicationId: string,
  personIndex: number,
  data: {
    responsibleName: string | null;
    registeredCity: string | null;
    age: number | null;
    qualifies: boolean | null;
    sourceDriveFileId: string | null;
  },
): Promise<void> {
  await ensureYouthVerificationSchema();
  await prisma.$executeRaw`
    INSERT INTO "YouthVerificationPerson" (
      "applicationId", "personIndex", "responsibleName", "registeredCity", "age", "qualifies",
      "poSaved", "sourceDriveFileId", "updatedAt"
    ) VALUES (
      ${applicationId}, ${personIndex}, ${data.responsibleName}, ${data.registeredCity}, ${data.age},
      ${data.qualifies}, true, ${data.sourceDriveFileId}, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("applicationId", "personIndex") DO UPDATE SET
      "responsibleName" = EXCLUDED."responsibleName",
      "registeredCity" = EXCLUDED."registeredCity",
      "age" = EXCLUDED."age",
      "qualifies" = EXCLUDED."qualifies",
      "poSaved" = true,
      "sourceDriveFileId" = EXCLUDED."sourceDriveFileId",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export function mergeStoredIntoPerson(
  person: YouthResponsiblePerson,
  stored: StoredYouthPerson | undefined,
  personIndex: number,
): YouthResponsiblePerson & { personIndex: number; poSaved: boolean; ocrReadError: string | null } {
  const base = {
    ...person,
    personIndex,
    poSaved: stored?.poSaved ?? false,
    ocrReadError: null as string | null,
  };
  if (stored?.poSaved) {
    return {
      ...base,
      responsibleName: stored.responsibleName ?? person.responsibleName,
      registeredCity: stored.registeredCity,
      age: stored.age,
      qualifies: stored.qualifies,
    };
  }
  if (stored && !stored.poSaved) {
    return {
      ...base,
      responsibleName: stored.responsibleName ?? person.responsibleName,
      registeredCity: stored.registeredCity ?? person.registeredCity,
      age: stored.age ?? person.age,
      qualifies: stored.qualifies ?? person.qualifies,
    };
  }
  return base;
}
