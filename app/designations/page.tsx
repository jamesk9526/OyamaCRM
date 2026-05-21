// /designations page route for donor fund designation management.
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import DesignationManager from "@/app/components/designations/DesignationManager";

/** Renders the donor designation manager workspace. */
export default function DesignationsPage() {
  return (
    <div className="space-y-5">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Fundraising" },
          { label: "Designations" },
        ]}
        metadata="Fund/designation setup"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Navigate">
          <WorkspaceRibbonButton label="Donations" href="/donations" />
          <WorkspaceRibbonButton label="Campaigns" href="/campaigns" />
          <WorkspaceRibbonButton label="Grants" href="/grants" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <DesignationManager />
    </div>
  );
}
