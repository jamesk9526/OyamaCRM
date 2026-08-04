/**
 * RecordGiftModal keeps donation entry inside the Donations ledger while reusing
 * the canonical DonationForm create workflow.
 */
// NOTE: Keep this modal custom; it wraps canonical DonationForm behavior and source-aware handoff states.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleSaved = useCallback(() => {
    // A saved donation must never be held hostage by a follow-up ledger refresh.
    // Close first, then refresh the background list without making the successful
    // create flow appear to have failed.
    onClose();
    void Promise.resolve().then(onSaved).catch(() => undefined);
  }, [onClose, onSaved]);

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
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#201f1e]/45 p-2 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close record gift" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-[#edebe9] bg-[#faf9f8] shadow-[0_12px_28px_rgba(0,0,0,0.24)]" role="dialog" aria-modal="true" aria-labelledby="record-gift-title">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#edebe9] bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#605e5c]">Donations / Record Gift</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 id="record-gift-title" className="text-xl font-semibold text-[#323130]">Record Gift</h2>
              <span className="rounded-sm border border-[#c7e0f4] bg-[#eff6fc] px-2 py-0.5 text-[11px] font-semibold text-[#005a9e]">
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#605e5c]">{helperText}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[#605e5c] hover:bg-[#f3f2f1] hover:text-[#323130] focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-1"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {source === "grant-award" ? (
            <div className="mb-4 border-l-4 border-[#0078d4] bg-[#eff6fc] px-4 py-3 text-sm text-[#004578]">
              Recording a received grant in Donations. This does not convert the grant workspace record into revenue automatically.
            </div>
          ) : null}

          {source === "campaign" && campaignId ? (
            <div className="mb-4 border-l-4 border-[#107c10] bg-[#f1f8ef] px-4 py-3 text-sm text-[#107c10]">
              This donation will be linked to campaign <span className="font-semibold">{campaignName || campaignId}</span> by default.
            </div>
          ) : null}

          {loadError ? (
            <div className="border border-[#a4262c] bg-[#fdf3f4] px-4 py-3 text-sm text-[#a4262c]">{loadError}</div>
          ) : loading ? (
            <div className="py-16 text-center text-sm text-[#605e5c]">Loading form...</div>
          ) : (
            <DonationForm
              mode="create"
              defaultValues={defaultDonationValues}
              constituents={selectData.constituents}
              campaigns={selectData.campaigns}
              designations={selectData.designations}
              onCancel={onClose}
              onSaved={handleSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
}
