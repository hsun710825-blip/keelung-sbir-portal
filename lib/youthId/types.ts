export type YouthSheetRow = {
  rowIndex: number;
  companyName: string;
  email: string | null;
  uploadUrl: string | null;
  uploadDriveFileId: string | null;
};

export type YouthDriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

export type YouthResponsiblePerson = {
  sheetCompanyName: string | null;
  responsibleName: string | null;
  registeredCity: string | null;
  age: number | null;
  qualifies: boolean | null;
  driveFile: YouthDriveFile | null;
};

export type YouthPersonDisplay = YouthResponsiblePerson & {
  personIndex: number;
  poSaved: boolean;
  ocrReadError: string | null;
};

export type YouthVerificationRow = {
  applicationId: string;
  companyName: string;
  title: string;
  isJoint: boolean;
  overallRank: number | null;
  persons: YouthPersonDisplay[];
  warnings: string[];
};

export type YouthVerificationTable = {
  rows: YouthVerificationRow[];
  unmatchedSheetCompanies: string[];
  unmatchedSettlementCompanies: string[];
  syncedAt: string;
  sheetRowCount: number;
};
