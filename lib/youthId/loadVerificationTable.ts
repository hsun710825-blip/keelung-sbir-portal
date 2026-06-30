import { pickRegistryFieldsFromFormData } from "@/app/api/_registrySheet";
import { extractFormDataFromDraftPayload } from "@/lib/resolveApplicationDisplayFields";
import { prisma } from "@/lib/prisma";
import { loadSettlementRowsForExport } from "@/lib/settlementTable";
import {
  findSheetRowForCompanyName,
  splitSettlementCompanyNames,
  youthCompanyCoreMatch,
} from "@/lib/youthId/companyMatch";
import { findDriveFileForCompany, loadYouthIdDriveFiles } from "@/lib/youthId/driveFiles";
import { loadYouthIdSheetRows } from "@/lib/youthId/sheetSync";
import type { YouthResponsiblePerson, YouthVerificationRow, YouthVerificationTable } from "@/lib/youthId/types";

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

import type { YouthSheetRow } from "@/lib/youthId/types";

function buildPersonFromSheet(
  sheetCompanyName: string,
  sheetRow: YouthSheetRow,
  driveFile: ReturnType<typeof findDriveFileForCompany>,
  fallbackName: string | null,
): YouthResponsiblePerson {
  return {
    sheetCompanyName,
    responsibleName: sheetRow.fields.responsibleName || fallbackName,
    registeredCity: sheetRow.fields.registeredCity,
    age: sheetRow.fields.age,
    qualifies: sheetRow.fields.qualifies,
    driveFile:
      sheetRow.uploadDriveFileId && driveFile
        ? driveFile
        : driveFile || (sheetRow.uploadDriveFileId
            ? { id: sheetRow.uploadDriveFileId, name: sheetCompanyName, mimeType: "application/octet-stream" }
            : null),
  };
}

export async function loadYouthVerificationTable(): Promise<YouthVerificationTable> {
  const [sheetRows, driveFiles, settlementExport] = await Promise.all([
    loadYouthIdSheetRows().then((r) => r.rows),
    loadYouthIdDriveFiles(),
    loadSettlementRowsForExport(),
  ]);

  const settlementRows = settlementExport.standardRows;
  const usedSheet = new Set<(typeof sheetRows)[number]>();
  const applicationIds = settlementRows.map((r) => r.applicationId);
  const responsibleByApp = await loadResponsibleNamesByAppId(applicationIds);

  const rows: YouthVerificationRow[] = [];

  for (const sRow of settlementRows) {
    const segments = splitSettlementCompanyNames(sRow.companyName);
    const persons: YouthResponsiblePerson[] = [];
    const warnings: string[] = [];

    for (const segment of segments) {
      const matched = findSheetRowForCompanyName(segment, sheetRows, usedSheet);
      if (!matched) {
        warnings.push(`試算表無對應資料：${segment}`);
        persons.push({
          sheetCompanyName: null,
          responsibleName: segments.length === 1 ? responsibleByApp.get(sRow.applicationId) ?? null : null,
          registeredCity: null,
          age: null,
          qualifies: null,
          driveFile: findDriveFileForCompany(segment, driveFiles),
        });
        continue;
      }
      usedSheet.add(matched);
      const driveFile =
        (matched.uploadDriveFileId
          ? driveFiles.find((f) => f.id === matched.uploadDriveFileId) ||
            findDriveFileForCompany(matched.companyName, driveFiles)
          : findDriveFileForCompany(matched.companyName, driveFiles)) ?? null;
      if (!driveFile && !matched.uploadDriveFileId) {
        warnings.push(`${matched.companyName}：找不到身分證檔案`);
      }
      persons.push(
        buildPersonFromSheet(
          matched.companyName,
          matched,
          driveFile,
          responsibleByApp.get(sRow.applicationId) ?? null,
        ),
      );
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
      const segments = splitSettlementCompanyNames(row.companyName);
      return segments.some(
        (seg) => !sheetRows.some((sr) => youthCompanyCoreMatch(seg, sr.companyName)),
      );
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

export async function loadYouthVerificationForApplication(applicationId: string) {
  const table = await loadYouthVerificationTable();
  return table.rows.find((r) => r.applicationId === applicationId) ?? null;
}
