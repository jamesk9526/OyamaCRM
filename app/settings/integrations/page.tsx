/** Integrations settings page placeholder for third-party service connections. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** IntegrationsSettingsPage provides a route foundation for external system setup. */
export default function IntegrationsSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Integrations"
      description="Connect payment, messaging, calendar, and data-export providers."
      plannedItems={[
        "Configure payment provider credentials",
        "Connect email and SMS services",
        "Manage accounting and calendar sync integration",
        "Set AI provider endpoint and policies",
      ]}
    />
  );
}

