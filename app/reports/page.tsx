import DonorReportsSpreadsheet from "@/app/components/donor-reports/DonorReportsSpreadsheet";

export const metadata = { title: "Reports - DonorCRM" };

/** Renders the live Donor CRM reporting workbook. */
export default function ReportsPage() {
  return <DonorReportsSpreadsheet />;
}
