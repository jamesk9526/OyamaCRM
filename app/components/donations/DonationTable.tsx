"use client";

import { useState } from "react";
import DonorRecordActions from "@/app/components/donor-workspace/DonorRecordActions";
import Link from "next/link";
import { DonationRow, formatCurrency, formatDate, formatDonationDate, methodLabel, statusColor } from "./donation-utils";
import { getConstituentDisplayName, getConstituentSortName } from "@/app/components/constituents/constituent-utils";

type SortKey = "date" | "amount" | "constituent" | "status";

interface Props {
  donations: DonationRow[];
  onDelete?: (id: string) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onMarkThanked?: (id: string) => void;
  onCreateEmailDraft?: (id: string) => void;
  onEmailFromTemplate?: (id: string) => void;
  onLetterFromTemplate?: (id: string) => void;
  onCreateCallTask?: (id: string) => void;
  onStartPath?: (id: string) => void;
  onCompleteStewardshipLoop?: (id: string) => void;
  acknowledgingDonationId?: string | null;
  actionBusyDonationId?: string | null;
}

function RowQuickActionsMenu({
  donation,
  onDelete,
  onMarkThanked,
  onCreateEmailDraft,
  onEmailFromTemplate,
  onLetterFromTemplate,
  onCreateCallTask,
  onStartPath,
  onCompleteStewardshipLoop,
  acknowledgingDonationId,
  actionBusyDonationId,
}: {
  donation: DonationRow;
  onDelete?: (id: string) => void;
  onMarkThanked?: (id: string) => void;
  onCreateEmailDraft?: (id: string) => void;
  onEmailFromTemplate?: (id: string) => void;
  onLetterFromTemplate?: (id: string) => void;
  onCreateCallTask?: (id: string) => void;
  onStartPath?: (id: string) => void;
  onCompleteStewardshipLoop?: (id: string) => void;
  acknowledgingDonationId?: string | null;
  actionBusyDonationId?: string | null;
}) {
  const actionBusy = actionBusyDonationId === donation.id;
  const acknowledging = acknowledgingDonationId === donation.id;
  return <DonorRecordActions label={`Actions for gift from ${getConstituentDisplayName(donation.constituent)}`}>
    <p>Gift record</p>
    <Link href={`/donations/${donation.id}`}>View gift</Link>
    <Link href={`/donations/${donation.id}/edit`}>Edit gift</Link>
    <Link href={`/constituents/${donation.constituent.id}`}>View constituent</Link>
    {onMarkThanked && donation.status === "COMPLETED" && !donation.acknowledgmentSentAt && <button type="button" disabled={acknowledging || actionBusy} onClick={() => onMarkThanked(donation.id)}>{acknowledging ? "Saving…" : "Mark thanked"}</button>}
    <p>Prepare outreach</p>
    {onCreateEmailDraft && <button type="button" disabled={actionBusy} onClick={() => onCreateEmailDraft(donation.id)}>Create email draft</button>}
    {onEmailFromTemplate && <button type="button" disabled={actionBusy} onClick={() => onEmailFromTemplate(donation.id)}>Email from template</button>}
    <Link href={`/oyama-letters/generate?constituentId=${donation.constituent.id}&donationId=${donation.id}`}>Open letter workspace</Link>
    {onLetterFromTemplate && <button type="button" disabled={actionBusy} onClick={() => onLetterFromTemplate(donation.id)}>Letter from template</button>}
    {onCreateCallTask && <button type="button" disabled={actionBusy} onClick={() => onCreateCallTask(donation.id)}>Set up follow-up task</button>}
    {onStartPath && <button type="button" disabled={actionBusy} onClick={() => onStartPath(donation.id)}>Start stewardship path</button>}
    {onCompleteStewardshipLoop && <button type="button" disabled={actionBusy} onClick={() => onCompleteStewardshipLoop(donation.id)}>Complete stewardship loop</button>}
    {onDelete && <button type="button" className="text-red-700" onClick={() => onDelete(donation.id)}>Delete gift</button>}
  </DonorRecordActions>;
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
      className="cursor-pointer select-none px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500 hover:text-emerald-700"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onToggle(col)} className="min-h-9 text-left">{label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</button>
    </th>
  );
}

export default function DonationTable({
  donations,
  onDelete,
  selectedIds = [],
  onSelectionChange,
  onMarkThanked,
  onCreateEmailDraft,
  onEmailFromTemplate,
  onLetterFromTemplate,
  onCreateCallTask,
  onStartPath,
  onCompleteStewardshipLoop,
  acknowledgingDonationId,
  actionBusyDonationId,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...donations].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    else if (sortKey === "amount") cmp = parseFloat(a.amount) - parseFloat(b.amount);
    else if (sortKey === "constituent") cmp = getConstituentSortName(a.constituent).localeCompare(getConstituentSortName(b.constituent));
    else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const selectable = Boolean(onSelectionChange);
  const selectedSet = new Set(selectedIds);
  const allVisibleSelected = sorted.length > 0 && sorted.every((row) => selectedSet.has(row.id));

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    onSelectionChange(selectedSet.has(id) ? selectedIds.filter((rowId) => rowId !== id) : [...selectedIds, id]);
  }

  function toggleAllVisible() {
    if (!onSelectionChange) return;
    if (allVisibleSelected) {
      onSelectionChange(selectedIds.filter((id) => !sorted.some((row) => row.id === id)));
      return;
    }
    onSelectionChange(Array.from(new Set([...selectedIds, ...sorted.map((row) => row.id)])));
  }

  function toggle(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  if (!sorted.length) {
    return <div className="py-16 text-center text-sm font-medium text-slate-400">No donations found.</div>;
  }

  return (
    <div>
      <div className="space-y-3 md:hidden">
        {sorted.map((d) => (
          <article key={d.id} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/constituents/${d.constituent.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                  {getConstituentDisplayName(d.constituent)}
                </Link>
                {d.constituent.email && <p className="truncate text-xs text-slate-500">{d.constituent.email}</p>}
                <p className={`mt-1 text-[11px] ${d.acknowledgmentSentAt ? "text-green-700" : "text-amber-700"}`}>
                  {d.acknowledgmentSentAt
                    ? `Thanked ${formatDate(d.acknowledgmentSentAt)}`
                    : d.status === "COMPLETED" ? "Needs acknowledgment" : "Acknowledgment after completion"}
                </p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(d.status)}`}>
                {d.status.charAt(0) + d.status.slice(1).toLowerCase()}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">{formatDonationDate(d.date)}</span>
              <span className="font-bold text-slate-950">{formatCurrency(d.amount)}</span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 px-2.5 py-1.5">
                <p className="text-slate-500">Method</p>
                <p className="font-semibold text-slate-800">{methodLabel(d.paymentMethod)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-1.5">
                <p className="text-slate-500">Recurring</p>
                <p className="font-semibold text-slate-800">{d.isRecurring ? "Yes" : "No"}</p>
              </div>
            </div>

            {(d.designation?.name || d.campaign?.name) && (
              <div className="mt-2 text-xs text-gray-600">
                {d.designation?.name ? <p>Fund: <span className="font-medium text-gray-800">{d.designation.name}</span></p> : null}
                {d.campaign?.name ? <p>Campaign: <span className="font-medium text-gray-800">{d.campaign.name}</span></p> : null}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <Link href={`/donations/${d.id}`} className="donor-button">View gift</Link>

              <RowQuickActionsMenu
                donation={d}
                    onDelete={onDelete}
                onMarkThanked={onMarkThanked}
                onCreateEmailDraft={onCreateEmailDraft}
                onEmailFromTemplate={onEmailFromTemplate}
                onLetterFromTemplate={onLetterFromTemplate}
                onCreateCallTask={onCreateCallTask}
                onStartPath={onStartPath}
                onCompleteStewardshipLoop={onCompleteStewardshipLoop}
                acknowledgingDonationId={acknowledgingDonationId}
                actionBusyDonationId={actionBusyDonationId}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto overflow-y-visible md:block">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/80">
          <tr>
            {selectable ? (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible gifts"
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
            ) : null}
            <SortHeader label="Date" col="date" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <SortHeader label="Donor" col="constituent" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <SortHeader label="Amount" col="amount" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500">Fund / Campaign</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500">Method</th>
            <SortHeader label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <th className="w-72 px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map(d => (
            <tr key={d.id} className="transition-colors hover:bg-emerald-50/35">
              {selectable ? (
                <td className="px-3 py-2.5 align-top">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(d.id)}
                    onChange={() => toggleRow(d.id)}
                    aria-label={`Select gift from ${getConstituentDisplayName(d.constituent)}`}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </td>
              ) : null}
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDonationDate(d.date)}</td>
              <td className="px-4 py-2.5">
                <Link href={`/constituents/${d.constituent.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                  {getConstituentDisplayName(d.constituent)}
                </Link>
                {d.constituent.email && (
                  <div className="text-xs text-slate-400">{d.constituent.email}</div>
                )}
                <div className="mt-1 text-[11px]">
                  {d.acknowledgmentSentAt ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">
                      Thanked {formatDate(d.acknowledgmentSentAt)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                      {d.status === "COMPLETED" ? "Needs acknowledgment" : "Not completed"}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2.5">
                <Link href={`/donations/${d.id}`} className="font-semibold tabular-nums text-[#0f6cbd] hover:underline">{formatCurrency(d.amount)}</Link>
                {d.isRecurring && (
                  <span className="ml-1.5 inline-block text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Recurring</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-gray-600">
                {d.designation?.name && <div className="font-medium text-slate-700">{d.designation.name}</div>}
                {d.campaign?.name && <div className="text-xs text-gray-400">{d.campaign.name}</div>}
                {!d.designation && !d.campaign && <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-600">{methodLabel(d.paymentMethod)}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(d.status)}`}>
                  {d.status.charAt(0) + d.status.slice(1).toLowerCase()}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center gap-1 justify-end flex-wrap">
                  <RowQuickActionsMenu
                    donation={d}
                    onDelete={onDelete}
                    onMarkThanked={onMarkThanked}
                    onCreateEmailDraft={onCreateEmailDraft}
                    onEmailFromTemplate={onEmailFromTemplate}
                    onLetterFromTemplate={onLetterFromTemplate}
                    onCreateCallTask={onCreateCallTask}
                    onStartPath={onStartPath}
                    onCompleteStewardshipLoop={onCompleteStewardshipLoop}
                    acknowledgingDonationId={acknowledgingDonationId}
                    actionBusyDonationId={actionBusyDonationId}
                  />
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
