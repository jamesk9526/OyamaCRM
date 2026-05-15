/** Wizard step: pick communication preset/template. */
import CommunicationsWizardStep from "@/app/components/communications/CommunicationsWizardStep";

/** Renders preset selection step. */
export default function CommunicationsNewPresetPage() {
  return (
    <CommunicationsWizardStep
      stepIndex={2}
      title="New Communication - Choose Preset"
      helper="Pick a template or preset before entering the editor."
      prevHref="/communications/new/audience"
      nextHref="/communications/new/editor"
    />
  );
}
