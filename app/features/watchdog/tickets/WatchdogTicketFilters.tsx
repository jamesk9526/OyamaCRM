// Filter controls for narrowing the Watchdog feedback triage queue.

"use client";

import type { WatchdogTicketFilters, WatchdogTicketUser } from "@/app/features/watchdog/tickets/types";

interface WatchdogTicketFiltersProps {
  value: WatchdogTicketFilters;
  developers: WatchdogTicketUser[];
  onChange: (next: WatchdogTicketFilters) => void;
  onReset: () => void;
}

/**
 * WatchdogTicketFilters renders queue filters for status, type, scope, and assignee.
 * All controls are controlled inputs so parent state drives API fetch parameters.
 */
export function WatchdogTicketFilters({ value, developers, onChange, onReset }: WatchdogTicketFiltersProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">Queue Filters</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-300 hover:text-white"
        >
          Reset
        </button>
      </div>

      <label className="block text-xs font-medium text-slate-300">
        Search
        <input
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          placeholder="ticket number, page, notes"
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="block text-xs font-medium text-slate-300">
          Status
          <select
            value={value.status}
            onChange={(event) => onChange({ ...value, status: event.target.value as WatchdogTicketFilters["status"] })}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in_review">In review</option>
            <option value="in_progress">In progress</option>
            <option value="waiting_on_user">Waiting on user</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-300">
          Type
          <select
            value={value.type}
            onChange={(event) => onChange({ ...value, type: event.target.value as WatchdogTicketFilters["type"] })}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="all">All types</option>
            <option value="bug_report">Bug report</option>
            <option value="feature_request">Feature request</option>
            <option value="feature_change">Feature change</option>
            <option value="confusing_ui">Confusing UI</option>
            <option value="data_issue">Data issue</option>
            <option value="general_feedback">General feedback</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-300">
          Priority
          <select
            value={value.priority}
            onChange={(event) => onChange({ ...value, priority: event.target.value as WatchdogTicketFilters["priority"] })}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-300">
          CRM Scope
          <select
            value={value.crmScope}
            onChange={(event) => onChange({ ...value, crmScope: event.target.value as WatchdogTicketFilters["crmScope"] })}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="all">All scopes</option>
            <option value="donor">DonorCRM</option>
            <option value="compassion">Compassion CRM</option>
            <option value="events">Events CRM</option>
            <option value="watchdog">Watchdog</option>
            <option value="webmaster">Webmaster</option>
            <option value="hrm">HRM</option>
            <option value="reportit">ReportIT</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-300">
          Assigned To
          <select
            value={value.assignedTo}
            onChange={(event) => onChange({ ...value, assignedTo: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {developers.map((developer) => (
              <option key={developer.id} value={developer.id}>{developer.displayName ?? `${developer.firstName} ${developer.lastName}`}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
