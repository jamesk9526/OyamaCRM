import PagePlaceholder from "@/app/components/ui/PagePlaceholder";

export default function TasksPage() {
  return (
    <PagePlaceholder
      title="Tasks"
      icon="✅"
      description="Manage stewardship tasks, follow-ups, and team assignments."
      stats={[
        { label: "Due Today", description: "Tasks due right now" },
        { label: "Overdue", description: "Past due tasks" },
        { label: "Due This Week", description: "Upcoming tasks" },
        { label: "Completed (MTD)", description: "Finished this month" },
      ]}
      features={[
        "Create and assign tasks to team members",
        "Due date and priority management",
        "Filter by assignee, type, status",
        "Stewardship workflow templates",
        "Link tasks to constituent records",
        "Email and in-app reminders",
        "Bulk task creation from segments",
      ]}
    />
  );
}
