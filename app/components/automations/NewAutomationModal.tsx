/**
 * NewAutomationModal — modal form to create a new Steward Path workflow.
 * Sends POST /api/automations with trigger + 1 initial action.
 */
// NOTE: Keep this modal custom; it has workflow-specific trigger/action logic that should not be removed.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/app/lib/navigation-boundaries";

const TRIGGERS = [
  { value: "DONATION_RECEIVED", label: "Donation received" },
  { value: "CONSTITUENT_CREATED", label: "New constituent added" },
  { value: "TASK_DUE", label: "Task becomes due" },
  { value: "PLEDGE_CREATED", label: "Pledge created" },
  { value: "EMAIL_OPENED", label: "Email opened" },
  { value: "EVENT_REGISTERED", label: "Event registration" },
];

const ACTION_TYPES = [
  { value: "SEND_EMAIL", label: "Create review-required email" },
  { value: "CREATE_TASK", label: "Create task" },
  { value: "ADD_TAG", label: "Add tag" },
  { value: "REMOVE_TAG", label: "Remove tag" },
  { value: "ASSIGN_USER", label: "Assign user" },
  { value: "UPDATE_FIELD", label: "Update field" },
];

interface NewAutomationModalProps {
  onClose: () => void;
  onCreated: () => void;
}

interface LinkableCampaignOption {
  id: string;
  name: string;
  status?: string;
}

interface LinkableTemplateOption {
  id: string;
  name: string;
  status?: string;
}

interface AccentTheme {
  primaryBg: string;
  primaryHoverBg: string;
  sidebarGradient: string;
  badgeBg: string;
  badgeText: string;
  focusRing: string;
  inputRing: string;
  borderTint: string;
}

/** Returns workspace-aware accent classes so modal theme follows active CRM module. */
function getAccentTheme(moduleKey: TopBarModuleKey): AccentTheme {
  if (moduleKey === "compassion") {
    return {
      primaryBg: "bg-blue-600",
      primaryHoverBg: "hover:bg-blue-700",
      sidebarGradient: "from-blue-600 to-sky-600",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700",
      focusRing: "focus:ring-blue-500",
      inputRing: "focus:ring-blue-500",
      borderTint: "border-blue-100",
    };
  }
  if (moduleKey === "events") {
    return {
      primaryBg: "bg-amber-600",
      primaryHoverBg: "hover:bg-amber-700",
      sidebarGradient: "from-amber-600 to-orange-600",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-700",
      focusRing: "focus:ring-amber-500",
      inputRing: "focus:ring-amber-500",
      borderTint: "border-amber-100",
    };
  }
  return {
    primaryBg: "bg-green-600",
    primaryHoverBg: "hover:bg-green-700",
    sidebarGradient: "from-green-600 to-emerald-600",
    badgeBg: "bg-green-50",
    badgeText: "text-green-700",
    focusRing: "focus:ring-green-500",
    inputRing: "focus:ring-green-500",
    borderTint: "border-green-100",
  };
}

/**
 * Modal form for creating a new Steward Path rule.
 * Supports one initial action; more can be added later (future feature).
 */
export default function NewAutomationModal({ onClose, onCreated }: NewAutomationModalProps) {
  const pathname = usePathname();
  const moduleKey = useMemo(() => resolveTopBarModuleKey(pathname || "/"), [pathname]);
  const theme = useMemo(() => getAccentTheme(moduleKey), [moduleKey]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("DONATION_RECEIVED");
  const [actionType, setActionType] = useState("SEND_EMAIL");
  const [linkedCampaignId, setLinkedCampaignId] = useState("");
  const [linkedLetterTemplateId, setLinkedLetterTemplateId] = useState("");
  const [firstDonationOnly, setFirstDonationOnly] = useState(false);
  const [majorGiftMinAmount, setMajorGiftMinAmount] = useState("");
  const [sharedWithOrganization, setSharedWithOrganization] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [campaignOptions, setCampaignOptions] = useState<LinkableCampaignOption[]>([]);
  const [templateOptions, setTemplateOptions] = useState<LinkableTemplateOption[]>([]);

  /** Loads campaign/template options for SEND_EMAIL action linkage dropdowns. */
  const loadLinkableOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [campaigns, templates] = await Promise.all([
        apiFetch<LinkableCampaignOption[]>("/api/email-campaigns"),
        apiFetch<LinkableTemplateOption[]>("/api/letters/templates?status=ACTIVE"),
      ]);
      setCampaignOptions(Array.isArray(campaigns) ? campaigns : []);
      setTemplateOptions(Array.isArray(templates) ? templates : []);
    } catch {
      setCampaignOptions([]);
      setTemplateOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (actionType === "SEND_EMAIL") {
      void loadLinkableOptions();
    }
  }, [actionType, loadLinkableOptions]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const triggerConfig: Record<string, unknown> = {};
      const actionConfig: Record<string, unknown> = {};
      if (trigger === "DONATION_RECEIVED") {
        if (firstDonationOnly) {
          triggerConfig.firstDonationOnly = true;
        }
        if (majorGiftMinAmount.trim()) {
          const parsed = Number.parseFloat(majorGiftMinAmount);
          if (!Number.isFinite(parsed) || parsed < 0) {
            setError("Major gift threshold must be a valid positive number.");
            setSaving(false);
            return;
          }
          triggerConfig.majorGiftMinAmount = parsed;
        }
      }

      if (actionType === "SEND_EMAIL") {
        if (linkedCampaignId.trim()) {
          actionConfig.campaignId = linkedCampaignId.trim();
        }
        if (linkedLetterTemplateId.trim()) {
          actionConfig.letterTemplateId = linkedLetterTemplateId.trim();
        }
      }

      await apiFetch("/api/automations", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          trigger,
          triggerConfig: Object.keys(triggerConfig).length ? triggerConfig : undefined,
          sharedWithOrganization,
          actions: [{ type: actionType, order: 0, config: Object.keys(actionConfig).length ? actionConfig : undefined }],
        }),
      });
      onCreated();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid lg:grid-cols-[260px_1fr]">
          <aside className={`relative bg-gradient-to-b ${theme.sidebarGradient} text-white p-5`}>
            <div className="absolute -right-10 -top-8 w-28 h-28 rounded-full bg-white/15 blur-md animate-pulse" />
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/80">Steward Guided Setup</p>
            <h2 className="mt-2 text-xl font-semibold">New Steward Path</h2>
            <p className="mt-2 text-sm text-white/85 leading-relaxed">
              Configure trigger rules, pick first actions, and wire clear edit links so staff can jump directly into the right CRM workspace.
            </p>
            <div className="mt-4 space-y-2 text-xs text-white/90">
              <p>1. Define trigger</p>
              <p>2. Define first action</p>
              <p>3. Link campaign/template context</p>
            </div>
          </aside>

          <div>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Steward Path Configuration</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="px-6 py-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thank-you email after donation"
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.inputRing} focus:border-transparent`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — describe what this Steward Path does"
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.inputRing}`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sharedWithOrganization}
              onChange={(e) => setSharedWithOrganization(e.target.checked)}
              className={`rounded border-gray-300 ${theme.focusRing}`}
            />
            Visible to other users in this organization
          </label>

          {/* Trigger */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">When (trigger)</label>
            <select
              value={trigger}
              onChange={(e) => {
                const next = e.target.value;
                setTrigger(next);
                if (next !== "DONATION_RECEIVED") {
                  setFirstDonationOnly(false);
                  setMajorGiftMinAmount("");
                }
              }}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.inputRing}`}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {trigger === "DONATION_RECEIVED" && (
            <div className={`rounded-lg border ${theme.borderTint} ${theme.badgeBg}/50 p-3 space-y-3`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${theme.badgeText}`}>Donation Guardrails</p>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={firstDonationOnly}
                  onChange={(e) => setFirstDonationOnly(e.target.checked)}
                  className={`rounded border-gray-300 ${theme.focusRing}`}
                />
                Run only for the constituent's first completed donation
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Major gift threshold (optional)</label>
                <input
                  value={majorGiftMinAmount}
                  onChange={(e) => setMajorGiftMinAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.inputRing}`}
                />
                <p className="text-xs text-gray-500 mt-1">If provided, path runs only when donation amount is at least this value.</p>
              </div>
            </div>
          )}

          {/* Initial action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Then (first action)</label>
            <select
              value={actionType}
              onChange={(e) => {
                const next = e.target.value;
                setActionType(next);
                if (next !== "SEND_EMAIL") {
                  setLinkedCampaignId("");
                  setLinkedLetterTemplateId("");
                }
              }}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.inputRing}`}
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Additional actions can be configured after creation.</p>
          </div>

          {actionType === "SEND_EMAIL" && (
            <div className={`rounded-lg border ${theme.borderTint} ${theme.badgeBg}/40 p-3 space-y-3`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${theme.badgeText}`}>Linked Workflow Targets</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email campaign ID (optional)</label>
                <select
                  value={linkedCampaignId}
                  onChange={(e) => setLinkedCampaignId(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.inputRing}`}
                >
                  <option value="">Select campaign</option>
                  {campaignOptions.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}{campaign.status ? ` (${campaign.status})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {optionsLoading ? "Loading campaigns..." : "Select a campaign so the path card can jump directly to the campaign workspace."}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Letter template ID (optional)</label>
                <select
                  value={linkedLetterTemplateId}
                  onChange={(e) => setLinkedLetterTemplateId(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${theme.inputRing}`}
                >
                  <option value="">Select letter template</option>
                  {templateOptions.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}{template.status ? ` (${template.status})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {optionsLoading ? "Loading templates..." : "Select a template to enable direct edit navigation in Letters & Printables."}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${theme.primaryBg} ${theme.primaryHoverBg}`}>
              {saving ? "Creating…" : "Create Steward Path"}
            </button>
          </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
