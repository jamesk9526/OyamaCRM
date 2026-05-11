// Scheduling and availability workspace scaffold for OyamaHRM.

import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

const AVAILABILITY_BLOCKS = [
  { person: "Ariana Miles", location: "Aurora Office", window: "Mon-Fri • 8:00 AM - 4:30 PM", appointmentTypes: "Client Intake, Follow-Up", active: true },
  { person: "Nina Patel", location: "North Office", window: "Mon-Thu • 10:00 AM - 6:00 PM", appointmentTypes: "Scheduling, Admin", active: true },
  { person: "Jordan Cruz", location: "Aurora Office", window: "Tue-Thu • 12:00 PM - 7:00 PM", appointmentTypes: "Volunteer Support", active: false },
];

const SCHEDULE_EXCEPTIONS = [
  { person: "Ariana Miles", date: "2026-05-13", type: "training", note: "Cross-office scheduling training" },
  { person: "Nina Patel", date: "2026-05-14", type: "meeting", note: "Operations strategy sync" },
  { person: "Jordan Cruz", date: "2026-05-16", type: "unavailable", note: "Time off request pending approval" },
];

/** HrmSchedulingPage renders first-pass availability and scheduling conflict visibility. */
export default function HrmSchedulingPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Scheduling</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Staff Availability And Exceptions</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl">
          HRM scheduling will become the shared availability source for Compassion appointment assignment and internal staffing coordination.
        </p>
      </header>

      <FeatureStatusWarning
        status="Partially Implemented"
        title="Availability Backbone In Progress"
        description="Availability blocks and exceptions are represented in this first pass. Calendar editing, conflict auto-detection, and cross-module appointment reads are next."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Availability Blocks</h2>
          <div className="mt-3 space-y-2">
            {AVAILABILITY_BLOCKS.map((block) => (
              <div key={`${block.person}-${block.window}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{block.person}</p>
                <p className="text-xs text-gray-600 mt-0.5">{block.location}</p>
                <p className="text-xs text-teal-700 mt-1">{block.window}</p>
                <p className="text-xs text-gray-600 mt-1">{block.appointmentTypes}</p>
                <p className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${block.active ? "text-teal-700" : "text-gray-500"}`}>
                  {block.active ? "Active" : "Inactive"}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Schedule Exceptions</h2>
          <div className="mt-3 space-y-2">
            {SCHEDULE_EXCEPTIONS.map((item) => (
              <div key={`${item.person}-${item.date}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.person}</p>
                  <p className="text-xs text-gray-500">{item.date}</p>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">{item.type}</p>
                <p className="mt-1 text-xs text-gray-600">{item.note}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
