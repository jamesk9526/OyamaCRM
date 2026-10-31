import { redirect } from "next/navigation";

export const metadata = { title: "Reports - DonorCRM" };

/** Keeps old builder bookmarks working to the custom report studio. */
export default function ReportsBuilderPage() {
  redirect("/reports/custom");
}
