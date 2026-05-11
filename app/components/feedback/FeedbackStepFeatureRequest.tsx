// Guided feature-request fields for the cross-CRM feedback modal flow.

"use client";

import type { FeatureImportance } from "@/app/components/feedback/types";

interface FeatureRequestValue {
  featureTitle: string;
  featureProblem: string;
  featureAudience: string;
  featureRequestedChange: string;
  importance: FeatureImportance | "";
  extraComments: string;
}

interface FeedbackStepFeatureRequestProps {
  value: FeatureRequestValue;
  onChange: (next: FeatureRequestValue) => void;
}

/**
 * FeedbackStepFeatureRequest captures product-gap requests that require net-new capabilities.
 * It focuses on problem context, audience, and value to support roadmap prioritization.
 */
export function FeedbackStepFeatureRequest({ value, onChange }: FeedbackStepFeatureRequestProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Describe the feature request</h3>
        <p className="text-xs text-slate-500 mt-1">These details help product and engineering scope the request and estimate impact.</p>
      </div>

      <label className="block text-xs font-medium text-slate-700">
        Feature title <span className="text-rose-600">*</span>
        <input
          value={value.featureTitle}
          onChange={(event) => onChange({ ...value, featureTitle: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Example: Bulk close resolved tasks"
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        Problem this solves <span className="text-rose-600">*</span>
        <textarea
          value={value.featureProblem}
          onChange={(event) => onChange({ ...value, featureProblem: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="What workflow is currently difficult without this feature?"
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        Who benefits?
        <input
          value={value.featureAudience}
          onChange={(event) => onChange({ ...value, featureAudience: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Example: development admins, front-desk staff, donor managers"
        />
      </label>

      <label className="block text-xs font-medium text-slate-700">
        What change would you like? <span className="text-rose-600">*</span>
        <textarea
          value={value.featureRequestedChange}
          onChange={(event) => onChange({ ...value, featureRequestedChange: event.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Describe the ideal behavior, inputs, outputs, and where it should appear."
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
          placeholder="Optional details such as urgency deadlines or workaround limitations."
        />
      </label>
    </div>
  );
}
