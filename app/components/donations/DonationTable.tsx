"use client";

import { useState } from "react";
import Link from "next/link";
import { DonationRow, formatCurrency, formatDate, methodLabel, statusColor } from "./donation-utils";

type SortKey = "date" | "amount" | "constituent" | "status";

interface Props {
  donations: DonationRow[];
  onDelete?: (id: string) => void;
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggle: (key: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-green-600"
      onClick={() => onToggle(col)}
    >
      {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

export default function DonationTable({ donations, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...donations].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    else if (sortKey === "amount") cmp = parseFloat(a.amount) - parseFloat(b.amount);
    else if (sortKey === "constituent") cmp = `${a.constituent.lastName}${a.constituent.firstName}`.localeCompare(`${b.constituent.lastName}${b.constituent.firstName}`);
    else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggle(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  if (!sorted.length) {
    return <div className="py-16 text-center text-gray-400 text-sm">No donations found.</div>;
  }

  return (
    <div>
      <div className="md:hidden space-y-2">
        {sorted.map((d) => (
          <article key={d.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/constituents/${d.constituent.id}`} className="font-medium text-gray-800 hover:text-green-600">
                  {d.constituent.firstName} {d.constituent.lastName}
                </Link>
                {d.constituent.email && <p className="text-xs text-gray-500 truncate">{d.constituent.email}</p>}
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(d.status)}`}>
                {d.status.charAt(0) + d.status.slice(1).toLowerCase()}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">{formatDate(d.date)}</span>
              <span className="font-semibold text-gray-900">{formatCurrency(d.amount)}</span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-gray-50 px-2 py-1.5">
                <p className="text-gray-500">Method</p>
                <p className="font-medium text-gray-800">{methodLabel(d.paymentMethod)}</p>
              </div>
              <div className="rounded-md bg-gray-50 px-2 py-1.5">
                <p className="text-gray-500">Recurring</p>
                <p className="font-medium text-gray-800">{d.isRecurring ? "Yes" : "No"}</p>
              </div>
            </div>

            {(d.designation?.name || d.campaign?.name) && (
              <div className="mt-2 text-xs text-gray-600">
                {d.designation?.name ? <p>Fund: <span className="font-medium text-gray-800">{d.designation.name}</span></p> : null}
                {d.campaign?.name ? <p>Campaign: <span className="font-medium text-gray-800">{d.campaign.name}</span></p> : null}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Link
                href={`/donations/${d.id}/edit`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Edit
              </Link>
              {onDelete && (
                <button
                  onClick={() => onDelete(d.id)}
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
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <SortHeader label="Date" col="date" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <SortHeader label="Donor" col="constituent" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <SortHeader label="Amount" col="amount" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fund / Campaign</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
            <SortHeader label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map(d => (
            <tr key={d.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(d.date)}</td>
              <td className="px-4 py-3">
                <Link href={`/constituents/${d.constituent.id}`} className="font-medium text-gray-800 hover:text-green-600">
                  {d.constituent.firstName} {d.constituent.lastName}
                </Link>
                {d.constituent.email && (
                  <div className="text-xs text-gray-400">{d.constituent.email}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="font-semibold text-gray-900">{formatCurrency(d.amount)}</span>
                {d.isRecurring && (
                  <span className="ml-1.5 inline-block text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Recurring</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {d.designation?.name && <div className="font-medium">{d.designation.name}</div>}
                {d.campaign?.name && <div className="text-xs text-gray-400">{d.campaign.name}</div>}
                {!d.designation && !d.campaign && <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-gray-600">{methodLabel(d.paymentMethod)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(d.status)}`}>
                  {d.status.charAt(0) + d.status.slice(1).toLowerCase()}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Link
                    href={`/donations/${d.id}/edit`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Link>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(d.id)}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete donation"
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
