/**
 * StatusBadge — renders a colored pill for a grant status.
 * GrantCard — compact card shown in the pipeline/list views.
 */
"use client";

import Link from "next/link";
import { Grant, GrantStatus, STATUS_META, fmt$, fmtDate } from "./types";

/** Colored pill label for a grant status. */
export function StatusBadge({ status }: { status: GrantStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${m.bg} ${m.color} ${m.border}`}>
      {m.label}
    </span>
  );
}

/** Deadline urgency indicator: red if overdue, amber if within 7 days. */
function DeadlineTag({ label, date }: { label: string; date: string | null | undefined }) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const color = daysLeft < 0 ? "text-red-600 bg-red-50 border-red-200"
    : daysLeft <= 7 ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-gray-500 bg-gray-50 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${color}`}>
      🗓 {label}: {fmtDate(date)}
    </span>
  );
}

interface GrantCardProps {
  grant: Grant;
  onEdit?: (g: Grant) => void;
}

/** Returns the primary operational deadline for a grant card. */
function primaryDeadline(grant: Grant): string | null {
  return grant.applicationDeadline ?? grant.loiDeadline ?? null;
}

/** Returns days remaining until primary deadline. */
function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date).getTime();
  const diff = target - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * GrantCard — compact card showing funder, status, amounts, and upcoming deadlines.
 * Links to the full grant detail page.
 */
export default function GrantCard({ grant, onEdit }: GrantCardProps) {
  const requested = Number(grant.amountRequested ?? 0);
  const awarded   = Number(grant.amountAwarded ?? 0);
  const meta = STATUS_META[grant.status];
  const deadline = primaryDeadline(grant);
  const daysLeft = daysUntil(deadline);
  const overdue = daysLeft !== null && daysLeft < 0;
  const dueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col ${meta.border}`}>
      {/* Status stripe */}
      <div className={`h-1 rounded-t-xl ${meta.bg.replace("bg-", "bg-").replace("-50", "-400").replace("-100", "-500")}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/grants/${grant.id}`} className="text-sm font-semibold text-gray-900 hover:text-green-700 line-clamp-2 leading-snug">
              {grant.title}
            </Link>
            <p className="text-xs text-gray-500 mt-0.5">{grant.funder?.name ?? "Unknown funder"}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={grant.status} />
            {daysLeft !== null && (
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${
                overdue
                  ? "text-red-700 bg-red-50 border-red-200"
                  : dueSoon
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-gray-600 bg-gray-50 border-gray-200"
              }`}>
                {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
              </span>
            )}
          </div>
        </div>

        {/* Amounts */}
        {(requested > 0 || awarded > 0) && (
          <div className="flex gap-4 text-xs">
            {requested > 0 && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide font-medium">Requested</p>
                <p className="font-semibold text-gray-800">{fmt$(requested)}</p>
              </div>
            )}
            {awarded > 0 && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide font-medium">Awarded</p>
                <p className="font-semibold text-green-700">{fmt$(awarded)}</p>
              </div>
            )}
          </div>
        )}

        {/* Program area */}
        {grant.programArea && (
          <p className="text-xs text-gray-500 italic">{grant.programArea}</p>
        )}

        {/* Deadlines */}
        <div className="flex flex-wrap gap-1.5">
          {grant.requiresLOI && (
            <DeadlineTag label="LOI" date={grant.loiDeadline} />
          )}
          <DeadlineTag label="Deadline" date={grant.applicationDeadline} />
          {grant.status === "AWARDED" && (
            <DeadlineTag label="Report Due" date={grant.reportingDeadline} />
          )}
        </div>

        {/* Assignee */}
        <div className="flex items-center justify-between gap-2 text-xs">
          {grant.assignee ? (
            <p className="text-gray-400">
              Assigned to {grant.assignee.firstName} {grant.assignee.lastName}
            </p>
          ) : (
            <span className="inline-flex rounded-full px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 font-medium">
              Unassigned
            </span>
          )}
          {requested > 0 && (
            <span className="text-[11px] text-gray-400">Req. {fmt$(requested)}</span>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
        <Link
          href={`/grants/${grant.id}`}
          className="text-xs text-green-700 hover:underline font-medium"
        >
          View Details →
        </Link>
        {onEdit && (
          <button
            onClick={() => onEdit(grant)}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
