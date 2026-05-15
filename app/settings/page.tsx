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
    title: "Branding",
    description: "Logo, primary colors, and public display defaults for forms and pages.",
    href: "/settings/branding",
  },
  {
    title: "Plugins",
    description: "Enable third-party integrations like QuickBooks. Control what features are available to staff.",
    href: "/settings/plugins",
  },
  {
    title: "Site Embeds",
    description: "Generate secure website snippets, configure domain allow-lists, and manage LiveCom public widget installs.",
    href: "/settings/site-embeds",
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
          <WorkspaceRibbonButton label="Security" href="/settings/security" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="System">
          <WorkspaceRibbonButton label="Modules" href="/settings/modules" />
          <WorkspaceRibbonButton label="AI" href="/settings/ai" />
          <WorkspaceRibbonButton label="Plugins" href="/settings/plugins" />
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
