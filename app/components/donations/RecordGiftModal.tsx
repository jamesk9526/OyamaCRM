/**
 * RecordGiftModal keeps donation entry inside the Donations ledger while reusing
 * the canonical DonationForm create workflow.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import DonationForm from "@/app/components/donations/DonationForm";
import { apiFetch } from "@/app/lib/auth-client";

interface Constituent { id: string; firstName: string; lastName: string; email?: string }
interface Campaign { id: string; name: string }
interface Designation { id: string; name: string }

interface SelectData {
  constituents: Constituent[];
  campaigns: Campaign[];
  designations: Designation[];
}

interface RecordGiftModalProps {
  source?: string;
  campaignId?: string;
  campaignName?: string;
  grantTitle?: string;
  funderName?: string;
  suggestedAmount?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function buildGrantNotes(grantTitle?: string, funderName?: string): string {
  return [
    grantTitle ? `Grant opportunity: ${grantTitle}` : "",
    funderName ? `Funder: ${funderName}` : "",
    "Recorded from Grants workspace. Financial ledger source-of-truth remains Donations.",
  ].filter(Boolean).join("\n");
}

export default function RecordGiftModal({
  source = "",
  campaignId = "",
  campaignName = "",
  grantTitle = "",
  funderName = "",
  suggestedAmount = "",
  onClose,
  onSaved,
}: RecordGiftModalProps) {
  const [selectData, setSelectData] = useState<SelectData>({
    constituents: [],
    campaigns: [],
    designations: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [constData, campData, desigData] = await Promise.all([
          apiFetch<Constituent[] | { items?: Constituent[] }>("/api/constituents?limit=40"),
          apiFetch<Campaign[] | { items?: Campaign[] }>("/api/campaigns?limit=100"),
          apiFetch<Designation[] | { items?: Designation[] }>("/api/designations?limit=100"),
        ]);
        setSelectData({
          constituents: Array.isArray(constData) ? constData : (constData.items ?? []),
          campaigns: Array.isArray(campData) ? campData : (campData.items ?? []),
          designations: Array.isArray(desigData) ? desigData : (desigData.items ?? []),
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load donation form options.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const defaultDonationValues = useMemo(() => {
    const amount = suggestedAmount && !Number.isNaN(Number(suggestedAmount)) ? String(Number(suggestedAmount)) : "";
    return {
      ...(campaignId ? { campaignId } : {}),
      ...(source === "grant-award"
        ? {
            amount,
            notes: buildGrantNotes(grantTitle, funderName),
          }
        : {}),
    };
  }, [campaignId, funderName, grantTitle, source, suggestedAmount]);

  const statusLabel = source === "grant-award"
    ? "Grant Handoff"
    : source === "campaign" && campaignId
      ? "Campaign Entry"
      : "New Entry";
  const helperText = source === "grant-award"
    ? "Recording awarded grant revenue in the Donations ledger"
    : source === "campaign" && campaignId
      ? `Recording a donation for ${campaignName || "the selected campaign"}`
      : "Enter donation details and stewardship data";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-2 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Record gift">
      <button type="button" className="absolute inset-0" aria-label="Close record gift" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Donations / Record Gift</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Record Gift</h2>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{helperText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {source === "grant-award" ? (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Recording a received grant in Donations. This does not convert the grant workspace record into revenue automatically.
            </div>
          ) : null}

          {source === "campaign" && campaignId ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              This donation will be linked to campaign <span className="font-semibold">{campaignName || campaignId}</span> by default.
            </div>
          ) : null}

          {loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          ) : loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Loading form...</div>
          ) : (
            <DonationForm
              mode="create"
              defaultValues={defaultDonationValues}
              constituents={selectData.constituents}
              campaigns={selectData.campaigns}
              designations={selectData.designations}
              onCancel={onClose}
              onSaved={async () => {
                await onSaved();
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
