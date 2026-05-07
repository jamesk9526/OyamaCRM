import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function VolunteersPage() {
  return (
    <PagePlaceholder
      title="Volunteers"
      icon="🤝"
      description="Recruit, schedule, and track volunteer engagement and hours."
      stats={[
        { label: "Active Volunteers", description: "Volunteered this year" },
        { label: "Total Hours (YTD)", description: "Volunteer hours logged" },
        { label: "Est. Value", description: "At $31.80/hr industry avg" },
        { label: "Open Opportunities", description: "Seeking volunteers" },
      ]}
      features={[
        "Volunteer profile tracking within constituent records",
        "Opportunity posting and sign-up",
        "Hour logging and approval",
        "Volunteer recognition milestones",
        "Cross-reference donors who also volunteer",
        "Volunteer-to-donor conversion tracking",
        "Automated hour reminders",
      ]}
    />
  );
}
