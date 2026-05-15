/** Wizard step: schedule or send communication. */
import CommunicationsWizardStep from "@/app/components/communications/CommunicationsWizardStep";

/** Renders final send and scheduling step. */
export default function CommunicationsNewSendPage() {
  return (
    <CommunicationsWizardStep
      stepIndex={5}
      title="New Communication - Send"
      helper="Choose schedule or send-now execution with final confirmation."
      prevHref="/communications/new/review"
      nextHref="/communications/log"
    />
  );
}
