// Security-feed table for OyamaWatchdog merged events and incident workflow actions.
"use client";

import { WatchdogSecurityFeedItem } from "@/app/components/watchdog/types";

type IncidentAction = "acknowledge" | "escalate" | "resolve";

interface WatchdogSecurityFeedProps {
  items: WatchdogSecurityFeedItem[];
  onAction: (item: WatchdogSecurityFeedItem, action: IncidentAction) => Promise<void>;
  actingKey: string | null;
}

/** WatchdogSecurityFeed lists recent high-signal events across all module logs. */
export default function WatchdogSecurityFeed({ items, onAction, actingKey }: WatchdogSecurityFeedProps) {
  const severityClass: Record<WatchdogSecurityFeedItem["severity"], string> = {
    low: "bg-slate-700 text-slate-200",
    medium: "bg-blue-900/70 text-blue-200",
    high: "bg-amber-900/70 text-amber-200",
    critical: "bg-red-900/70 text-red-200",
  };

  const incidentClass: Record<WatchdogSecurityFeedItem["incidentStatus"], string> = {
    new: "bg-slate-700 text-slate-200",
    acknowledged: "bg-blue-900/70 text-blue-200",
    escalated: "bg-amber-900/70 text-amber-200",
    resolved: "bg-emerald-900/70 text-emerald-200",
  };

  return (
    <section id="feed" className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Security Feed</h2>
          <p className="text-xs text-slate-400">Merged audit stream across DonorCRM, Compassion CRM, Events, and Watchdog.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-700">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">Module</th>
              <th className="py-2 pr-3">Event</th>
              <th className="py-2">Message</th>
              <th className="py-2 pr-3">Incident</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className="py-5 text-slate-500" colSpan={7}>No security events yet.</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-800/80">
                <td className="py-2 pr-3 text-slate-300">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${severityClass[item.severity]}`}>
                    {item.severity}
                  </span>
                </td>
                <td className="py-2 pr-3 text-slate-200 capitalize">{item.sourceModule}</td>
                <td className="py-2 pr-3 text-slate-300">{item.eventType}</td>
                <td className="py-2 text-slate-300">{item.message}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${incidentClass[item.incidentStatus]}`}>
                    {item.incidentStatus}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-1.5">
                    {(["acknowledge", "escalate", "resolve"] as const).map((action) => {
                      const isRunning = actingKey === `${item.id}:${action}`;
                      const isDisabled = item.incidentStatus === "resolved" || actingKey !== null;
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => void onAction(item, action)}
                          disabled={isDisabled}
                          className="px-2 py-1 text-[11px] rounded border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRunning ? "..." : action}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
