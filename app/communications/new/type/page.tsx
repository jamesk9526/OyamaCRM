/** Wizard step: choose communication type. */
import CommunicationsWizardStep from "@/app/components/communications/CommunicationsWizardStep";

/** Renders communication type selection step. */
export default function CommunicationsNewTypePage() {
  return (
    <CommunicationsWizardStep
      stepIndex={0}
      title="New Communication - Choose Type"
      helper="Start by selecting campaign type before audience and preset details."
      nextHref="/communications/new/audience"
    />
  );
}
