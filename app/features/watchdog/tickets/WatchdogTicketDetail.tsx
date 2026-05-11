// Detail panel with assignment and resolution controls for one Watchdog feedback ticket.

"use client";

import { useEffect, useState } from "react";
import { WatchdogTicketStatusBadge } from "@/app/features/watchdog/tickets/WatchdogTicketStatusBadge";
import type {
  WatchdogFeedbackPriority,
  WatchdogFeedbackTicket,
  WatchdogFeedbackTicketStatus,
  WatchdogTicketUser,
} from "@/app/features/watchdog/tickets/types";

interface WatchdogTicketDetailProps {
  ticket: WatchdogFeedbackTicket | null;
  developers: WatchdogTicketUser[];
  busy: boolean;
  onSave: (params: {
    status: WatchdogFeedbackTicketStatus;
    priority: WatchdogFeedbackPriority;
    assignedDeveloperId: string | null;
    developerNotes: string;
    resolutionNotes: string;
  }) => Promise<void>;
  onResolve: (resolutionNotes: string) => Promise<void>;
  onReopen: () => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * WatchdogTicketDetail shows one selected ticket with triage controls.
 * Local state allows batch edits before one API save operation.
 */
export function WatchdogTicketDetail({ ticket, developers, busy, onSave, onResolve, onReopen, onDelete }: WatchdogTicketDetailProps) {
  const [status, setStatus] = useState<WatchdogFeedbackTicketStatus>("new");
  const [priority, setPriority] = useState<WatchdogFeedbackPriority>("normal");
  const [assignedDeveloperId, setAssignedDeveloperId] = useState<string>("");
  const [developerNotes, setDeveloperNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    if (!ticket) return;

    setStatus(ticket.status);
    setPriority(ticket.priority);
    setAssignedDeveloperId(ticket.assignedDeveloperId ?? "");
    setDeveloperNotes(ticket.developerNotes ?? "");
    setResolutionNotes(ticket.resolutionNotes ?? "");
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-400">
        Select one ticket to view details and update status.
      </div>
    );
  }

  const isResolved = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{ticket.ticketNumber}</p>
          <p className="text-xs text-slate-400 mt-0.5">{ticket.type.replaceAll("_", " ")} • {ticket.crmScope}</p>
        </div>
        <WatchdogTicketStatusBadge status={ticket.status} priority={ticket.priority} />
      </div>

      <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Submitted Context</p>
          <p className="text-xs text-slate-300">From: <span className="text-slate-100">{ticket.submittedByDisplayName || ticket.submittedByEmail || "Unknown"}</span></p>
          <p className="text-xs text-slate-300 break-all">Route: <span className="text-slate-100">{ticket.routePath || ticket.pageUrl}</span></p>
          <p className="text-xs text-slate-300">Environment: <span className="text-slate-100">{ticket.environment || "unknown"}</span></p>
        </div>

        {ticket.whatTryingToDo ? (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">What user tried to do</p>
            <p className="text-sm text-slate-100 whitespace-pre-wrap">{ticket.whatTryingToDo}</p>
          </div>
        ) : null}

        {ticket.whatHappened ? (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">What happened</p>
            <p className="text-sm text-slate-100 whitespace-pre-wrap">{ticket.whatHappened}</p>
          </div>
        ) : null}

        {ticket.expectedResult ? (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Expected result</p>
            <p className="text-sm text-slate-100 whitespace-pre-wrap">{ticket.expectedResult}</p>
          </div>
        ) : null}

        {ticket.featureTitle || ticket.featureProblem || ticket.featureRequestedChange ? (
          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Feature Request Details</p>
            {ticket.featureTitle ? <p className="text-sm text-slate-100"><span className="text-slate-400">Title:</span> {ticket.featureTitle}</p> : null}
            {ticket.featureProblem ? <p className="text-sm text-slate-100 whitespace-pre-wrap"><span className="text-slate-400">Problem:</span> {ticket.featureProblem}</p> : null}
            {ticket.featureRequestedChange ? <p className="text-sm text-slate-100 whitespace-pre-wrap"><span className="text-slate-400">Requested change:</span> {ticket.featureRequestedChange}</p> : null}
            {ticket.featureAudience ? <p className="text-sm text-slate-100"><span className="text-slate-400">Audience:</span> {ticket.featureAudience}</p> : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-xs font-medium text-slate-300">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as WatchdogFeedbackTicketStatus)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <option value="new">New</option>
              <option value="in_review">In review</option>
              <option value="in_progress">In progress</option>
              <option value="waiting_on_user">Waiting on user</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-300">
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as WatchdogFeedbackPriority)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-300">
            Assigned Developer
            <select
              value={assignedDeveloperId}
              onChange={(event) => setAssignedDeveloperId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <option value="">Unassigned</option>
              {developers.map((developer) => (
                <option key={developer.id} value={developer.id}>{developer.displayName ?? `${developer.firstName} ${developer.lastName}`}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-xs font-medium text-slate-300">
          Developer notes
          <textarea
            value={developerNotes}
            onChange={(event) => setDeveloperNotes(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            placeholder="Internal triage details, root-cause notes, or implementation links."
          />
        </label>

        <label className="block text-xs font-medium text-slate-300">
          Resolution notes
          <textarea
            value={resolutionNotes}
            onChange={(event) => setResolutionNotes(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            placeholder="What was fixed, when, and any follow-up guidance for users."
          />
        </label>
      </div>

      <div className="px-4 py-3 border-t border-slate-700 bg-slate-950/70 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onSave({
            status,
            priority,
            assignedDeveloperId: assignedDeveloperId || null,
            developerNotes,
            resolutionNotes,
          })}
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
        >
          Save Changes
        </button>

        {!isResolved ? (
          <button
            type="button"
            onClick={() => void onResolve(resolutionNotes)}
            disabled={busy}
            className="px-3 py-2 rounded-lg border border-emerald-500/70 bg-emerald-600/15 text-emerald-200 text-sm font-medium hover:bg-emerald-600/25 disabled:opacity-60"
          >
            Resolve
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onReopen()}
            disabled={busy}
            className="px-3 py-2 rounded-lg border border-amber-500/70 bg-amber-600/15 text-amber-200 text-sm font-medium hover:bg-amber-600/25 disabled:opacity-60"
          >
            Reopen
          </button>
        )}

        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={busy}
          className="ml-auto px-3 py-2 rounded-lg border border-rose-500/70 bg-rose-600/15 text-rose-200 text-sm font-medium hover:bg-rose-600/25 disabled:opacity-60"
        >
          Delete Ticket
        </button>
      </div>
    </div>
  );
}
