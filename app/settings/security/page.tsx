/** Security settings page placeholder for auth, policy, and access-hardening controls. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** SecuritySettingsPage defines the security tab foundation for policy work. */
export default function SecuritySettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Security"
      description="Control authentication and account-protection policies across the organization."
      plannedItems={[
        "Manage password and session policies",
        "Configure two-factor requirements",
        "Set login lockout and domain restrictions",
        "Review sensitive-data access rules",
      ]}
    />
  );
}

