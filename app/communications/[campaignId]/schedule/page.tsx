/** Campaign schedule route for communications workspace. */
import CommunicationCampaignActionPage from "@/app/components/communications/CommunicationCampaignActionPage";

/** Renders a campaign-scoped scheduling page shell. */
export default function CommunicationSchedulePage() {
  return (
    <CommunicationCampaignActionPage
      title="Campaign Schedule"
      helper="Set send time and execution options for this campaign."
      ctaLabel="Open Send Workspace"
      ctaHref="/communications/:campaignId?mode=send"
    />
  );
}
