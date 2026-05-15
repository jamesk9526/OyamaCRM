/** Wizard step: edit communication content. */
import CommunicationsWizardStep from "@/app/components/communications/CommunicationsWizardStep";

/** Renders content editing step. */
export default function CommunicationsNewEditorPage() {
  return (
    <CommunicationsWizardStep
      stepIndex={3}
      title="New Communication - Edit"
      helper="Open the builder, refine content, and prepare merge fields for review."
      prevHref="/communications/new/preset"
      nextHref="/communications/new/review"
    />
  );
}
