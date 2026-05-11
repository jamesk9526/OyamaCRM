// Guided cross-CRM feedback modal that creates Watchdog triage tickets from any module.

"use client";

import { useEffect, useMemo, useState } from "react";
import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";
import { FeedbackConfirmation } from "@/app/components/feedback/FeedbackConfirmation";
import { FeedbackStepBugReport } from "@/app/components/feedback/FeedbackStepBugReport";
import { FeedbackStepFeatureChange } from "@/app/components/feedback/FeedbackStepFeatureChange";
import { FeedbackStepFeatureRequest } from "@/app/components/feedback/FeedbackStepFeatureRequest";
import { FeedbackStepReview } from "@/app/components/feedback/FeedbackStepReview";
import { FeedbackStepType } from "@/app/components/feedback/FeedbackStepType";
import {
  DEFAULT_FEEDBACK_FORM_STATE,
  type FeedbackContextPayload,
  type FeedbackFormState,
  type FeedbackSubmitResponse,
} from "@/app/components/feedback/types";
import { submitFeedbackTicket } from "@/app/lib/feedback/feedback-api";
import { getFeedbackContext } from "@/app/lib/feedback/getFeedbackContext";

interface FeedbackModalProps {
  open: boolean;
  moduleKey: TopBarModuleKey;
  pathname: string;
  onClose: () => void;
}

/**
 * FeedbackModal orchestrates a short multi-step form and submits one feedback ticket.
 * It intentionally captures only privacy-safe context metadata alongside user-entered text.
 */
export function FeedbackModal({ open, moduleKey, pathname, onClose }: FeedbackModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FeedbackFormState>(DEFAULT_FEEDBACK_FORM_STATE);
  const [context, setContext] = useState<FeedbackContextPayload>(() => getFeedbackContext({ moduleKey, pathname }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<FeedbackSubmitResponse["ticket"] | null>(null);

  useEffect(() => {
    if (!open) return;

    setStepIndex(0);
    setForm(DEFAULT_FEEDBACK_FORM_STATE);
    setSubmitted(null);
    setError(null);
    setContext(getFeedbackContext({ moduleKey, pathname }));
  }, [open, moduleKey, pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const isFeatureFlow = form.type === "feature_request" || form.type === "feature_change";
  const totalSteps = 3;

  const canProceedFromDetails = useMemo(() => {
    if (isFeatureFlow) {
      return Boolean(form.featureTitle.trim() && form.featureProblem.trim() && form.featureRequestedChange.trim());
    }
    return Boolean(form.whatTryingToDo.trim() && form.whatHappened.trim());
  }, [form, isFeatureFlow]);

  if (!open) return null;

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  function goNext() {
    if (stepIndex === 1 && !canProceedFromDetails) {
      setError("Please complete the required fields before continuing.");
      return;
    }
    setError(null);
    setStepIndex((current) => Math.min(current + 1, totalSteps - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit() {
    if (submitting) return;

    if (!canProceedFromDetails) {
      setError("Please complete the required fields before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await submitFeedbackTicket({
        type: form.type,
        priority: isFeatureFlow ? undefined : form.priority,
        importance: form.importance || undefined,
        whatTryingToDo: form.whatTryingToDo || undefined,
        whatHappened: form.whatHappened || undefined,
        expectedResult: form.expectedResult || undefined,
        extraComments: form.extraComments || undefined,
        featureTitle: form.featureTitle || undefined,
        featureProblem: form.featureProblem || undefined,
        featureAudience: form.featureAudience || undefined,
        featureRequestedChange: form.featureRequestedChange || undefined,
        context,
      });
      setSubmitted(response.ticket);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-6">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]" onClick={handleClose} />

      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.35)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cross-CRM Feedback</p>
              <h2 className="text-base font-semibold text-slate-900 mt-1">Send feedback to Watchdog ticketing</h2>
              <p className="text-xs text-slate-600 mt-1">This captures your notes plus page context (URL, module, browser, and environment).</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300"
              aria-label="Close feedback modal"
            >
              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>

          {!submitted ? (
            <div className="mt-3 flex items-center gap-2">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-emerald-500" : "bg-slate-200"}`}
                  aria-hidden="true"
                />
              ))}
              <span className="text-xs font-medium text-slate-600">Step {stepIndex + 1} of {totalSteps}</span>
            </div>
          ) : null}
        </div>

        <div className="p-5 space-y-4 max-h-[74vh] overflow-y-auto">
          {submitted ? (
            <FeedbackConfirmation
              ticketNumber={submitted.ticketNumber}
              status={submitted.status}
              onClose={handleClose}
            />
          ) : (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">Privacy note</p>
                <p className="text-xs text-amber-800 mt-1">
                  Avoid secrets, full SSNs, API keys, or private client-only data in your feedback text.
                  Context capture is limited to route and environment metadata.
                </p>
              </div>

              {stepIndex === 0 ? (
                <FeedbackStepType
                  value={form.type}
                  onChange={(type) => setForm((current) => ({ ...current, type }))}
                />
              ) : null}

              {stepIndex === 1 && !isFeatureFlow ? (
                <FeedbackStepBugReport
                  value={{
                    whatTryingToDo: form.whatTryingToDo,
                    whatHappened: form.whatHappened,
                    expectedResult: form.expectedResult,
                    extraComments: form.extraComments,
                    priority: form.priority,
                  }}
                  onChange={(next) => setForm((current) => ({ ...current, ...next }))}
                />
              ) : null}

              {stepIndex === 1 && form.type === "feature_request" ? (
                <FeedbackStepFeatureRequest
                  value={{
                    featureTitle: form.featureTitle,
                    featureProblem: form.featureProblem,
                    featureAudience: form.featureAudience,
                    featureRequestedChange: form.featureRequestedChange,
                    importance: form.importance,
                    extraComments: form.extraComments,
                  }}
                  onChange={(next) => setForm((current) => ({ ...current, ...next }))}
                />
              ) : null}

              {stepIndex === 1 && form.type === "feature_change" ? (
                <FeedbackStepFeatureChange
                  value={{
                    featureTitle: form.featureTitle,
                    featureProblem: form.featureProblem,
                    featureRequestedChange: form.featureRequestedChange,
                    importance: form.importance,
                    extraComments: form.extraComments,
                  }}
                  onChange={(next) => setForm((current) => ({ ...current, ...next }))}
                />
              ) : null}

              {stepIndex === 2 ? <FeedbackStepReview form={form} context={context} /> : null}

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </>
          )}
        </div>

        {!submitted ? (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={submitting}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100 disabled:opacity-60"
                >
                  Back
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>

              {stepIndex < totalSteps - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
