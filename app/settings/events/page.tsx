// Events CRM settings skeleton page for module-specific operations and communication defaults.
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/**
 * EventsSettingsPage anchors module-level defaults for event operations.
 * TODO: backend API needed for Events-specific sender profiles and template persistence.
 */
export default function EventsSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Events CRM Settings"
      description="Configure event operations defaults, communication behavior, and workflow guardrails for Events CRM."
      plannedItems={[
        "Manage event lifecycle statuses and workspace defaults",
        "Configure guest-facing email and SMS sender profiles",
        "Set registration, check-in, and reminder message templates",
        "Define post-event follow-up communication defaults",
      ]}
    />
  );
}
