// Oyama Reports route: a dedicated Donor CRM reporting app powered by live CRM APIs.

import ReportsApp from "@/app/components/reports-app/ReportsApp";

export const metadata = { title: "Oyama Reports - DonorCRM" };

/** Renders the first-class Reports application for Donor CRM staff. */
export default function ReportsPage() {
  return <ReportsApp />;
}
