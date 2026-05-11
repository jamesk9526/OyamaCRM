// Guided feature-change fields for improvements to existing functionality.

"use client";

import type { FeatureImportance } from "@/app/components/feedback/types";

interface FeatureChangeValue {
  featureTitle: string;
  featureProblem: string;
  featureRequestedChange: string;
  importance: FeatureImportance | "";
  extraComments: string;
}

interface FeedbackStepFeatureChangeProps {
  value: FeatureChangeValue;
  onChange: (next: FeatureChangeValue) => void;
}

/**
 * FeedbackStepFeatureChange captures requests to adjust existing product behavior.
 * It keeps input focused on the current pain point and desired future behavior.
 */
export function FeedbackStepFeatureChange({ value, onChange }: FeedbackStepFeatureChangeProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Describe the feature change</h3>
        <p className="text-xs text-slate-500 mt-1">Include where the current behavior falls short and how it should work instead.</p>
      </div>

      <label className="block text-xs font-medium text-slate-700">
        Feature name <span className="text-rose-600">*</span>
        <input
          value={value.featureTitle}
          onChange={(event) => onChange({ ...value, featureTitle: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Example: Donation import mapping"
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        What is difficult today? <span className="text-rose-600">*</span>
        <textarea
          value={value.featureProblem}
          onChange={(event) => onChange({ ...value, featureProblem: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Explain the current friction, confusion, or recurring inefficiency."
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        Requested change <span className="text-rose-600">*</span>
        <textarea
          value={value.featureRequestedChange}
          onChange={(event) => onChange({ ...value, featureRequestedChange: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Describe how the feature should behave after the change."
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-slate-700">
          Importance
          <select
            value={value.importance}
            onChange={(event) => onChange({ ...value, importance: event.target.value as FeatureImportance | "" })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">Select importance</option>
            <option value="low">Low</option>
            <option value="helpful">Helpful</option>
            <option value="important">Important</option>
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
          placeholder="Optional context such as affected teams, deadlines, or compliance concerns."
        />
      </label>
    </div>
  );
}
