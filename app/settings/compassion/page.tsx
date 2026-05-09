/** Compassion settings page placeholder for client-service defaults and privacy controls. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** CompassionSettingsPage anchors the compassion configuration surface. */
export default function CompassionSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Compassion CRM Settings"
      description="Configure client-service defaults, categories, and privacy controls for compassion workflows."
      plannedItems={[
        "Manage client, visit, and appointment statuses",
        "Configure file and note categories",
        "Define referral and material-assistance categories",
        "Set client privacy and access defaults",
        "Configure Compassion-specific email and SMS sender defaults",
        "Set consent rules and communication logging behavior",
        "Define enhanced audit rules for sensitive client actions",
      ]}
    />
  );
}

