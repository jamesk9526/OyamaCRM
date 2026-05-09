/** Roles settings page — displays the role hierarchy and permission matrix. */

/** Role definition shown in the permission matrix. */
interface RoleDef {
  value: string;
  label: string;
  badge: string;
  desc: string;
  permissions: string[];
}

const ROLE_MATRIX: RoleDef[] = [
  {
    value: "admin",
    label: "Admin",
    badge: "bg-green-100 text-green-800",
    desc: "Full system access — user management, org settings, all creates/edits/deletes.",
    permissions: [
      "All constituent, donation, campaign, event, task operations",
      "User management and role changes",
      "Organization settings and SMTP configuration",
      "Audit log access",
      "Custom fields management",
      "Import/export data tools",
      "CRM reset and recovery snapshots",
    ],
  },
  {
    value: "manager",
    label: "Manager",
    badge: "bg-purple-100 text-purple-800",
    desc: "Operational lead — bulk import/export, advanced reports, full create & edit access.",
    permissions: [
      "All constituent, donation, campaign, event, task create/edit operations",
      "Bulk import and export tools",
      "Advanced reports and analytics",
      "Custom fields management",
      "View audit logs (read-only)",
    ],
  },
  {
    value: "staff",
    label: "Staff",
    badge: "bg-blue-100 text-blue-800",
    desc: "Standard team member — create and edit records, view all data.",
    permissions: [
      "Create and edit constituents, donations, tasks, events",
      "View all reports and dashboards",
      "Log activities and communications",
      "View campaigns (cannot delete)",
    ],
  },
  {
    value: "readonly",
    label: "Read Only",
    badge: "bg-gray-100 text-gray-700",
    desc: "View-only access — all data is visible but nothing can be edited.",
    permissions: [
      "View constituents, donations, campaigns, events, tasks",
      "View reports and dashboards",
      "No create, edit, or delete access",
    ],
  },
  {
    value: "report_viewer",
    label: "Report Viewer",
    badge: "bg-amber-100 text-amber-800",
    desc: "Board member access — simplified dashboard with key fundraising metrics only.",
    permissions: [
      "Board dashboard: YTD revenue, donor retention, giving trend",
      "No access to constituent or donation records",
      "No access to settings or administrative functions",
      "Redirected to /board automatically on login",
    ],
  },
];

/** RolesSettingsPage shows the full 5-tier role hierarchy with permission lists. */
export default function RolesSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Roles &amp; Permissions</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          OyamaCRM uses a 5-tier role hierarchy. Higher roles inherit all permissions of lower roles.
          Fine-grained overrides can be set per user in Settings → Users.
        </p>
      </div>

      {/* Role hierarchy visual */}
      <div className="grid gap-4">
        {ROLE_MATRIX.map((role, i) => (
          <div key={role.value} className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
              <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-sm font-medium ${role.badge}`}>
                {role.label}
              </span>
              <span className="text-sm text-gray-500">{role.desc}</span>
            </div>
            <ul className="ml-6 space-y-1">
              {role.permissions.map((perm) => (
                <li key={perm} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {perm}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Fine-grained permissions note */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Fine-grained Permission Overrides</p>
        <p>
          Admins can grant or deny specific feature-level permissions per user, overriding the role defaults.
          Open Settings → Users, find a user, and click the <strong>Permissions</strong> button to manage overrides.
        </p>
      </div>
    </div>
  );
}
