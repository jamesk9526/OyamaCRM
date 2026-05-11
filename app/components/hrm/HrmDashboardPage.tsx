// OyamaHRM dashboard overview with staffing, schedule, and internal communication snapshots.

import Link from "next/link";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}

const METRICS: DashboardMetric[] = [
  { label: "Active Staff", value: "42", detail: "Across all internal roles" },
  { label: "Board Members", value: "9", detail: "7 active term assignments" },
  { label: "Locations", value: "4", detail: "3 currently open today" },
  { label: "People Scheduled Today", value: "31", detail: "3 schedule exceptions" },
  { label: "Open Internal Messages", value: "12", detail: "2 marked urgent" },
  { label: "Profile Completion Needed", value: "6", detail: "Missing role/location metadata" },
];

const TODAY_SCHEDULE = [
  { person: "Ariana Miles", role: "Client Services Lead", location: "Aurora Office", shift: "8:00 AM - 4:30 PM" },
  { person: "Marcus Hill", role: "Board Liaison", location: "South Campus", shift: "9:00 AM - 2:00 PM" },
  { person: "Nina Patel", role: "Scheduling Coordinator", location: "North Office", shift: "10:00 AM - 6:00 PM" },
  { person: "Jordan Cruz", role: "Volunteer Ops", location: "Aurora Office", shift: "12:00 PM - 7:00 PM" },
];

const LOCATION_STATUS = [
  { location: "Aurora Office", status: "Open", coverage: "12 staff scheduled" },
  { location: "North Office", status: "Open", coverage: "8 staff scheduled" },
  { location: "South Campus", status: "Open", coverage: "7 staff scheduled" },
  { location: "Mobile Services", status: "Limited", coverage: "4 staff scheduled" },
];

const ANNOUNCEMENTS = [
  { title: "Cross-location staffing huddle", body: "Directors meet at 2:00 PM to review schedule conflicts for next week.", priority: "High" },
  { title: "Volunteer intake refresh", body: "Internal volunteer profile updates must be completed by Friday.", priority: "Normal" },
  { title: "Board packet prep", body: "Board packet draft is due tomorrow before noon.", priority: "Urgent" },
];

/** HrmDashboardPage renders the first-pass dashboard for internal HRM operations visibility. */
export default function HrmDashboardPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">OyamaHRM</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Internal People And Scheduling Hub</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl">
          OyamaHRM is now the internal operations workspace for staff profiles, role assignment, schedule readiness, and interoffice coordination.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/hrm/people" className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
            Manage People
          </Link>
          <Link href="/hrm/scheduling" className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">
            Open Scheduling
          </Link>
          <Link href="/hrm/messages" className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">
            Internal Messages
          </Link>
        </div>
      </header>

      <FeatureStatusWarning
        status="Partially Implemented"
        title="HRM Module Foundation Is Live"
        description="Dashboard, people source scaffolding, scheduling views, and internal communication shells are now available. Database-backed HRM entities and cross-module assignment sync are the next implementation pass."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {METRICS.map((metric) => (
          <article key={metric.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-xs text-gray-500">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Today's Staff Schedule</h2>
          <div className="mt-3 space-y-2">
            {TODAY_SCHEDULE.map((item) => (
              <div key={`${item.person}-${item.shift}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{item.person}</p>
                <p className="text-xs text-gray-600">{item.role} • {item.location}</p>
                <p className="text-xs text-teal-700 mt-0.5">{item.shift}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Location Status</h2>
          <div className="mt-3 space-y-2">
            {LOCATION_STATUS.map((item) => (
              <div key={item.location} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{item.location}</p>
                <p className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${item.status === "Limited" ? "text-amber-700" : "text-teal-700"}`}>
                  {item.status}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{item.coverage}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Internal Announcements</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {ANNOUNCEMENTS.map((announcement) => (
            <div key={announcement.title} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{announcement.priority}</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{announcement.title}</p>
              <p className="text-xs text-gray-600 mt-1">{announcement.body}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
