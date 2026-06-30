export type YouthSheetPersonFields = {
  responsibleName: string | null;
  registeredCity: string | null;
  age: number | null;
  qualifies: boolean | null;
};

export type YouthSheetRow = {
  rowIndex: number;
  companyName: string;
  email: string | null;
  uploadUrl: string | null;
  uploadDriveFileId: string | null;
  fields: YouthSheetPersonFields;
};

export type YouthDriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

export type YouthResponsiblePerson = YouthSheetPersonFields & {
  sheetCompanyName: string | null;
  driveFile: YouthDriveFile | null;
};

export type YouthVerificationRow = {
  applicationId: string;
  companyName: string;
  title: string;
  isJoint: boolean;
  overallRank: number | null;
  persons: YouthResponsiblePerson[];
  warnings: string[];
};

export type YouthVerificationTable = {
  rows: YouthVerificationRow[];
  unmatchedSheetCompanies: string[];
  unmatchedSettlementCompanies: string[];
  syncedAt: string;
  sheetRowCount: number;
};
