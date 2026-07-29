import { redirect } from "next/navigation";

export const metadata = { title: "Reports - DonorCRM" };

/** Keeps old report-manager bookmarks working while reports move into Donor CRM. */
export default function Page() {
  redirect("/reports");
}
