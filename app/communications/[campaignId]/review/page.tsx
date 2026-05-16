/** Campaign review route for communications workspace. */
import CommunicationCampaignActionPage from "@/app/components/communications/CommunicationCampaignActionPage";

/** Renders a campaign-scoped review page shell. */
export default function CommunicationReviewPage() {
  return (
    <CommunicationCampaignActionPage
      title="Campaign Review"
      helper="Validate content, recipients, and compliance checks before schedule/send."
      ctaLabel="Open Email Workspace"
      ctaHref="/communications/:campaignId?mode=build"
    />
  );
}
