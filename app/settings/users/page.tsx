/** Users settings page placeholder for account and workspace access management. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** UsersSettingsPage presents the initial user-management foundation scope. */
export default function UsersSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Users"
      description="Manage team access, account status, invitations, and workspace permissions."
      plannedItems={[
        "Add and edit user accounts",
        "Disable users and reset passwords",
        "Assign roles and workspace access",
        "View last login and effective permissions",
      ]}
    />
  );
}

