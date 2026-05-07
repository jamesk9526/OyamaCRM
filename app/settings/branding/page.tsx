/** Branding settings page placeholder for logo/theme configuration. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** BrandingSettingsPage shows planned branding controls from the setup plan. */
export default function BrandingSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Branding Settings"
      description="Configure organization identity across dashboard, public pages, emails, and widgets."
      plannedItems={[
        "Upload organization logo and email header logo",
        "Set primary and accent colors",
        "Configure public display name and short name",
        "Manage default sender name and sender email",
      ]}
    />
  );
}

