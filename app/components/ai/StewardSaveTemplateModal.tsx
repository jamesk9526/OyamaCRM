"use client";

import { useEffect, useMemo, useState } from "react";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import type { MentionedDonor } from "@/app/components/ai/DonorMentionPicker";

export interface StewardTemplateDraft {
  name: string;
  subject: string;
  previewText: string;
  bodyText: string;
}

interface StewardSaveTemplateModalProps {
  open: boolean;
  draft: StewardTemplateDraft;
  donorCandidates: MentionedDonor[];
  saving: boolean;
  error: string | null;
  onChange: (next: StewardTemplateDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}

interface PreviewDonor {
  id: string;
  preferredName: string;
  fullName: string;
  lastGiftAmount: string;
  lastGiftDate: string;
  campaignName: string;
  organizationName: string;
  staffName: string;
  unsubscribeUrl: string;
  managePreferencesUrl: string;
  donationPlatformUrl: string;
}

const RANDOM_DONOR_ID = "__random__";

function resolveTemplateText(text: string, donor: PreviewDonor): string {
  const tokenMap: Record<string, string> = {
    preferredName: donor.preferredName,
    fullName: donor.fullName,
    lastGiftAmount: donor.lastGiftAmount,
    lastGiftDate: donor.lastGiftDate,
    campaignName: donor.campaignName,
    organizationName: donor.organizationName,
    staffName: donor.staffName,
    unsubscribeUrl: donor.unsubscribeUrl,
    managePreferencesUrl: donor.managePreferencesUrl,
    donationPlatformUrl: donor.donationPlatformUrl,
  };

  return String(text || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, tokenName: string) => {
    const key = tokenName.trim();
    return tokenMap[key] ?? `{{${key}}}`;
  });
}

function toPreviewDonor(candidate: MentionedDonor, index: number): PreviewDonor {
  const firstName = (candidate.firstName || "").trim();
  const lastName = (candidate.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || candidate.email || `Donor ${index + 1}`;
  const preferredName = firstName || fullName.split(" ")[0] || "Friend";

  const lifetimeValue = typeof candidate.totalLifetimeGiving === "number" && Number.isFinite(candidate.totalLifetimeGiving)
    ? candidate.totalLifetimeGiving
    : 250 + index * 75;
  const giftDate = candidate.lastGiftDate
    ? new Date(candidate.lastGiftDate)
    : new Date(Date.now() - (index + 2) * 86400000 * 11);

  return {
    id: candidate.id || `donor-${index + 1}`,
    preferredName,
    fullName,
    lastGiftAmount: `$${Math.max(25, Math.round(lifetimeValue / 5)).toLocaleString()}`,
    lastGiftDate: giftDate.toLocaleDateString(),
    campaignName: "Annual Stewardship Fund",
    organizationName: "Oyama Nonprofit",
    staffName: "Steward Team",
    unsubscribeUrl: "https://example.org/unsubscribe",
    managePreferencesUrl: "https://example.org/preferences",
    donationPlatformUrl: "https://example.org/donate",
  };
}

function createFallbackDonors(): PreviewDonor[] {
  return [
    {
      id: "fallback-ava",
      preferredName: "Ava",
      fullName: "Ava Richardson",
      lastGiftAmount: "$250",
      lastGiftDate: "04/12/2026",
      campaignName: "Community Relief Drive",
      organizationName: "Oyama Nonprofit",
      staffName: "Maya Ortiz",
      unsubscribeUrl: "https://example.org/unsubscribe",
      managePreferencesUrl: "https://example.org/preferences",
      donationPlatformUrl: "https://example.org/donate",
    },
    {
      id: "fallback-jordan",
      preferredName: "Jordan",
      fullName: "Jordan Lee",
      lastGiftAmount: "$100",
      lastGiftDate: "03/28/2026",
      campaignName: "After-School Initiative",
      organizationName: "Oyama Nonprofit",
      staffName: "Noah Grant",
      unsubscribeUrl: "https://example.org/unsubscribe",
      managePreferencesUrl: "https://example.org/preferences",
      donationPlatformUrl: "https://example.org/donate",
    },
  ];
}

/**
 * In-workspace save flow for converting a Steward response into a reusable email template campaign.
 */
export default function StewardSaveTemplateModal({
  open,
  draft,
  donorCandidates,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: StewardSaveTemplateModalProps) {
  const donorOptions = useMemo(() => {
    const fromContext = donorCandidates.map((donor, index) => toPreviewDonor(donor, index));
    return fromContext.length > 0 ? fromContext : createFallbackDonors();
  }, [donorCandidates]);

  const [selectedDonorId, setSelectedDonorId] = useState<string>(RANDOM_DONOR_ID);
  const [randomIndex, setRandomIndex] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    setSelectedDonorId(RANDOM_DONOR_ID);
    setRandomIndex(Math.floor(Math.random() * Math.max(donorOptions.length, 1)));
  }, [open, donorOptions.length]);

  const resolvedDonor = selectedDonorId === RANDOM_DONOR_ID
    ? donorOptions[randomIndex % Math.max(1, donorOptions.length)]
    : donorOptions.find((donor) => donor.id === selectedDonorId) ?? donorOptions[0];

  const previewSubject = resolveTemplateText(draft.subject, resolvedDonor);
  const previewText = resolveTemplateText(draft.previewText, resolvedDonor);
  const previewBody = resolveTemplateText(draft.bodyText, resolvedDonor);

  if (!open) return null;

  const mergeTokens = [
    "{{preferredName}}",
    "{{fullName}}",
    "{{lastGiftAmount}}",
    "{{lastGiftDate}}",
    "{{campaignName}}",
    "{{organizationName}}",
    "{{staffName}}",
    "{{unsubscribeUrl}}",
    "{{managePreferencesUrl}}",
  ];

  return (
    <WorkspaceSetupModal
      title="Save As Email Template"
      subtitle="Review fields, then save to Communications and continue editing here in the workspace."
      onClose={onClose}
      maxWidthClassName="max-w-[94vw]"
      appearance="light"
    >
      <div className="grid gap-4 bg-slate-50 px-4 pb-4 pt-12 text-slate-900 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            Use merge fields for personalization. The saved template opens in the embedded Email Builder immediately after save.
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template name</span>
            <input
              value={draft.name}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
              placeholder="Steward draft template"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>
              <input
                value={draft.subject}
                onChange={(event) => onChange({ ...draft, subject: event.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
                placeholder="Subject line"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview text</span>
              <input
                value={draft.previewText}
                onChange={(event) => onChange({ ...draft, previewText: event.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
                placeholder="Inbox preview snippet"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email body</span>
            <textarea
              value={draft.bodyText}
              onChange={(event) => onChange({ ...draft, bodyText: event.target.value })}
              className="min-h-[260px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
              placeholder="Write email body..."
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quick merge fields</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mergeTokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => onChange({ ...draft, bodyText: `${draft.bodyText}${draft.bodyText ? " " : ""}${token}` })}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-100"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || !draft.name.trim() || !draft.subject.trim() || !draft.bodyText.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Rendered preview</p>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Merge fields resolved</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_max-content] xl:grid-cols-1">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview donor</span>
              <select
                value={selectedDonorId}
                onChange={(event) => setSelectedDonorId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15"
              >
                <option value={RANDOM_DONOR_ID}>Random sample donor</option>
                {donorOptions.map((donor) => (
                  <option key={donor.id} value={donor.id}>{donor.fullName}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedDonorId(RANDOM_DONOR_ID);
                setRandomIndex(Math.floor(Math.random() * Math.max(donorOptions.length, 1)));
              }}
              className="h-fit self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Shuffle sample
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-900">{resolvedDonor.fullName}</p>
            <p className="mt-1 text-[11px] text-slate-500">Last gift {resolvedDonor.lastGiftAmount} on {resolvedDonor.lastGiftDate}</p>
            <p className="text-[11px] text-slate-500">Campaign: {resolvedDonor.campaignName}</p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject preview</p>
            <p className="mt-1 text-sm text-slate-900">{previewSubject || "(No subject yet)"}</p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview text</p>
            <p className="mt-1 text-sm text-slate-700">{previewText || "(No preview text yet)"}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email render</p>
            <div className="mt-2 space-y-3 text-sm leading-6 text-slate-700">
              {previewBody.split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${paragraph.slice(0, 20)}-${index}`} className="whitespace-pre-wrap break-words">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </WorkspaceSetupModal>
  );
}
