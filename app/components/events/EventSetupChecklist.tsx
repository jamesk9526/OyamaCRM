"use client";
/** EventSetupChecklist renders the critical setup steps for preparing an event for registration and check-in. */

import Link from "next/link";

interface SetupStep {
  /** Step label. */
  label: string;
  /** Whether the step is complete. */
  complete: boolean;
  /** Optional route to navigate to when clicked. */
  href?: string;
  /** Optional helper text. */
  helper?: string;
}

interface EventSetupChecklistProps {
  /** The event name shown in the header. */
  eventName: string;
  /** List of setup steps. */
  steps: SetupStep[];
  /** Optional completion percentage override. */
  completionPercentage?: number;
}

/**
 * EventSetupChecklist shows a linear setup flow for preparing an event,
 * tracking completion of tickets, sponsors, communications, and check-in readiness.
 */
export default function EventSetupChecklist({
  eventName,
  steps,
  completionPercentage,
}: EventSetupChecklistProps) {
  const completed = steps.filter((s) => s.complete).length;
  const total = steps.length;
  const percentage = completionPercentage ?? Math.round((completed / total) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-br from-amber-50 to-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Event Setup Progress</h2>
            <p className="text-xs text-gray-500 mt-0.5">{eventName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-600">{percentage}%</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Complete</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const content = (
              <>
                <div
                  className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.complete
                      ? "bg-green-600 text-white"
                      : "bg-white border-2 border-gray-300 text-gray-400"
                  }`}
                >
                  {step.complete ? "✓" : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${step.complete ? "text-green-900" : "text-gray-900"}`}>
                    {step.label}
                  </p>
                  {step.helper && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.helper}</p>
                  )}
                </div>
                {step.href && !step.complete && (
                  <svg className="shrink-0 w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </>
            );

            const className = `flex items-start gap-3 p-3 rounded-lg border transition-all ${
              step.complete
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200 hover:border-amber-200"
            } ${step.href ? "cursor-pointer" : ""}`;

            if (step.href) {
              return (
                <Link key={idx} href={step.href} className={className}>
                  {content}
                </Link>
              );
            }

            return (
              <div key={idx} className={className}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
