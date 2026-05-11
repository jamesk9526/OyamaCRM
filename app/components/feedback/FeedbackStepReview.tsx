// Review step showing a final summary before feedback submission.

"use client";

import type { FeedbackContextPayload, FeedbackFormState } from "@/app/components/feedback/types";

interface FeedbackStepReviewProps {
  form: FeedbackFormState;
  context: FeedbackContextPayload;
}

/**
 * FeedbackStepReview renders a concise pre-submit preview of user-provided details.
 * This keeps submissions explicit and prevents accidental ticket creation with missing context.
 */
export function FeedbackStepReview({ form, context }: FeedbackStepReviewProps) {
  const isFeatureFlow = form.type === "feature_request" || form.type === "feature_change";

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Review your feedback</h3>
        <p className="text-xs text-slate-500 mt-1">Confirm details before creating a Watchdog ticket.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ticket Type</p>
        <p className="text-sm font-semibold text-slate-900 mt-1">{form.type.replaceAll("_", " ")}</p>
      </div>

      {isFeatureFlow ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs text-slate-500">Feature title</p>
          <p className="text-sm text-slate-900">{form.featureTitle || "(not provided)"}</p>
          <p className="text-xs text-slate-500">Problem</p>
          <p className="text-sm text-slate-900">{form.featureProblem || "(not provided)"}</p>
          <p className="text-xs text-slate-500">Requested change</p>
          <p className="text-sm text-slate-900">{form.featureRequestedChange || "(not provided)"}</p>
          <p className="text-xs text-slate-500">Audience</p>
          <p className="text-sm text-slate-900">{form.featureAudience || "(not provided)"}</p>
          <p className="text-xs text-slate-500">Importance</p>
          <p className="text-sm text-slate-900">{form.importance || "(not provided)"}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs text-slate-500">Trying to do</p>
          <p className="text-sm text-slate-900">{form.whatTryingToDo || "(not provided)"}</p>
          <p className="text-xs text-slate-500">What happened</p>
          <p className="text-sm text-slate-900">{form.whatHappened || "(not provided)"}</p>
          <p className="text-xs text-slate-500">Expected result</p>
          <p className="text-sm text-slate-900">{form.expectedResult || "(not provided)"}</p>
          <p className="text-xs text-slate-500">Priority</p>
          <p className="text-sm text-slate-900">{form.priority}</p>
        </div>
      )}

      {form.extraComments ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
          <p className="text-xs text-slate-500">Extra comments</p>
          <p className="text-sm text-slate-900">{form.extraComments}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Captured Context</p>
        <p className="text-xs text-slate-600">CRM scope: <span className="font-medium text-slate-800">{context.crmScope}</span></p>
        <p className="text-xs text-slate-600">Route: <span className="font-medium text-slate-800">{context.routePath}</span></p>
        <p className="text-xs text-slate-600 break-all">URL: <span className="font-medium text-slate-800">{context.pageUrl}</span></p>
      </div>
    </div>
  );
}
