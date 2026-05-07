/** Scheduling settings page placeholder for hours, availability, and booking defaults. */
import SettingsPlaceholderPage from "@/app/components/settings/SettingsPlaceholderPage";

/** SchedulingSettingsPage provides a route for future scheduling policy controls. */
export default function SchedulingSettingsPage() {
  return (
    <SettingsPlaceholderPage
      title="Scheduling Settings"
      description="Control appointment timing, reminders, office hours, and public scheduling defaults."
      plannedItems={[
        "Manage appointment types and durations",
        "Configure office hours and closures",
        "Define reminder and cancellation policies",
        "Set public scheduling page defaults",
      ]}
    />
  );
}

