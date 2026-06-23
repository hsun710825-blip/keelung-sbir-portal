import { matchApplicationToAgenda, type AgendaMatch } from "@/lib/matchApplicationToAgenda";
import { prisma } from "@/lib/prisma";
import { resolveApplicationDisplayFields } from "@/lib/resolveApplicationDisplayFields";

export async function resolveApplicationAgendaMatch(
  applicationId: string,
): Promise<AgendaMatch | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      title: true,
      submissionMode: true,
      description: true,
    },
  });
  if (!app) return null;

  const fields = await resolveApplicationDisplayFields({
    id: app.id,
    submissionMode: app.submissionMode,
    description: app.description,
  });

  return matchApplicationToAgenda({
    title: app.title,
    companyName: fields.companyName,
  });
}
