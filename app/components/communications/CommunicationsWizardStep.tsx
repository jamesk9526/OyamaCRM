/** Shared wizard step shell for Communications guided creation flow. */
"use client";

import Link from "next/link";
import WorkspaceWizard from "@/app/components/workspace-ribbon/WorkspaceWizard";

interface CommunicationsWizardStepProps {
  stepIndex: number;
  title: string;
  helper: string;
  nextHref?: string;
  prevHref?: string;
}

const STEPS = ["Choose Type", "Choose Audience", "Choose Preset", "Edit", "Review", "Send"];

/**
 * Provides a consistent guided shell for communications wizard pages.
 */
export default function CommunicationsWizardStep({ stepIndex, title, helper, nextHref, prevHref }: CommunicationsWizardStepProps) {
  return (
    <WorkspaceWizard
      title={title}
      description={helper}
      steps={STEPS}
      activeStep={stepIndex}
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "Communications", href: "/communications" },
        { label: STEPS[stepIndex] },
      ]}
      metadata={`Step ${stepIndex + 1} of ${STEPS.length}`}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          This guided step is part of the communication project flow: Choose Type {"->"} Choose Audience {"->"} Choose Preset {"->"} Edit {"->"} Review {"->"} Schedule/Send.
        </p>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Current Step</p>
          <p className="mt-1 text-sm text-gray-800">{STEPS[stepIndex]}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/communications" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            Communications Home
          </Link>
          {prevHref ? (
            <Link href={prevHref} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              Previous Step
            </Link>
          ) : null}
          {nextHref ? (
            <Link href={nextHref} className="rounded-lg border border-green-600 bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
              Continue
            </Link>
          ) : null}
        </div>
      </div>
    </WorkspaceWizard>
  );
}
