// People directory surface for OyamaHRM with assignable/schedulable profile visibility.

import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

interface HrmPersonRow {
  name: string;
  personType: "staff" | "employee" | "volunteer" | "board_member";
  role: string;
  department: string;
  location: string;
  status: "active" | "on_leave" | "inactive";
  assignableToClients: boolean;
  schedulable: boolean;
  linkedUser: string;
}

const PEOPLE_ROWS: HrmPersonRow[] = [
  {
    name: "Ariana Miles",
    personType: "staff",
    role: "Client Services Lead",
    department: "Care Services",
    location: "Aurora Office",
    status: "active",
    assignableToClients: true,
    schedulable: true,
    linkedUser: "ariana@oyama.org",
  },
  {
    name: "Marcus Hill",
    personType: "board_member",
    role: "Board Chair",
    department: "Board",
    location: "South Campus",
    status: "active",
    assignableToClients: false,
    schedulable: false,
    linkedUser: "No login linked",
  },
  {
    name: "Nina Patel",
    personType: "employee",
    role: "Scheduling Coordinator",
    department: "Operations",
    location: "North Office",
    status: "active",
    assignableToClients: true,
    schedulable: true,
    linkedUser: "nina@oyama.org",
  },
  {
    name: "Jordan Cruz",
    personType: "volunteer",
    role: "Volunteer Ops",
    department: "Volunteer Team",
    location: "Aurora Office",
    status: "on_leave",
    assignableToClients: false,
    schedulable: false,
    linkedUser: "No login linked",
  },
];

/** HrmPeoplePage renders first-pass HRM people management with source-of-truth assignment flags. */
export default function HrmPeoplePage() {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">People Directory</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">People, Staff, And Board Management</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl">
          This page will become the source of truth for staff assignment options consumed by Compassion CRM, Donor CRM, and Events CRM.
        </p>
      </header>

      <FeatureStatusWarning
        status="Partially Implemented"
        title="People Directory Foundation"
        description="Creation/edit/archive forms and user-link workflows are planned for the next pass. Current surface shows source-of-truth flags for assignable and schedulable staff profiles."
      />

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Search by name, email, phone, or title"
            className="flex-1 min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
            readOnly
            value=""
          />
          <select className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700" defaultValue="all" disabled>
            <option value="all">All person types</option>
          </select>
          <select className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-700" defaultValue="all" disabled>
            <option value="all">All locations</option>
          </select>
          <button className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700" disabled>
            Add Person (Next Pass)
          </button>
        </div>
      </article>

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
        <h2 className="text-sm font-semibold text-slate-900">HRM People Records</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3">Person</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Role/Department</th>
              <th className="py-2 pr-3">Location</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Assignable</th>
              <th className="py-2 pr-3">Schedulable</th>
              <th className="py-2">Linked User</th>
            </tr>
          </thead>
          <tbody>
            {PEOPLE_ROWS.map((person) => (
              <tr key={person.name} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3 font-medium text-slate-900">{person.name}</td>
                <td className="py-2 pr-3 text-gray-600">{person.personType}</td>
                <td className="py-2 pr-3 text-gray-600">
                  <p>{person.role}</p>
                  <p className="text-xs text-gray-500">{person.department}</p>
                </td>
                <td className="py-2 pr-3 text-gray-600">{person.location}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    person.status === "active" ? "bg-teal-100 text-teal-700" : person.status === "on_leave" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {person.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-600">{person.assignableToClients ? "Yes" : "No"}</td>
                <td className="py-2 pr-3 text-gray-600">{person.schedulable ? "Yes" : "No"}</td>
                <td className="py-2 text-gray-600">{person.linkedUser}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
