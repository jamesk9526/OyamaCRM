import { redirect } from "next/navigation";

export const metadata = { title: "Reports - DonorCRM" };

/** Keeps old builder bookmarks working while reports move into Donor CRM. */
export default function ReportsBuilderPage() {
  redirect("/reports");
}
