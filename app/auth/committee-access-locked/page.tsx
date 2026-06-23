import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { CommitteeAccessLockedView } from "@/components/auth/CommitteeAccessLockedView";
import { recordCommitteeAccessBlockedLog } from "@/lib/committeeAccessLog";
import {
  COMMITTEE_ACCESS_OPEN_START_ISO,
  isRestrictedCommitteeLocked,
} from "@/lib/committeeAccessWindow";
import { formatTaipeiDateTime } from "@/lib/taipeiTime";

export const metadata: Metadata = {
  title: "委員權限鎖定中",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CommitteeAccessLockedPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim() || "";
  if (!email) redirect("/");

  if (!isRestrictedCommitteeLocked(email)) {
    redirect("/committee/dashboard");
  }

  await recordCommitteeAccessBlockedLog({
    email,
    name: session?.user?.name,
    userId: session?.user?.id,
  });

  const nextOpenLabel = formatTaipeiDateTime(COMMITTEE_ACCESS_OPEN_START_ISO);

  return <CommitteeAccessLockedView nextOpenLabel={nextOpenLabel} />;
}
