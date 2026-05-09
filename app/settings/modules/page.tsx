/**
 * Settings — CRM Modules page.
 * Shows a status matrix of all CRM modules/features in OyamaCRM,
 * including data source status, completion state, and links to configuration.
 * This is the admin's at-a-glance view of what is working, partial, or not started.
 */
import Link from "next/link";

/** Status badge types for module status cells */
type ModuleStatus = "Live" | "Partial" | "UI Only" | "Placeholder" | "Not Started" | "In Progress";

/** Color map for each status badge */
const STATUS_COLORS: Record<ModuleStatus, string> = {
  "Live": "bg-green-100 text-green-700 border-green-200",
  "Partial": "bg-blue-100 text-blue-700 border-blue-200",
  "UI Only": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Placeholder": "bg-gray-100 text-gray-500 border-gray-200",
  "Not Started": "bg-gray-100 text-gray-400 border-gray-200",
  "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
};

interface Module {
  name: string;
  area: string;
  status: ModuleStatus;
  dataSource: string;
  notes: string;
  configLink?: string;
}

/** Module status matrix — reflects the actual state of the codebase */
const MODULES: Module[] = [
  // ─── Donor CRM ───
  {
    name: "Constituents",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB (MySQL via Prisma)",
    notes: "Full CRUD, search, filters, profile pages. Soft credits and wealth indicators planned.",
    configLink: "/settings/donor",
  },
  {
    name: "Donations",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB",
    notes: "One-time and recurring, batch entry, gift history. Pledge management planned.",
    configLink: "/settings/donor",
  },
  {
    name: "Campaigns",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB",
    notes: "Campaign CRUD, goal tracking, donation linking.",
    configLink: "/settings/donor",
  },
  {
    name: "Designations",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB",
    notes: "Fund/designation management for donation earmarking.",
  },
  {
    name: "Tasks",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB",
    notes: "Full task management, assign to staff, link to constituents, filter by status.",
    configLink: "/settings/tasks",
  },
  {
    name: "Meetings",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB (new model)",
    notes: "Schedule, complete, cancel meetings. Timeline integration. Dashboard widget pending.",
    configLink: "/settings/meetings",
  },
  {
    name: "Communications",
    area: "Donor CRM",
    status: "Partial",
    dataSource: "Real DB (email-campaigns table)",
    notes: "Email campaign creation and list. Sending is queued but not yet live (no SMTP connection).",
    configLink: "/settings/email",
  },
  {
    name: "Automations",
    area: "Donor CRM",
    status: "Partial",
    dataSource: "Real DB",
    notes: "Automation rules CRUD + manual trigger. Missing: cron/queue worker, meeting triggers.",
    configLink: "/settings/automations",
  },
  {
    name: "Households",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB",
    notes: "Household creation, member linking, head-of-household assignment.",
  },
  {
    name: "Reports",
    area: "Donor CRM",
    status: "Live",
    dataSource: "Real DB",
    notes: "12 report endpoints: YTD, retention, monthly, campaign, donor activity, and more.",
  },
  {
    name: "Custom Fields",
    area: "Donor CRM",
    status: "Partial",
    dataSource: "Real DB",
    notes: "Field definition CRUD. Display in constituent profiles is partial.",
  },
  {
    name: "Calendar / Schedule View",
    area: "Donor CRM",
    status: "Not Started",
    dataSource: "—",
    notes: "Day/week/month calendar for meetings and tasks. Planned after meetings foundation.",
    configLink: "/settings/meetings",
  },
  // ─── Compassion CRM ───
  {
    name: "Clients",
    area: "Compassion CRM",
    status: "Partial",
    dataSource: "Real DB",
    notes: "Client profile, case management, appointments, care plans. Assessments planned.",
    configLink: "/settings/compassion",
  },
  {
    name: "Cases",
    area: "Compassion CRM",
    status: "Partial",
    dataSource: "Real DB",
    notes: "Case creation and linking to clients. Case activities and assessments in progress.",
  },
  {
    name: "Appointments",
    area: "Compassion CRM",
    status: "Partial",
    dataSource: "Real DB",
    notes: "Schedule appointments with clients. Reminder and follow-up system planned.",
  },
  // ─── Events CRM ───
  {
    name: "Events",
    area: "Events CRM",
    status: "In Progress",
    dataSource: "Real DB",
    notes: "Events shell + dashboard + list created. Ticket types, orders, guests, check-in in progress.",
  },
  {
    name: "Ticket Types",
    area: "Events CRM",
    status: "Placeholder",
    dataSource: "—",
    notes: "UI scaffolded. No backend model or API yet.",
  },
  {
    name: "Orders & Guests",
    area: "Events CRM",
    status: "Not Started",
    dataSource: "—",
    notes: "Guest/buyer model and order workflow planned for next sprint.",
  },
  {
    name: "Event Check-In",
    area: "Events CRM",
    status: "Placeholder",
    dataSource: "—",
    notes: "Check-in UI shell exists. No real check-in backend yet.",
  },
  // ─── System ───
  {
    name: "User Management",
    area: "System",
    status: "Live",
    dataSource: "Real DB",
    notes: "User CRUD, role management, activate/deactivate. Admin-only.",
    configLink: "/settings/users",
  },
  {
    name: "Audit Logs",
    area: "System",
    status: "Partial",
    dataSource: "Real DB",
    notes: "Audit log viewer exists. Log calls missing from some CRUD routes.",
    configLink: "/settings/audit",
  },
  {
    name: "RBAC / Route Auth",
    area: "System",
    status: "Partial",
    dataSource: "JWT cookie auth",
    notes: "requireAuth on all routes. Admin-only role checks on destructive operations.",
    configLink: "/settings/roles",
  },
  {
    name: "Import / Export",
    area: "System",
    status: "Partial",
    dataSource: "Real DB",
    notes: "CSV import mapper with field mapping, validation, duplicate detection, dry-run. Export planned.",
    configLink: "/settings/import-export",
  },
  {
    name: "Grants / Grant Management",
    area: "System",
    status: "Live",
    dataSource: "Real DB",
    notes: "Grant funders, grant records, activities, and deadlines.",
  },
  {
    name: "Blog Builder",
    area: "System",
    status: "Not Started",
    dataSource: "—",
    notes: "Planned. No model or UI yet.",
  },
];

/** Group modules by area */
function groupByArea(modules: Module[]): Map<string, Module[]> {
  const map = new Map<string, Module[]>();
  for (const m of modules) {
    if (!map.has(m.area)) map.set(m.area, []);
    map.get(m.area)!.push(m);
  }
  return map;
}

/** CRM Modules settings page */
export default function ModulesSettingsPage() {
  const groups = groupByArea(MODULES);

  const liveCount = MODULES.filter((m) => m.status === "Live").length;
  const partialCount = MODULES.filter((m) => m.status === "Partial" || m.status === "In Progress").length;
  const plannedCount = MODULES.filter((m) => ["Placeholder", "Not Started"].includes(m.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">CRM Modules</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Feature status matrix for all OyamaCRM modules, data sources, and configuration areas.
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium border border-green-200">
          ✓ {liveCount} Live
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium border border-blue-200">
          ◐ {partialCount} Partial / In Progress
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-sm font-medium border border-gray-200">
          ○ {plannedCount} Planned
        </span>
      </div>

      {/* Module groups */}
      {Array.from(groups.entries()).map(([area, modules]) => (
        <section key={area} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-700">{area}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {modules.map((mod) => (
              <div key={mod.name} className="px-5 py-3 flex items-start gap-4">
                {/* Name + notes */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{mod.name}</span>
                    {mod.configLink && (
                      <Link
                        href={mod.configLink}
                        className="text-xs text-green-600 hover:text-green-700 hover:underline"
                      >
                        Configure →
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{mod.notes}</p>
                  <p className="text-xs text-gray-400 mt-0.5 italic">Data: {mod.dataSource}</p>
                </div>
                {/* Status badge */}
                <span
                  className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[mod.status]}`}
                >
                  {mod.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
