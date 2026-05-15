/** Wizard step: review and validate communication readiness. */
import CommunicationsWizardStep from "@/app/components/communications/CommunicationsWizardStep";

/** Renders review checklist and compliance step. */
export default function CommunicationsNewReviewPage() {
  return (
    <CommunicationsWizardStep
      stepIndex={4}
      title="New Communication - Review"
      helper="Run readiness checks, send test, and confirm merge/compliance constraints."
      prevHref="/communications/new/editor"
      nextHref="/communications/new/send"
    />
  );
}
