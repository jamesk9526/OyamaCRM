/** Forms settings page placeholder for intake/consent form management. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** FormsSettingsPage reserves the forms configuration area in settings. */
export default function FormsSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Forms"
      description="Create and manage intake, consent, and workflow forms for donor and compassion operations."
      plannedItems={[
        "Configure form templates and categories",
        "Manage published and draft forms",
        "Add conditional logic and required fields",
        "Control staff-only versus public forms",
      ]}
    />
  );
}

