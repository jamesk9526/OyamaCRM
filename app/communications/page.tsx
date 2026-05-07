import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function CommunicationsPage() {
  return (
    <PagePlaceholder
      title="Communications"
      icon="✉️"
      description="Send emails, acknowledgment letters, and newsletters to your constituents."
      stats={[
        { label: "Emails Sent (MTD)", description: "This month" },
        { label: "Avg Open Rate", description: "Email open rate" },
        { label: "Templates", description: "Saved templates" },
        { label: "Scheduled", description: "Queued to send" },
      ]}
      features={[
        "Email campaign builder with templates",
        "Acknowledgment and receipt letters",
        "Audience segmentation and filtering",
        "Email tracking (opens, clicks, bounces)",
        "Mail merge for physical letters",
        "Scheduled sends and automations",
        "Opt-out and unsubscribe management",
        "Newsletter and appeal creation",
      ]}
    />
  );
}
