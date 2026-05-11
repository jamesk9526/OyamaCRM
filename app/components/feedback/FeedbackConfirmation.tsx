// Confirmation card rendered after one feedback ticket is successfully submitted.

"use client";

interface FeedbackConfirmationProps {
  ticketNumber: string;
  status: string;
  onClose: () => void;
}

/**
 * FeedbackConfirmation provides a clear success state with the new ticket number.
 * It keeps users informed that their submission has entered Watchdog triage.
 */
export function FeedbackConfirmation({ ticketNumber, status, onClose }: FeedbackConfirmationProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-base font-semibold text-slate-900">Feedback submitted</h3>
        <p className="text-sm text-slate-600 mt-1">Your ticket has been queued in Watchdog for triage.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ticket Number</p>
        <p className="text-lg font-semibold text-slate-900 mt-1">{ticketNumber}</p>
        <p className="text-xs text-slate-600 mt-1">Current status: <span className="font-medium text-slate-800">{status}</span></p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
