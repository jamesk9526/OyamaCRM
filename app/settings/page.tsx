/** Settings overview page summarizes core configuration areas and next steps. */
import Link from "next/link";

const CARDS = [
  {
    title: "Organization",
    description: "Profile, timezone, fiscal year, and primary nonprofit details.",
    href: "/settings/organization",
  },
  {
    title: "Branding",
    description: "Logo, primary colors, and public display defaults for forms and pages.",
    href: "/settings/branding",
  },
  {
    title: "Users",
    description: "User onboarding, status controls, role assignment, and workspace access.",
    href: "/settings/users",
  },
  {
    title: "Roles & Scopes",
    description: "Permission matrix and role foundations for route-level RBAC.",
    href: "/settings/roles",
  },
  {
    title: "CRM Modules",
    description: "Enable/disable CRM areas: DonorCRM, Compassion CRM, Events, Automations, and more.",
    href: "/settings/modules",
  },
  {
    title: "Meetings",
    description: "Default meeting types, durations, reminder windows, and follow-up task behavior.",
    href: "/settings/meetings",
  },
  {
    title: "Tasks",
    description: "Task categories, priorities, overdue handling, and auto-assignment rules.",
    href: "/settings/tasks",
  },
  {
    title: "Workspaces",
    description: "Enable/disable OyamaCRM and OyamaCRM-Compassion workspaces.",
    href: "/settings/workspaces",
  },
  {
    title: "System Status",
    description: "Audit-backed feature readiness, versioning, and production-readiness tracking.",
    href: "/settings/system-status",
  },
  {
    title: "Project Status",
    description: "Real-data vs demo-data audit matrix with concrete next-step remediation.",
    href: "/settings/project-status",
  },
  {
    title: "Security",
    description: "Authentication controls plus verified setup-reset recovery for the CRM installation.",
    href: "/settings/security",
  },
];

/** SettingsOverviewPage introduces the settings workspace foundation state. */
export default function SettingsOverviewPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings Workspace</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Centralized setup and configuration for organization, branding, users, permissions, and workspace controls.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-700">
          Foundation status: dedicated settings sidebar is now active, core tabs are created, and deeper functionality can be
          implemented incrementally without changing navigation architecture.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:shadow-sm transition-all"
          >
            <h2 className="text-sm font-semibold text-gray-900">{card.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
