"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ConstituentRow,
  formatCurrency,
  formatDate,
  statusColor,
  statusLabel,
  typeLabel,
  engagementColor,
} from "@/app/components/constituents/constituent-utils";
import EmptyStateCard from "@/app/components/ui/EmptyStateCard";
import ActionButton from "@/app/components/ui/ActionButton";
import StewardContextButton from "@/app/components/ai/StewardContextButton";

interface Props {
  constituents: ConstituentRow[];
  loading?: boolean;
  onDelete?: (id: string) => void;
}

const COLUMNS = [
  { key: "name", label: "Name", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "ytd", label: "YTD Giving", sortable: true },
  { key: "lifetime", label: "Lifetime", sortable: true },
  { key: "lastGift", label: "Last Gift", sortable: true },
  { key: "engagement", label: "Engagement", sortable: true },
  { key: "tags", label: "Tags", sortable: false },
  { key: "actions", label: "", sortable: false },
];

type SortKey = "name" | "type" | "status" | "ytd" | "lifetime" | "lastGift" | "engagement";

export default function ConstituentTable({ constituents, loading, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key as SortKey);
      setSortDir("asc");
    }
  }

  const sorted = [...constituents].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";
    switch (sortKey) {
      case "name":       aVal = `${a.lastName} ${a.firstName}`; bVal = `${b.lastName} ${b.firstName}`; break;
      case "type":       aVal = a.type; bVal = b.type; break;
      case "status":     aVal = a.donorStatus; bVal = b.donorStatus; break;
      case "ytd":        aVal = parseFloat(a.totalYtdGiving || "0"); bVal = parseFloat(b.totalYtdGiving || "0"); break;
      case "lifetime":   aVal = parseFloat(a.totalLifetimeGiving || "0"); bVal = parseFloat(b.totalLifetimeGiving || "0"); break;
      case "lastGift":   aVal = a.lastGiftDate ?? ""; bVal = b.lastGiftDate ?? ""; break;
      case "engagement": aVal = a.engagementScore; bVal = b.engagementScore; break;
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-8 text-center text-gray-400 text-sm">Loading constituents...</div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <EmptyStateCard
          className="border-0 shadow-none"
          title="No constituents in this view"
          description="Add a constituent record, import donors from a file, or ask Steward to suggest the right data setup for your next outreach cycle."
          icon={(
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 20a7 7 0 0 1 14 0" />
            </svg>
          )}
          actions={(
            <>
              <ActionButton label="Add Constituent" variant="primary" href="/constituents/new" />
              <ActionButton label="Import Donors" variant="secondary" href="/data-tools/import" />
              <StewardContextButton
                label="Ask Steward"
                prompt="Our constituents list is empty for this view. Suggest what donor data we should import first and how to segment it for campaigns."
                moduleKey="donor"
                mode="ask"
                variant="mini"
              />
            </>
          )}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="md:hidden divide-y divide-gray-100">
        {sorted.map((c) => (
          <article key={c.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/constituents/${c.id}`} className="font-medium text-gray-900 hover:text-green-600 transition-colors">
                  {c.firstName} {c.lastName}
                </Link>
                {c.email && <p className="text-xs text-gray-500 mt-0.5 truncate">{c.email}</p>}
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.donorStatus)}`}>
                {statusLabel(c.donorStatus)}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-gray-50 px-2 py-1.5">
                <p className="text-gray-500">Type</p>
                <p className="font-medium text-gray-800">{typeLabel(c.type)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1.5">
                <p className="text-gray-500">YTD</p>
                <p className="font-medium text-gray-900">{formatCurrency(c.totalYtdGiving)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1.5">
                <p className="text-gray-500">Lifetime</p>
                <p className="font-medium text-gray-800">{formatCurrency(c.totalLifetimeGiving)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1.5">
                <p className="text-gray-500">Last Gift</p>
                <p className="font-medium text-gray-800">{c.lastGiftAmount ? formatCurrency(c.lastGiftAmount) : "No gifts"}</p>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${c.engagementScore}%` }} />
              </div>
              <span className={`text-xs font-medium ${engagementColor(c.engagementScore)}`}>Engagement {c.engagementScore}</span>
            </div>

            {c.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tags.slice(0, 3).map((t) => (
                  <span
                    key={t.tagId}
                    className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium text-white"
                    style={{ backgroundColor: t.tag.color }}
                  >
                    {t.tag.name}
                  </span>
                ))}
                {c.tags.length > 3 && <span className="text-[11px] text-gray-400">+{c.tags.length - 3}</span>}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Link
                href={`/constituents/${c.id}/edit`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Edit
              </Link>
              {onDelete && (
                <button
                  onClick={() => onDelete(c.id)}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
      <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="border-b border-gray-300 bg-gray-100">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`sticky top-0 z-10 border-b border-r border-gray-200 bg-gray-100 px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap ${
                  col.sortable ? "cursor-pointer hover:text-gray-900 select-none" : ""
                }`}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-green-600">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-gray-100 odd:bg-white even:bg-gray-50/60 hover:bg-emerald-50/40 transition-colors">
              {/* Name */}
              <td className="sticky left-0 z-[1] border-r border-gray-100 bg-inherit px-3 py-2 align-top">
                <Link href={`/constituents/${c.id}`} className="font-medium text-gray-900 hover:text-green-600 transition-colors">
                  {c.firstName} {c.lastName}
                </Link>
                {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
              </td>
              {/* Type */}
              <td className="border-r border-gray-100 px-3 py-2 text-gray-600 whitespace-nowrap align-top">
                {typeLabel(c.type)}
              </td>
              {/* Status */}
              <td className="border-r border-gray-100 px-3 py-2 align-top">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.donorStatus)}`}>
                  {statusLabel(c.donorStatus)}
                </span>
              </td>
              {/* YTD */}
              <td className="border-r border-gray-100 px-3 py-2 text-right font-medium tabular-nums text-gray-900 whitespace-nowrap align-top">
                {formatCurrency(c.totalYtdGiving)}
              </td>
              {/* Lifetime */}
              <td className="border-r border-gray-100 px-3 py-2 text-right tabular-nums text-gray-600 whitespace-nowrap align-top">
                {formatCurrency(c.totalLifetimeGiving)}
                {c.giftCount > 0 && (
                  <span className="text-xs text-gray-400 ml-1">({c.giftCount} gifts)</span>
                )}
              </td>
              {/* Last Gift */}
              <td className="border-r border-gray-100 px-3 py-2 text-right tabular-nums text-gray-600 whitespace-nowrap align-top">
                {c.lastGiftAmount ? (
                  <>
                    <span className="font-medium text-gray-800">{formatCurrency(c.lastGiftAmount)}</span>
                    <p className="text-xs text-gray-400">{formatDate(c.lastGiftDate)}</p>
                  </>
                ) : (
                  <span className="text-gray-400">No gifts</span>
                )}
              </td>
              {/* Engagement */}
              <td className="border-r border-gray-100 px-3 py-2 align-top">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${c.engagementScore}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${engagementColor(c.engagementScore)}`}>
                    {c.engagementScore}
                  </span>
                </div>
              </td>
              {/* Tags */}
              <td className="border-r border-gray-100 px-3 py-2 align-top">
                <div className="flex flex-wrap gap-1 justify-end">
                  {c.tags.slice(0, 3).map((t) => (
                    <span
                      key={t.tagId}
                      className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: t.tag.color }}
                    >
                      {t.tag.name}
                    </span>
                  ))}
                  {c.tags.length > 3 && (
                    <span className="text-xs text-gray-400">+{c.tags.length - 3}</span>
                  )}
                </div>
              </td>
              {/* Actions */}
              <td className="px-3 py-2 align-top">
                <div className="flex items-center gap-1 justify-end">
                  <Link
                    href={`/constituents/${c.id}/edit`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Link>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(c.id)}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete constituent"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
