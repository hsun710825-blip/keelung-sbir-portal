import { pickRegistryFieldsFromFormData } from "@/app/api/_registrySheet";
import { extractFormDataFromDraftPayload, resolveApplicationDisplayFields } from "@/lib/resolveApplicationDisplayFields";
import { prisma } from "@/lib/prisma";
import { getCachedYouthIdSheetRows } from "@/lib/cachedYouthIdSheet";
import { loadSettlementRowsForExport } from "@/lib/settlementTable";
import {
  findSheetRowForCompanyName,
  youthCompanyCoreMatch,
} from "@/lib/youthId/companyMatch";
import { resolveJointSheetCompanyTargets } from "@/lib/youthId/jointMapping";
import { ocrIdCardFromDriveFile } from "@/lib/youthId/idOcr";
import {
  loadStoredYouthPersons,
  mergeStoredIntoPerson,
  type StoredYouthPerson,
  upsertOcrYouthPerson,
} from "@/lib/youthId/persistence";
import type {
  YouthDriveFile,
  YouthResponsiblePerson,
  YouthSheetRow,
  YouthVerificationRow,
  YouthVerificationTable,
} from "@/lib/youthId/types";

export type YouthPersonDisplay = YouthResponsiblePerson & {
  personIndex: number;
  poSaved: boolean;
  ocrReadError: string | null;
};

async function loadResponsibleNamesByAppId(applicationIds: string[]): Promise<Map<string, string>> {
  const apps = await prisma.application.findMany({
    where: { id: { in: applicationIds } },
    select: { id: true, description: true, submissionMode: true },
  });
  const out = new Map<string, string>();
  for (const app of apps) {
    let name = "";
    if (app.submissionMode === "ONLINE") {
      const { resolveOnlineDraftViewPayload } = await import("@/lib/adminOnlineDraftResolve");
      const draft = await resolveOnlineDraftViewPayload(app.id).catch(() => null);
      const formData = extractFormDataFromDraftPayload(draft as Record<string, unknown> | null);
      name = pickRegistryFieldsFromFormData(formData).responsiblePerson;
    }
    if (!name && app.description) {
      const { parseKeyValueDescription } = await import("@/lib/parseMigratedDescription");
      const parsed = parseKeyValueDescription(app.description);
      name = String(parsed["負責人"] || "").trim();
    }
    if (name) out.set(app.id, name);
  }
  return out;
}

function driveFileFromSheetRow(sheetRow: YouthSheetRow): YouthDriveFile | null {
  if (!sheetRow.uploadDriveFileId) return null;
  return {
    id: sheetRow.uploadDriveFileId,
    name: sheetRow.companyName,
    mimeType: "application/octet-stream",
  };
}

function buildBasePerson(
  sheetCompanyName: string | null,
  sheetRow: YouthSheetRow | null,
  fallbackName: string | null,
): YouthResponsiblePerson {
  return {
    sheetCompanyName,
    responsibleName: fallbackName,
    registeredCity: null,
    age: null,
    qualifies: null,
    driveFile: sheetRow ? driveFileFromSheetRow(sheetRow) : null,
  };
}

async function resolvePersonData(
  applicationId: string,
  personIndex: number,
  person: YouthResponsiblePerson,
  stored: StoredYouthPerson | undefined,
  runOcr: boolean,
): Promise<YouthPersonDisplay> {
  const driveId = person.driveFile?.id ?? null;

  if (stored?.poSaved) {
    return mergeStoredIntoPerson(person, stored, personIndex);
  }

  if (
    stored &&
    driveId &&
    stored.sourceDriveFileId === driveId &&
    (stored.age != null || stored.registeredCity != null || stored.qualifies != null)
  ) {
    return mergeStoredIntoPerson(person, stored, personIndex);
  }

  if (!runOcr || !driveId) {
    return {
      ...mergeStoredIntoPerson(person, stored, personIndex),
      ocrReadError: driveId ? null : "試算表無證件連結",
    };
  }

  const ocr = await ocrIdCardFromDriveFile(driveId);
  await upsertOcrYouthPerson(applicationId, personIndex, driveId, {
    responsibleName: person.responsibleName,
    registeredCity: ocr.registeredCity,
    age: ocr.age,
    qualifies: ocr.qualifies,
    ocrRocBirthYear: ocr.rocBirthYear,
  });

  return {
    ...person,
    personIndex,
    poSaved: false,
    registeredCity: ocr.registeredCity,
    age: ocr.age,
    qualifies: ocr.qualifies,
    ocrReadError: ocr.readError,
  };
}

export async function loadYouthVerificationTable(options?: {
  runOcr?: boolean;
}): Promise<YouthVerificationTable> {
  const runOcr = options?.runOcr ?? false;
  const sheetRows = (await getCachedYouthIdSheetRows()).rows;
  const settlementExport = await loadSettlementRowsForExport();
  const settlementRows = settlementExport.combinedRows;
  const usedSheet = new Set<YouthSheetRow>();
  const applicationIds = settlementRows.map((r) => r.applicationId);
  const [responsibleByApp, storedMap] = await Promise.all([
    loadResponsibleNamesByAppId(applicationIds),
    loadStoredYouthPersons(applicationIds),
  ]);

  const rows: YouthVerificationRow[] = [];

  for (const sRow of settlementRows) {
    const targets = resolveJointSheetCompanyTargets(sRow.companyName, sRow.title, sRow.isJoint);
    const persons: YouthPersonDisplay[] = [];
    const warnings: string[] = [];

    for (let personIndex = 0; personIndex < targets.length; personIndex++) {
      const target = targets[personIndex];
      const matched = findSheetRowForCompanyName(target, sheetRows, usedSheet);
      const fallbackName =
        targets.length === 1
          ? responsibleByApp.get(sRow.applicationId) ?? null
          : personIndex === 0
            ? responsibleByApp.get(sRow.applicationId) ?? null
            : null;

      if (!matched) {
        warnings.push(`試算表無對應資料：${target}`);
        const base = buildBasePerson(null, null, fallbackName);
        const stored = storedMap.get(sRow.applicationId)?.find((p) => p.personIndex === personIndex);
        persons.push(await resolvePersonData(sRow.applicationId, personIndex, base, stored, runOcr));
        continue;
      }

      usedSheet.add(matched);
      if (!matched.uploadDriveFileId) {
        warnings.push(`${matched.companyName}：試算表無證件連結`);
      }

      const base = buildBasePerson(matched.companyName, matched, fallbackName);
      const stored = storedMap.get(sRow.applicationId)?.find((p) => p.personIndex === personIndex);
      persons.push(await resolvePersonData(sRow.applicationId, personIndex, base, stored, runOcr));
    }

    rows.push({
      applicationId: sRow.applicationId,
      companyName: sRow.companyName,
      title: sRow.title,
      isJoint: sRow.isJoint,
      overallRank: sRow.overallRank,
      persons,
      warnings,
    });
  }

  const unmatchedSheetCompanies = sheetRows
    .filter((r) => !usedSheet.has(r))
    .map((r) => r.companyName);

  const unmatchedSettlementCompanies = settlementRows
    .filter((row) => {
      const targets = resolveJointSheetCompanyTargets(row.companyName, row.title, row.isJoint);
      return targets.some((seg) => !sheetRows.some((sr) => youthCompanyCoreMatch(seg, sr.companyName)));
    })
    .map((r) => r.companyName);

  return {
    rows,
    unmatchedSheetCompanies,
    unmatchedSettlementCompanies,
    syncedAt: new Date().toISOString(),
    sheetRowCount: sheetRows.length,
  };
}

export async function runOcrForApplication(applicationId: string): Promise<YouthVerificationRow | null> {
  const base = await loadYouthVerificationTable({ runOcr: false });
  const row = base.rows.find((r) => r.applicationId === applicationId);
  if (!row) return null;

  const storedList = (await loadStoredYouthPersons([applicationId])).get(applicationId) ?? [];
  const persons: YouthPersonDisplay[] = [];
  for (let i = 0; i < row.persons.length; i++) {
    const st = storedList.find((p) => p.personIndex === i);
    persons.push(await resolvePersonData(applicationId, i, row.persons[i], st, true));
  }
  return { ...row, persons };
}

export async function loadYouthVerificationForApplication(
  applicationId: string,
): Promise<YouthVerificationRow | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      title: true,
      description: true,
      submissionMode: true,
      displayCompanyName: true,
      reviewProposalType: true,
    },
  });
  if (!app) return null;

  const isJoint = String(app.reviewProposalType || "").toUpperCase() === "JOINT";
  const title = app.title?.trim() || "";

  const [display, sheetRows, storedMap, responsibleByApp] = await Promise.all([
    resolveApplicationDisplayFields({
      id: app.id,
      submissionMode: app.submissionMode,
      description: app.description,
      displayCompanyName: app.displayCompanyName,
    }),
    getCachedYouthIdSheetRows().then((sheet) => sheet.rows),
    loadStoredYouthPersons([applicationId]),
    loadResponsibleNamesByAppId([applicationId]),
  ]);

  const companyName = display.companyName?.trim() || "";
  const usedSheet = new Set<YouthSheetRow>();
  const targets = resolveJointSheetCompanyTargets(companyName, title, isJoint);
  const storedList = storedMap.get(applicationId) ?? [];
  const persons: YouthPersonDisplay[] = [];
  const warnings: string[] = [];

  for (let personIndex = 0; personIndex < targets.length; personIndex++) {
    const target = targets[personIndex];
    const matched = findSheetRowForCompanyName(target, sheetRows, usedSheet);
    const fallbackName =
      targets.length === 1
        ? responsibleByApp.get(applicationId) ?? null
        : personIndex === 0
          ? responsibleByApp.get(applicationId) ?? null
          : null;

    if (!matched) {
      warnings.push(`試算表無對應資料：${target}`);
      const base = buildBasePerson(null, null, fallbackName);
      const stored = storedList.find((p) => p.personIndex === personIndex);
      persons.push(await resolvePersonData(applicationId, personIndex, base, stored, false));
      continue;
    }

    usedSheet.add(matched);
    if (!matched.uploadDriveFileId) {
      warnings.push(`${matched.companyName}：試算表無證件連結`);
    }

    const base = buildBasePerson(matched.companyName, matched, fallbackName);
    const stored = storedList.find((p) => p.personIndex === personIndex);
    persons.push(await resolvePersonData(applicationId, personIndex, base, stored, false));
  }

  return {
    applicationId,
    companyName,
    title,
    isJoint,
    overallRank: null,
    persons,
    warnings,
  };
}
