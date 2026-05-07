"use client";

import { useState } from "react";
import Link from "next/link";
import { DonationRow, formatCurrency, formatDate, methodLabel, statusColor } from "./donation-utils";

type SortKey = "date" | "amount" | "constituent" | "status";

export default function DonationTable({ donations }: { donations: DonationRow[] }) {
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

  function Th({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-green-600"
        onClick={() => toggle(col)}
      >
        {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  if (!sorted.length) {
    return <div className="py-16 text-center text-gray-400 text-sm">No donations found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <Th label="Date" col="date" />
            <Th label="Donor" col="constituent" />
            <Th label="Amount" col="amount" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fund / Campaign</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
            <Th label="Status" col="status" />
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
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
                <Link
                  href={`/donations/${d.id}/edit`}
                  className="text-xs font-medium text-green-700 hover:text-green-800 hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
