/** Email settings page placeholder for SMTP and messaging templates. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** EmailSettingsPage reserves messaging/infrastructure settings in a dedicated tab. */
export default function EmailSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Email & Messaging"
      description="Configure sender identity, delivery infrastructure, and operational communication templates."
      plannedItems={[
        "Manage SMTP and sender defaults",
        "Configure reminder and follow-up templates",
        "Add SMS provider defaults",
        "Set delivery and bounce handling policies",
      ]}
    />
  );
}

