/** Wizard step: choose communication audience. */
import CommunicationsWizardStep from "@/app/components/communications/CommunicationsWizardStep";

/** Renders audience and segment selection step. */
export default function CommunicationsNewAudiencePage() {
  return (
    <CommunicationsWizardStep
      stepIndex={1}
      title="New Communication - Choose Audience"
      helper="Select recipients, exclusions, and audience preview before design edits."
      prevHref="/communications/new/type"
      nextHref="/communications/new/preset"
    />
  );
}
