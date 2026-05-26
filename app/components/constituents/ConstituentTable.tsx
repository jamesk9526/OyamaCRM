"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ConstituentRow,
  formatCurrency,
  formatDate,
  statusLabel,
  typeLabel,
  engagementColor,
} from "@/app/components/constituents/constituent-utils";
import EmptyStateCard from "@/app/components/ui/EmptyStateCard";
import ActionButton from "@/app/components/ui/ActionButton";
import StewardContextButton from "@/app/components/ai/StewardContextButton";
import CRMStatusBadge from "@/app/components/ui/crm/CRMStatusBadge";

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

type ConstituentTag = ConstituentRow["tags"][number];

function ConstituentRowMoreMenu({ constituent, onDelete }: { constituent: ConstituentRow; onDelete?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onDocumentClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setOpen(false);
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open constituent actions"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5h.01M12 12h.01M12 19h.01" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-100 bg-white p-1.5 text-xs shadow-xl shadow-slate-200/70">
          <Link href={`/constituents/${constituent.id}`} onClick={() => setOpen(false)} className="block rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800">
            View Details
          </Link>
          <Link href={`/constituents/${constituent.id}/edit`} onClick={() => setOpen(false)} className="block rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800">
            Edit
          </Link>
          <Link href={`/letters-printables/generate?constituentId=${constituent.id}`} onClick={() => setOpen(false)} className="block rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800">
            Draft Letter
          </Link>
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete(constituent.id);
              }}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left font-semibold text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="p-8 text-center text-sm font-medium text-slate-400">Loading constituents...</div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
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
    <div className="overflow-hidden bg-white">
      <div className="divide-y divide-slate-100 md:hidden">
        {sorted.map((c) => (
          <article key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/constituents/${c.id}`} className="font-medium text-gray-900 hover:text-green-600 transition-colors">
                  {c.firstName} {c.lastName}
                </Link>
                {c.email && <p className="mt-0.5 truncate text-xs text-slate-500">{c.email}</p>}
              </div>
              <ConstituentStatusBadge status={c.donorStatus} />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <p className="text-slate-500">Type</p>
                <p className="font-semibold text-slate-800">{typeLabel(c.type)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <p className="text-slate-500">YTD</p>
                <p className="font-semibold text-slate-950">{formatCurrency(c.totalYtdGiving)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <p className="text-slate-500">Lifetime</p>
                <p className="font-semibold text-slate-800">{formatCurrency(c.totalLifetimeGiving)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <p className="text-slate-500">Last Gift</p>
                <p className="font-semibold text-slate-800">{c.lastGiftAmount ? formatCurrency(c.lastGiftAmount) : "No gifts"}</p>
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
                <ConstituentTags tags={c.tags} />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <Link
                href={`/constituents/${c.id}/edit`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Edit
              </Link>
              <ConstituentRowMoreMenu constituent={c} onDelete={onDelete} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
      <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`sticky top-0 z-10 whitespace-nowrap border-b border-slate-100 bg-slate-50/95 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-slate-500 ${
                  col.sortable ? "cursor-pointer select-none hover:text-emerald-700" : ""
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
            <tr key={c.id} className="border-b border-slate-100 bg-white transition-colors hover:bg-emerald-50/35">
              {/* Name */}
              <td className="sticky left-0 z-[1] bg-inherit px-4 py-4 align-top">
                <Link href={`/constituents/${c.id}`} className="font-semibold text-slate-900 transition-colors hover:text-emerald-700">
                  {c.firstName} {c.lastName}
                </Link>
                {c.email && <p className="mt-0.5 text-xs text-slate-400">{c.email}</p>}
              </td>
              {/* Type */}
              <td className="px-4 py-4 text-gray-600 whitespace-nowrap align-top">
                {typeLabel(c.type)}
              </td>
              {/* Status */}
              <td className="px-4 py-4 align-top">
                <ConstituentStatusBadge status={c.donorStatus} />
              </td>
              {/* YTD */}
              <td className="px-4 py-4 text-right font-medium tabular-nums text-gray-900 whitespace-nowrap align-top">
                {formatCurrency(c.totalYtdGiving)}
              </td>
              {/* Lifetime */}
              <td className="px-4 py-4 text-right tabular-nums text-gray-600 whitespace-nowrap align-top">
                {formatCurrency(c.totalLifetimeGiving)}
                {c.giftCount > 0 && (
                  <span className="text-xs text-gray-400 ml-1">({c.giftCount} gifts)</span>
                )}
              </td>
              {/* Last Gift */}
              <td className="px-4 py-4 text-right tabular-nums text-gray-600 whitespace-nowrap align-top">
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
              <td className="px-4 py-4 align-top">
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
              <td className="px-4 py-4 align-top">
                <ConstituentTags tags={c.tags} align="end" />
              </td>
              {/* Actions */}
              <td className="px-4 py-4 align-top">
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
                  <ConstituentRowMoreMenu constituent={c} onDelete={onDelete} />
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

function ConstituentStatusBadge({ status }: { status: string }) {
  const tone = status === "MAJOR_DONOR" || status === "ACTIVE"
    ? "green"
    : status === "LAPSED"
      ? "orange"
      : status === "NEW"
        ? "purple"
        : "gray";
  return <CRMStatusBadge tone={tone}>{statusLabel(status)}</CRMStatusBadge>;
}

function ConstituentTags({ tags, align = "start" }: { tags: ConstituentTag[]; align?: "start" | "end" }) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, 2);
  const hiddenCount = tags.length - visible.length;

  return (
    <div className={`flex flex-wrap gap-1 ${align === "end" ? "justify-end" : ""}`}>
      {visible.map((item) => (
        <CRMStatusBadge key={item.tagId} tone={getTagTone(item.tag.name)}>
          {item.tag.name}
        </CRMStatusBadge>
      ))}
      {hiddenCount > 0 ? <CRMStatusBadge tone="gray">+{hiddenCount} more</CRMStatusBadge> : null}
    </div>
  );
}

function getTagTone(name: string): "green" | "yellow" | "orange" | "red" | "purple" | "gray" | "blue" {
  const normalized = name.toLowerCase();
  if (normalized.includes("major")) return "green";
  if (normalized.includes("opportunity")) return "blue";
  if (normalized.includes("lapsed") || normalized.includes("risk")) return "orange";
  if (normalized.includes("prospect")) return "purple";
  if (normalized.includes("demo")) return "gray";
  return "gray";
}
