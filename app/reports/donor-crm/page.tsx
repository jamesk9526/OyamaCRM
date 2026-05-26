// Legacy DonorCRM reports route kept as a compatibility redirect.

import { redirect } from "next/navigation";

/** Redirects old DonorCRM reports links into the canonical Oyama Reports app. */
export default function LegacyDonorReportsRoute() {
  redirect("/reports");
}
