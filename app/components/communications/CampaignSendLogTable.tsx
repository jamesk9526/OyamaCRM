/** Send-log table for campaign-level communications activity. */
"use client";

import type { CampaignSendLogEntry } from "@/app/components/communications/campaign-workspace-types";
import { formatSendAction, formatWorkspaceDate } from "@/app/components/communications/campaign-workspace-utils";

interface Props {
  logs: CampaignSendLogEntry[];
  loading: boolean;
  onRefresh: () => void;
}

/** CampaignSendLogTable lists send/schedule/test/failure events for this campaign. */
export default function CampaignSendLogTable({ logs, loading, onRefresh }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Send Log</h2>
          <p className="mt-0.5 text-xs text-gray-500">Operational history for this mailing.</p>
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
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-11 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="px-5 py-8 text-sm text-gray-500">No activity yet for this mailing.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actor</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => {
                const metadata = entry.metadata ?? {};
                const sendMode = typeof metadata.sendMode === "string" ? metadata.sendMode : undefined;
                const audienceType = typeof metadata.audienceType === "string" ? metadata.audienceType : undefined;
                const finalSendCount = typeof metadata.finalSendCount === "number" ? metadata.finalSendCount : undefined;
                const errorMessage = typeof metadata.message === "string" ? metadata.message : undefined;

                return (
                  <tr key={entry.id} className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-600">{formatWorkspaceDate(entry.createdAt)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{formatSendAction(entry.action)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{entry.user?.name || "System"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {errorMessage ? (
                        <span className="text-red-600">{errorMessage}</span>
                      ) : (
                        <span>
                          {sendMode ? `mode=${sendMode}` : ""}
                          {audienceType ? ` audience=${audienceType}` : ""}
                          {typeof finalSendCount === "number" ? ` recipients=${finalSendCount}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
