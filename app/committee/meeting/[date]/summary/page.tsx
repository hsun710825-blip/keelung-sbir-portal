import { redirect } from "next/navigation";

export default async function LegacyMeetingSummaryRedirect() {
  redirect("/committee/summary");
}
