import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function ReportsPage() {
  return (
    <PagePlaceholder
      title="Reports"
      icon="📈"
      description="Analyze giving trends, donor retention, and fundraising performance."
      stats={[
        { label: "Retention Rate", description: "Year-over-year donor retention" },
        { label: "LYBUNT Donors", description: "Gave last year, not this year" },
        { label: "Upgrade Rate", description: "Donors who gave more" },
        { label: "Avg Giving", description: "Average annual gift" },
      ]}
      features={[
        "Revenue progress and goal tracking",
        "Donor retention analysis (LYBUNT, SYBUNT)",
        "Giving by donor level / fund / campaign",
        "Year-over-year comparison charts",
        "Constituent engagement reports",
        "Custom report builder",
        "Scheduled email report delivery",
        "Export to CSV, Excel, PDF",
      ]}
    />
  );
}
