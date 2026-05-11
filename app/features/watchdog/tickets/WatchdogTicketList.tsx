// Scrollable ticket list pane for the Watchdog feedback triage workspace.

"use client";

import { WatchdogTicketStatusBadge } from "@/app/features/watchdog/tickets/WatchdogTicketStatusBadge";
import type { WatchdogFeedbackTicket } from "@/app/features/watchdog/tickets/types";

interface WatchdogTicketListProps {
  items: WatchdogFeedbackTicket[];
  selectedTicketId: string | null;
  loading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onSelect: (ticketId: string) => void;
  onPageChange: (page: number) => void;
}

/**
 * WatchdogTicketList renders queue rows with status chips and quick metadata.
 * Rows are keyboard-accessible buttons so operators can triage rapidly.
 */
export function WatchdogTicketList({
  items,
  selectedTicketId,
  loading,
  pagination,
  onSelect,
  onPageChange,
}: WatchdogTicketListProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">Feedback Queue</h3>
        <p className="text-xs text-slate-400">{pagination.total} ticket(s)</p>
      </div>

      <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-800">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-400">Loading tickets...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">No tickets match the current filters.</div>
        ) : (
          items.map((item) => {
            const selected = selectedTicketId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${selected ? "bg-red-600/10" : "hover:bg-slate-800/60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{item.ticketNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{item.type.replaceAll("_", " ")} • {item.crmScope}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{item.pageTitle || item.routePath || item.pageUrl}</p>
                    <p className="text-xs text-slate-500 mt-1">By {item.submittedByDisplayName || item.submittedByEmail || "Unknown"}</p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <WatchdogTicketStatusBadge status={item.status} priority={item.priority} />
                    <p className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-700 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(pagination.page - 1, 1))}
          disabled={pagination.page <= 1}
          className="px-2.5 py-1.5 text-xs rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Previous
        </button>
        <p className="text-xs text-slate-400">Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</p>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pagination.page + 1, Math.max(pagination.totalPages, 1)))}
          disabled={pagination.page >= pagination.totalPages}
          className="px-2.5 py-1.5 text-xs rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
