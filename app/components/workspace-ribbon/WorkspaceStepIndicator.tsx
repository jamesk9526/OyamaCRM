/** Compact horizontal step indicator used by wizard pages. */

interface WorkspaceStepIndicatorProps {
  steps: string[];
  activeStep: number;
}

/**
 * Displays wizard progression with a clear active step.
 */
export default function WorkspaceStepIndicator({ steps, activeStep }: WorkspaceStepIndicatorProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/45 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <ol className="flex min-w-max items-center gap-2">
        {steps.map((step, index) => {
          const active = index === activeStep;
          const complete = index < activeStep;
          return (
            <li key={step} className="inline-flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-sm border text-[11px] font-semibold ${
                  active
                    ? "border-green-600 bg-green-600 text-white"
                    : complete
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-gray-300 bg-white text-gray-600"
                }`}
              >
                {index + 1}
              </span>
              <span className={`text-xs font-medium ${active ? "text-gray-900" : "text-gray-500"}`}>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
