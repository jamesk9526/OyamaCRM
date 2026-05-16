/** Local workspace navigation for Steward Signals dashboard tools. */
"use client";

import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

type StewardWorkspaceSection =
  | "overview"
  | "opportunities"
  | "lapse-radar"
  | "growth-ideas"
  | "donor-research"
  | "cohort-builder"
  | "suggested-actions"
  | "reports";

interface StewardSignalsWorkspaceNavProps {
  activeSection: StewardWorkspaceSection;
  onChange: (section: StewardWorkspaceSection) => void;
}

interface NavItem {
  id: StewardWorkspaceSection;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "lapse-radar", label: "Lapse Radar" },
  { id: "growth-ideas", label: "Growth Ideas" },
  { id: "donor-research", label: "Donor Research" },
  { id: "cohort-builder", label: "Cohort Builder" },
  { id: "suggested-actions", label: "Suggested Actions" },
  { id: "reports", label: "Reports" },
];

/** StewardSignalsWorkspaceNav keeps sections organized as one donor-intelligence workspace. */
export default function StewardSignalsWorkspaceNav({ activeSection, onChange }: StewardSignalsWorkspaceNavProps) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Signal Navigation</p>
      <WorkspaceRibbon scrollable>
        <WorkspaceRibbonGroup label="Intelligence Views">
          {NAV_ITEMS.map((item) => (
            <WorkspaceRibbonButton
              key={item.id}
              label={item.label}
              onClick={() => onChange(item.id)}
              active={activeSection === item.id}
              accentTone="green"
            />
          ))}
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>
    </section>
  );
}

export type { StewardWorkspaceSection };
