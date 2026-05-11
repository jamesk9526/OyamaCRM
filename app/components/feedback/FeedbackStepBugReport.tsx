// Guided bug/general feedback step fields used by the feedback modal.

"use client";

import type { FeedbackPriority } from "@/app/components/feedback/types";

interface BugReportValue {
  whatTryingToDo: string;
  whatHappened: string;
  expectedResult: string;
  extraComments: string;
  priority: FeedbackPriority;
}

interface FeedbackStepBugReportProps {
  value: BugReportValue;
  onChange: (next: BugReportValue) => void;
}

/**
 * FeedbackStepBugReport renders issue-oriented prompts for bug-like submissions.
 * The same step is reused for bug, confusing UI, data issue, and general feedback types.
 */
export function FeedbackStepBugReport({ value, onChange }: FeedbackStepBugReportProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Tell us what happened</h3>
        <p className="text-xs text-slate-500 mt-1">Clear reproduction details help triage quickly and reduce follow-up back-and-forth.</p>
      </div>

      <label className="block text-xs font-medium text-slate-700">
        What were you trying to do? <span className="text-rose-600">*</span>
        <textarea
          value={value.whatTryingToDo}
          onChange={(event) => onChange({ ...value, whatTryingToDo: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Example: I was trying to send a thank-you email from the constituent profile."
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        What happened? <span className="text-rose-600">*</span>
        <textarea
          value={value.whatHappened}
          onChange={(event) => onChange({ ...value, whatHappened: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Describe the behavior, error message, or incorrect result."
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        What did you expect to happen?
        <textarea
          value={value.expectedResult}
          onChange={(event) => onChange({ ...value, expectedResult: event.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Expected behavior helps us spot the gap quickly."
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-slate-700">
          Priority
          <select
            value={value.priority}
            onChange={(event) => onChange({ ...value, priority: event.target.value as FeedbackPriority })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-700">
        Extra comments
        <textarea
          value={value.extraComments}
          onChange={(event) => onChange({ ...value, extraComments: event.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Optional: include edge cases, workarounds, or impact details."
        />
      </label>
    </div>
  );
}
