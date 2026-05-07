import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function DataToolsPage() {
  return (
    <PagePlaceholder
      title="Data Tools"
      icon="🔧"
      description="Import, export, clean, and manage your constituent data."
      stats={[
        { label: "Total Records", description: "All constituent records" },
        { label: "Duplicates Found", description: "Potential duplicate records" },
        { label: "Incomplete Profiles", description: "Missing key fields" },
        { label: "Last Import", description: "Most recent data import" },
      ]}
      features={[
        "CSV/Excel bulk import with field mapping",
        "Duplicate detection and merge tool",
        "Data export with custom field selection",
        "Audit log (who changed what, when)",
        "Address verification and standardization",
        "Data quality score and recommendations",
        "Scheduled backup and export",
      ]}
    />
  );
}
