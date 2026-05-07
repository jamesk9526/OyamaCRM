import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Settings"
      icon="⚙️"
      description="Configure your organization, users, integrations, and system preferences."
      stats={[
        { label: "Team Members", description: "Active staff users" },
        { label: "Integrations", description: "Connected services" },
        { label: "Custom Fields", description: "Configured fields" },
        { label: "Email Templates", description: "Saved templates" },
      ]}
      features={[
        "Organization profile and branding",
        "User management and role-based permissions",
        "Fiscal year and currency configuration",
        "Fund and designation management",
        "Email integration (Mailchimp, Constant Contact)",
        "Payment processor setup (Stripe, PayPal)",
        "API keys and webhook management",
        "Custom field creation",
      ]}
    />
  );
}
