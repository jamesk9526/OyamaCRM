/** Generic wizard shell for guided multi-step workspace flows. */
import type { ReactNode } from "react";
import WorkspaceStepIndicator from "@/app/components/workspace-ribbon/WorkspaceStepIndicator";
import WorkspaceBreadcrumbBar, { type WorkspaceBreadcrumbItem } from "@/app/components/layout/WorkspaceBreadcrumbBar";

interface WorkspaceWizardProps {
  title: string;
  description: string;
  steps: string[];
  activeStep: number;
  breadcrumbItems?: WorkspaceBreadcrumbItem[];
  metadata?: string;
  children: ReactNode;
}

/**
 * Wraps wizard pages with shared heading and step indicator chrome.
 */
export default function WorkspaceWizard({
  title,
  description,
  steps,
  activeStep,
  breadcrumbItems,
  metadata,
  children,
}: WorkspaceWizardProps) {
  const items = breadcrumbItems ?? [{ label: "Workflow" }, { label: title }];

  return (
    <div className="space-y-4">
      <div title={description}>
        <WorkspaceBreadcrumbBar
          items={items}
          metadata={metadata ?? `Step ${activeStep + 1} of ${steps.length}`}
        />
      </div>
      <WorkspaceStepIndicator steps={steps} activeStep={activeStep} />
      <section className="rounded-md border border-emerald-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">{children}</section>
    </div>
  );
}
