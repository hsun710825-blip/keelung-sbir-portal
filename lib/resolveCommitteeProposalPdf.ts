import {
  resolveApplicationProposalPdfSourceById,
  type ApplicationProposalPdfSource,
} from "@/lib/resolveApplicationProposalPdf";

export type CommitteeProposalPdfSource =
  | { kind: "drive_file"; fileId: string; externalViewUrl: string | null }
  | { kind: "not_found"; externalViewUrl: string | null };

export async function resolveCommitteeProposalPdfSource(
  applicationId: string,
): Promise<CommitteeProposalPdfSource> {
  const source = await resolveApplicationProposalPdfSourceById(applicationId);
  return toCommitteeSource(source);
}

function toCommitteeSource(source: ApplicationProposalPdfSource): CommitteeProposalPdfSource {
  if (source.kind === "drive_file") {
    return {
      kind: "drive_file",
      fileId: source.fileId,
      externalViewUrl: source.externalViewUrl,
    };
  }
  return { kind: "not_found", externalViewUrl: source.externalViewUrl };
}
