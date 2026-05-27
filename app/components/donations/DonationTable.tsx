"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DonationRow, formatCurrency, formatDate, formatDonationDate, methodLabel, statusColor } from "./donation-utils";

type SortKey = "date" | "amount" | "constituent" | "status";

interface Props {
  donations: DonationRow[];
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
}

function RowQuickActionsMenu({
  donation,
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const actionBusy = actionBusyDonationId === donation.id;
  const acknowledging = acknowledgingDonationId === donation.id;

  useEffect(() => {
    if (!open) return;

    function onDocumentClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [open]);

  function runAction(handler?: (id: string) => void) {
    if (!handler || actionBusy) return;
    setOpen(false);
    handler(donation.id);
  }

  function runMarkThanked() {
    if (!onMarkThanked || donation.acknowledgmentSentAt || acknowledging) return;
    setOpen(false);
    onMarkThanked(donation.id);
  }

  const itemClass = "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open donation quick actions"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5h.01M12 12h.01M12 19h.01" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-slate-200/70">
          <button
            type="button"
            onClick={() => runAction(onCompleteStewardshipLoop)}
            disabled={!onCompleteStewardshipLoop || actionBusy}
            className={itemClass}
          >
            <span>{actionBusy ? "Running..." : "Complete Loop"}</span>
          </button>

          <Link
            href={`/oyama-letters/generate?constituentId=${donation.constituent.id}&donationId=${donation.id}`}
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <span>Letter</span>
          </Link>

          <button
            type="button"
            onClick={() => runAction(onCreateEmailDraft)}
            disabled={!onCreateEmailDraft || actionBusy}
            className={itemClass}
          >
            <span>Email Draft</span>
          </button>

          {onEmailFromTemplate && (
            <button
              type="button"
              onClick={() => runAction(onEmailFromTemplate)}
              disabled={actionBusy}
              className={itemClass}
            >
              <span>Email Template</span>
            </button>
          )}

          {onLetterFromTemplate && (
            <button
              type="button"
              onClick={() => runAction(onLetterFromTemplate)}
              disabled={actionBusy}
              className={itemClass}
            >
              <span>Letter Template</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => runAction(onCreateCallTask)}
            disabled={!onCreateCallTask || actionBusy}
            className={itemClass}
          >
            <span>Call Task</span>
          </button>

          <button
            type="button"
            onClick={() => runAction(onStartPath)}
            disabled={!onStartPath || actionBusy}
            className={itemClass}
          >
            <span>Start Path</span>
          </button>

          {onMarkThanked && !donation.acknowledgmentSentAt && (
            <button
              type="button"
              onClick={runMarkThanked}
              disabled={acknowledging}
              className={itemClass}
            >
              <span>{acknowledging ? "Saving..." : "Mark Thanked"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
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
      onClick={() => onToggle(col)}
    >
      {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

export default function DonationTable({
  donations,
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
}: Props) {
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
    return <div className="py-16 text-center text-sm font-medium text-slate-400">No donations found.</div>;
  }

  return (
    <div>
      <div className="space-y-3 md:hidden">
        {sorted.map((d) => (
          <article key={d.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/constituents/${d.constituent.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                  {d.constituent.firstName} {d.constituent.lastName}
                </Link>
                {d.constituent.email && <p className="truncate text-xs text-slate-500">{d.constituent.email}</p>}
                <p className={`mt-1 text-[11px] ${d.acknowledgmentSentAt ? "text-green-700" : "text-amber-700"}`}>
                  {d.acknowledgmentSentAt
                    ? `Thanked ${formatDate(d.acknowledgmentSentAt)}`
                    : "Needs acknowledgment"}
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
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <p className="text-slate-500">Method</p>
                <p className="font-semibold text-slate-800">{methodLabel(d.paymentMethod)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
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
              <div className="flex items-center gap-2">
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

              <RowQuickActionsMenu
                donation={d}
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

      <div className="hidden md:block overflow-x-auto overflow-y-visible">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/80">
          <tr>
            <SortHeader label="Date" col="date" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <SortHeader label="Donor" col="constituent" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <SortHeader label="Amount" col="amount" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500">Fund / Campaign</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500">Method</th>
            <SortHeader label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
            <th className="w-72 px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map(d => (
            <tr key={d.id} className="transition-colors hover:bg-emerald-50/35">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDonationDate(d.date)}</td>
              <td className="px-4 py-3">
                <Link href={`/constituents/${d.constituent.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                  {d.constituent.firstName} {d.constituent.lastName}
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
                      Needs acknowledgment
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="font-bold text-slate-950">{formatCurrency(d.amount)}</span>
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
                <div className="flex items-center gap-1 justify-end flex-wrap">
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
                  <RowQuickActionsMenu
                    donation={d}
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
