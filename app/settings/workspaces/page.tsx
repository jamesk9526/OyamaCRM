/** Workspaces settings page placeholder for workspace enablement and defaults. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** WorkspacesSettingsPage defines the initial workspace-management UI entry point. */
export default function WorkspacesSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Workspaces"
      description="Control enabled workspaces and startup behavior for OyamaCRM and OyamaCRM-Compassion."
      plannedItems={[
        "Enable or disable workspace modules",
        "Set default workspace after login",
        "Manage workspace display names and descriptions",
        "Configure workspace access rules and assignment defaults",
      ]}
    />
  );
}

