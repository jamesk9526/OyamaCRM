/** Delivery event analytics panel for per-recipient communications tracking. */
"use client";

import type { DeliveryEventsResponse } from "@/app/components/communications/campaign-workspace-types";
import { formatWorkspaceDate } from "@/app/components/communications/campaign-workspace-utils";

interface Props {
  data: DeliveryEventsResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

/** CampaignDeliveryEventsPanel renders aggregate delivery metrics plus recent recipient-level events. */
export default function CampaignDeliveryEventsPanel({ data, loading, onRefresh }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Delivery Analytics</h2>
          <p className="mt-0.5 text-xs text-gray-500">Queued, delivered, opened, clicked, and bounced recipients for this mailing.</p>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 px-5 py-4">
          <div className="h-16 animate-pulse rounded bg-gray-100" />
          <div className="h-40 animate-pulse rounded bg-gray-100" />
        </div>
      ) : !data ? (
        <div className="px-5 py-8 text-sm text-gray-500">Delivery analytics unavailable.</div>
      ) : (
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Delivered" value={data.summary.delivered.toLocaleString()} />
            <Metric label="Opened" value={`${data.summary.opened.toLocaleString()} (${data.summary.openRate}%)`} />
            <Metric label="Clicked" value={`${data.summary.clicked.toLocaleString()} (${data.summary.clickRate}%)`} />
            <Metric label="Bounced" value={`${data.summary.bounced.toLocaleString()} (${data.summary.bounceRate}%)`} />
          </div>

          {data.events.length === 0 ? (
            <p className="text-sm text-gray-500">No per-recipient events recorded yet.</p>
          ) : (
            <>
            <div className="md:hidden divide-y divide-gray-100 rounded-lg border border-gray-100">
              {data.events.map((event) => (
                <article key={event.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-500">{formatWorkspaceDate(event.eventAt)}</p>
                    <span className="text-xs font-semibold text-gray-800">{event.eventType}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-800 break-all">{event.recipientEmail}</p>
                  <p className="mt-1 text-xs text-gray-600 break-words">
                    {event.metadata ? JSON.stringify(event.metadata) : "-"}
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Recipient</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Event</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-600">{formatWorkspaceDate(event.eventAt)}</td>
                      <td className="px-4 py-2.5 text-gray-700">{event.recipientEmail}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{event.eventType}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">
                        {event.metadata ? JSON.stringify(event.metadata) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

/** Metric displays a compact analytic value card in the delivery summary row. */
function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
