// Step component for selecting the feedback category in the guided modal flow.

"use client";

import type { FeedbackType } from "@/app/components/feedback/types";

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string; helper: string }> = [
  { value: "bug_report", label: "Bug Report", helper: "Something is broken or behaves unexpectedly." },
  { value: "feature_request", label: "Feature Request", helper: "You want a new capability that does not exist yet." },
  { value: "feature_change", label: "Feature Change", helper: "An existing feature should work differently." },
  { value: "confusing_ui", label: "Confusing UI", helper: "The page flow or labels are difficult to understand." },
  { value: "data_issue", label: "Data Issue", helper: "Values look wrong, stale, or missing." },
  { value: "general_feedback", label: "General Feedback", helper: "Share broad product feedback or suggestions." },
];

interface FeedbackStepTypeProps {
  value: FeedbackType;
  onChange: (value: FeedbackType) => void;
}

/**
 * FeedbackStepType presents one grid of category options and stores the selected type.
 * This choice controls which guided questions appear in later steps.
 */
export function FeedbackStepType({ value, onChange }: FeedbackStepTypeProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">What kind of feedback is this?</h3>
        <p className="text-xs text-slate-500 mt-1">Choose the option that best fits your issue so the Watchdog team can triage correctly.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TYPE_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all ${active ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
            >
              <p className="text-sm font-semibold text-slate-900">{option.label}</p>
              <p className="text-xs text-slate-600 mt-1">{option.helper}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
