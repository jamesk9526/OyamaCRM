/** Send-log table for campaign-level communications activity. */
"use client";

import type { CampaignSendLogEntry } from "@/app/components/communications/campaign-workspace-types";
import { formatSendAction, formatWorkspaceDate } from "@/app/components/communications/campaign-workspace-utils";

interface Props {
  logs: CampaignSendLogEntry[];
  loading: boolean;
  onRefresh: () => void;
}

/** Formats one audit metadata payload into concise operational send details. */
function formatLogDetails(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return "-";

  const errorMessage = typeof metadata.message === "string" ? metadata.message : "";
  if (errorMessage) return errorMessage;

  const parts: string[] = [];
  const trigger = typeof metadata.trigger === "string" ? metadata.trigger : "";
  const sendMode = typeof metadata.sendMode === "string" ? metadata.sendMode : "";
  const audienceType = typeof metadata.audienceType === "string" ? metadata.audienceType : "";
  const finalSendCount = typeof metadata.finalSendCount === "number" ? metadata.finalSendCount : undefined;
  const totalMatched = typeof metadata.totalMatched === "number" ? metadata.totalMatched : undefined;
  const suppressed = typeof metadata.suppressed === "number" ? metadata.suppressed : undefined;
  const optedOut = typeof metadata.optedOut === "number" ? metadata.optedOut : undefined;

  if (trigger) parts.push(`trigger=${trigger.toLowerCase()}`);
  if (sendMode) parts.push(`mode=${sendMode.toLowerCase()}`);
  if (audienceType) parts.push(`audience=${audienceType}`);
  if (typeof finalSendCount === "number") parts.push(`final=${finalSendCount}`);
  if (typeof totalMatched === "number") parts.push(`matched=${totalMatched}`);
  if (typeof suppressed === "number") parts.push(`suppressed=${suppressed}`);
  if (typeof optedOut === "number") parts.push(`optedOut=${optedOut}`);

  if (parts.length === 0) return "-";
  return parts.join(" · ");
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
        <>
        <div className="md:hidden divide-y divide-gray-100">
          {logs.map((entry) => {
            const details = formatLogDetails(entry.metadata);
            const hasError = typeof entry.metadata?.message === "string";

            return (
              <article key={entry.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-500">{formatWorkspaceDate(entry.createdAt)}</p>
                  <span className="text-xs font-medium text-gray-800">{formatSendAction(entry.action)}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">Actor: {entry.user?.name || "System"}</p>
                <p className={`mt-1 text-xs ${hasError ? "text-red-600" : "text-gray-600"}`}>{details}</p>
              </article>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
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
                const details = formatLogDetails(entry.metadata);
                const hasError = typeof entry.metadata?.message === "string";

                return (
                  <tr key={entry.id} className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-600">{formatWorkspaceDate(entry.createdAt)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{formatSendAction(entry.action)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{entry.user?.name || "System"}</td>
                    <td className={`px-4 py-2.5 text-xs ${hasError ? "text-red-600" : "text-gray-600"}`}>
                      {details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}
