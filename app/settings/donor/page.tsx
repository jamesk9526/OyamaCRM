/** Donor settings page placeholder for donor CRM default configuration. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** DonorSettingsPage provides a foundation tab for donor-system defaults. */
export default function DonorSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Donor CRM Settings"
      description="Maintain donor statuses, gift defaults, and nonprofit fundraising baseline rules."
      plannedItems={[
        "Manage donor statuses and segmentation defaults",
        "Configure default gift/payment method sets",
        "Set campaign and receipt defaults",
        "Adjust communication and stewardship thresholds",
      ]}
    />
  );
}

