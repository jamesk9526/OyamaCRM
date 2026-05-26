/** Settings overview page summarizes core configuration areas and next steps. */
import Link from "next/link";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

const CARDS = [
  {
    title: "Organization",
    description: "Profile, timezone, fiscal year, and primary nonprofit details.",
    href: "/settings/organization",
  },
  {
    title: "Desktop App",
    description: "Download the Windows one-click installer for the OyamaCRM desktop shell.",
    href: "/settings/desktop-app",
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
    title: "AI Assistant",
    description: "Configure Steward AI with local Ollama or a remote hosted Ollama endpoint.",
    href: "/settings/ai",
  },
  {
    title: "CRM Modules",
    description: "Enable and govern module access for DonorCRM, Compassion CRM, and Events CRM.",
    href: "/settings/modules",
  },
  {
    title: "System Updates",
    description: "Admin-only release manager with backup, migration, smoke test, and rollback controls.",
    href: "/settings/system-updates",
  },
  {
    title: "System Status",
    description: "Combined system readiness and project-status evidence for release planning.",
    href: "/settings/system-status",
  },
  {
    title: "Branding",
    description: "Logo, primary colors, and public display defaults for forms and pages.",
    href: "/settings/branding",
  },
  {
    title: "Dashboard Appearance",
    description: "Configure the Donor Dashboard header image, overlay, quote card, density, and visible sections.",
    href: "/settings/dashboard-appearance",
  },
  {
    title: "Integrations",
    description: "Unified integration readiness and plugin controls for QuickBooks, embeds, SMTP, and AI.",
    href: "/settings/integrations",
  },
  {
    title: "Payments",
    description: "Stripe and PayPal gateway settings, encryption-safe secrets, and donation checkout diagnostics.",
    href: "/settings/payments",
  },
  {
    title: "Site Embeds",
    description: "Generate secure website snippets, configure domain allow-lists, and manage LiveCom public widget installs.",
    href: "/settings/site-embeds",
  },
  {
    title: "Security & Audit",
    description: "Authentication controls, recovery actions, and audit log visibility in one place.",
    href: "/settings/security",
  },
];

/** SettingsOverviewPage introduces the settings workspace foundation state. */
export default function SettingsOverviewPage() {
  return (
    <div className="space-y-5">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Settings" },
        ]}
        metadata={`${CARDS.length} settings areas`}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Core">
          <WorkspaceRibbonButton label="Organization" href="/settings/organization" />
          <WorkspaceRibbonButton label="Users" href="/settings/users" />
          <WorkspaceRibbonButton label="Roles" href="/settings/roles" />
          <WorkspaceRibbonButton label="Security & Audit" href="/settings/security" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="System">
          <WorkspaceRibbonButton label="Modules" href="/settings/modules" />
          <WorkspaceRibbonButton label="AI" href="/settings/ai" />
          <WorkspaceRibbonButton label="Dashboard Appearance" href="/settings/dashboard-appearance" />
          <WorkspaceRibbonButton label="Integrations" href="/settings/integrations" />
          <WorkspaceRibbonButton label="Payments" href="/settings/payments" />
          <WorkspaceRibbonButton label="System Updates" href="/settings/system-updates" />
          <WorkspaceRibbonButton label="System Status" href="/settings/system-status" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-700">
          Settings is now organized around one-home paths for identity, access, modules, AI, and platform governance. Module-specific
          operational workflows should live in their CRM workspaces rather than duplicate here.
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
