import Link from "next/link";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
export default function TasksSettingsPage() {
  return (
    <div className="donor-daily-workspace space-y-5">
      <CRMPageHeader
        breadcrumb="Settings / Tasks"
        title="Task workflow"
        description="One workspace for follow-ups, ownership, and completed work."
        primaryAction={
          <Link
            className="donor-button donor-button-primary"
            href="/tasks?create=1"
          >
            Create a task
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            title: "Personal and team work",
            text: "My work includes tasks you created or were assigned, including future and undated tasks. Administrators can review the team queue. Server permissions and organization boundaries control every change.",
          },
          {
            title: "Due dates and priorities",
            text: "Choose a due date and Low, Medium, High, or Urgent priority. A date entered in the task editor is due at the end of your local day. Pending and in-progress tasks can become overdue.",
          },
          {
            title: "Completion and reopening",
            text: "Done records who completed a task and when. Reopen moves completed or cancelled work back to Pending and clears completion metadata. Permanent deletion requires confirmation.",
          },
          {
            title: "Task notifications",
            text: "Assignment and overdue notices link to the exact task, even outside the current queue. Notifications owns read, snooze, and dismiss controls. These in-app actions do not send email or SMS.",
          },
        ].map((item) => (
          <section key={item.title} className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
          </section>
        ))}
      </div>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Stewardship templates</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The New Task editor offers thank-you calls, impact follow-ups, major
          donor check-ins, and lapsed donor reactivation. Templates prefill
          editable fields; they never send communications automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="donor-button" href="/tasks">
            Open tasks
          </Link>
          <Link className="donor-button" href="/notifications">
            Open notifications
          </Link>
        </div>
      </section>
    </div>
  );
}
