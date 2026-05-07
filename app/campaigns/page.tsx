import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function CampaignsPage() {
  return (
    <PagePlaceholder
      title="Campaigns"
      icon="📊"
      description="Create and track fundraising campaigns, goals, and performance."
      stats={[
        { label: "Active Campaigns", description: "Currently running" },
        { label: "Total Goal", description: "Combined campaign goals" },
        { label: "Total Raised", description: "Across all active campaigns" },
        { label: "Avg Completion", description: "Goal completion %" },
      ]}
      features={[
        "Campaign creation with goals and timelines",
        "Progress tracking toward revenue goals",
        "Multi-channel campaign support",
        "Peer-to-peer fundraising pages",
        "Donor segmentation by campaign",
        "Year-over-year campaign comparison",
        "Campaign-specific donation forms",
      ]}
    />
  );
}
