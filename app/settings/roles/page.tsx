/** Roles settings page placeholder for permission matrix and role configuration. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** RolesSettingsPage anchors roles/scopes UI for RBAC completion work. */
export default function RolesSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Roles & Scopes"
      description="Define role templates and permission scopes that power server-side authorization."
      plannedItems={[
        "View and edit role definitions",
        "Create custom roles with permission categories",
        "Display permission matrix by workspace and scope",
        "Preview effective permissions before saving",
      ]}
    />
  );
}

