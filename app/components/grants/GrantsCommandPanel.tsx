/** GrantsCommandPanel highlights urgent grant-writing work and case-file health signals. */
"use client";

import Link from "next/link";
import type { Grant } from "./types";
import { STATUS_META, fmt$ } from "./types";

interface GrantsCommandPanelProps {
  grants: Grant[];
  onCreateGrant: () => void;
}

interface HealthCardProps {
  label: string;
  value: string;
  helper: string;
  tone: "danger" | "warn" | "good" | "neutral";
}

/** HealthCard renders one compact signal tile for the grants command panel. */
function HealthCard({ label, value, helper, tone }: HealthCardProps) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "good"
      ? "border-green-200 bg-green-50 text-green-800"
      : "border-gray-200 bg-gray-50 text-gray-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-90">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-90">{helper}</p>
    </div>
  );
}

/** Returns the most actionable deadline for a grant card row. */
function getPrimaryDeadline(grant: Grant): string | null {
  return grant.applicationDeadline ?? grant.loiDeadline ?? null;
}

/** Returns days until deadline, or null when no usable deadline is set. */
function daysUntilDeadline(grant: Grant): number | null {
  const deadline = getPrimaryDeadline(grant);
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** GrantsCommandPanel summarizes urgent priorities and offers quick access to risky grants. */
export default function GrantsCommandPanel({ grants, onCreateGrant }: GrantsCommandPanelProps) {
  const activeGrants = grants.filter((grant) => STATUS_META[grant.status].stage === "active");
  const overdue = activeGrants.filter((grant) => {
    const days = daysUntilDeadline(grant);
    return days !== null && days < 0;
  });

  const dueSoon = activeGrants.filter((grant) => {
    const days = daysUntilDeadline(grant);
    return days !== null && days >= 0 && days <= 14;
  });

  const unassigned = activeGrants.filter((grant) => !grant.assignee);
  const highValueInMotion = activeGrants.filter((grant) => Number(grant.amountRequested ?? 0) >= 50000);

  const urgentQueue = [...activeGrants]
    .filter((grant) => daysUntilDeadline(grant) !== null)
    .sort((a, b) => {
      const daysA = daysUntilDeadline(a) ?? Number.POSITIVE_INFINITY;
      const daysB = daysUntilDeadline(b) ?? Number.POSITIVE_INFINITY;
      return daysA - daysB;
    })
    .slice(0, 5);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Command Panel</p>
          <h2 className="text-lg font-semibold text-gray-900 mt-1">Grant Workspace Snapshot</h2>
          <p className="text-sm text-gray-500 mt-1">
            Focus the team on deadline risk, ownership gaps, and high-impact applications.
          </p>
        </div>
        <button
          onClick={onCreateGrant}
          className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
        >
          + Create Grant
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HealthCard
          label="Overdue"
          value={String(overdue.length)}
          helper="Past LOI, application, or review date"
          tone={overdue.length > 0 ? "danger" : "neutral"}
        />
        <HealthCard
          label="Due in 14 Days"
          value={String(dueSoon.length)}
          helper="Needs immediate writing and review"
          tone={dueSoon.length > 0 ? "warn" : "neutral"}
        />
        <HealthCard
          label="Unassigned"
          value={String(unassigned.length)}
          helper="No owner currently set"
          tone={unassigned.length > 0 ? "warn" : "good"}
        />
        <HealthCard
          label="High-Request Active"
          value={fmt$(highValueInMotion.reduce((sum, grant) => sum + Number(grant.amountRequested ?? 0), 0))}
          helper="Requested amount >= $50k"
          tone={highValueInMotion.length > 0 ? "good" : "neutral"}
        />
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Urgent Queue</p>
          <p className="text-xs text-gray-500">Top 5 by deadline</p>
        </div>
        {urgentQueue.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 text-center">
            No deadline-driven active grants are currently in queue.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {urgentQueue.map((grant) => {
              const days = daysUntilDeadline(grant);
              const danger = days !== null && days <= 3;
              return (
                <li key={grant.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{grant.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {grant.funder?.name ?? "Unknown funder"}
                      {grant.assignee ? ` • ${grant.assignee.firstName} ${grant.assignee.lastName}` : " • Unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold ${danger ? "text-red-700" : "text-gray-600"}`}>
                      {days === null ? "No deadline" : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                    <Link href={`/grants/${grant.id}`} className="text-xs font-medium text-green-700 hover:underline">
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
