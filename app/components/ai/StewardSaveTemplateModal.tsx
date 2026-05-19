"use client";

import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

export interface StewardTemplateDraft {
  name: string;
  subject: string;
  previewText: string;
  bodyText: string;
}

interface StewardSaveTemplateModalProps {
  open: boolean;
  draft: StewardTemplateDraft;
  saving: boolean;
  error: string | null;
  onChange: (next: StewardTemplateDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}

/**
 * In-workspace save flow for converting a Steward response into a reusable email template campaign.
 */
export default function StewardSaveTemplateModal({
  open,
  draft,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: StewardSaveTemplateModalProps) {
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
    >
      <div className="space-y-3 bg-[#020617] px-4 pb-4 pt-12 text-slate-100">
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-xs text-slate-300">
          Use merge fields for personalization. The saved template opens in the embedded Email Builder immediately after save.
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Template name</span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            className="w-full rounded-lg border border-white/15 bg-[#020817] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Steward draft template"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subject</span>
            <input
              value={draft.subject}
              onChange={(event) => onChange({ ...draft, subject: event.target.value })}
              className="w-full rounded-lg border border-white/15 bg-[#020817] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20"
              placeholder="Subject line"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview text</span>
            <input
              value={draft.previewText}
              onChange={(event) => onChange({ ...draft, previewText: event.target.value })}
              className="w-full rounded-lg border border-white/15 bg-[#020817] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20"
              placeholder="Inbox preview snippet"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email body</span>
          <textarea
            value={draft.bodyText}
            onChange={(event) => onChange({ ...draft, bodyText: event.target.value })}
            className="min-h-[260px] w-full resize-y rounded-lg border border-white/15 bg-[#020817] px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Write email body..."
          />
        </label>

        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick merge fields</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mergeTokens.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => onChange({ ...draft, bodyText: `${draft.bodyText}${draft.bodyText ? " " : ""}${token}` })}
                className="rounded-md border border-white/15 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                {token}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !draft.name.trim() || !draft.subject.trim() || !draft.bodyText.trim()}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>
    </WorkspaceSetupModal>
  );
}
