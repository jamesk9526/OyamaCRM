/**
 * AddGrantModal — modal form for creating or editing a grant.
 * Fetches the funder list so the user can pick one via dropdown.
 * On creation, the API auto-seeds default writing sections.
 */
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { Grant, GrantFunder, GrantStatus } from "./types";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

interface Props {
  /** Existing grant for edit mode; undefined = create mode. */
  grant?: Grant | null;
  onClose: () => void;
  onSaved: (g: Grant) => void;
}

/** All selectable grant statuses shown in the form dropdown. */
const STATUS_OPTIONS: { value: GrantStatus; label: string }[] = [
  { value: "IDEA",               label: "Idea" },
  { value: "RESEARCH",           label: "Research" },
  { value: "LOI_DRAFT",          label: "LOI Draft" },
  { value: "LOI_SUBMITTED",      label: "LOI Submitted" },
  { value: "PROPOSAL_DRAFT",     label: "Proposal Draft" },
  { value: "PROPOSAL_SUBMITTED", label: "Proposal Submitted" },
  { value: "UNDER_REVIEW",       label: "Under Review" },
  { value: "AWARDED",            label: "Awarded" },
  { value: "REJECTED",           label: "Rejected" },
  { value: "WITHDRAWN",          label: "Withdrawn" },
  { value: "CLOSED",             label: "Closed" },
];

/** Convert an ISO date string to the YYYY-MM-DD format expected by <input type="date">. */
function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/** AddGrantModal — create or edit a grant with funder, status, amounts, and deadlines. */
export default function AddGrantModal({ grant: initial, onClose, onSaved }: Props) {
  const isEdit = !!initial;
  const [funders, setFunders] = useState<GrantFunder[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState(initial?.title ?? "");
  const [funderId, setFunderId] = useState(initial?.funderId ?? "");
  const [programArea, setProgramArea] = useState(initial?.programArea ?? "");
  const [status, setStatus] = useState<GrantStatus>(initial?.status ?? "IDEA");
  const [amountRequested, setAmountRequested] = useState(String(initial?.amountRequested ?? ""));
  const [amountAwarded, setAmountAwarded] = useState(String(initial?.amountAwarded ?? ""));
  const [requiresLOI, setRequiresLOI] = useState(initial?.requiresLOI ?? false);
  const [loiDeadline, setLoiDeadline] = useState(toDateInput(initial?.loiDeadline));
  const [applicationDeadline, setApplicationDeadline] = useState(toDateInput(initial?.applicationDeadline));
  const [reportingDeadline, setReportingDeadline] = useState(toDateInput(initial?.reportingDeadline));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Load funder list on mount
  useEffect(() => {
    apiFetch<GrantFunder[]>("/api/grants/funders").then(setFunders).catch(() => {});
  }, []);

  /** Submit: POST (create) or PATCH (update). */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (!funderId)     { setError("Please select a funder"); return; }

    setSaving(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        funderId,
        programArea: programArea.trim() || undefined,
        status,
        amountRequested: amountRequested ? Number(amountRequested) : undefined,
        amountAwarded:   amountAwarded   ? Number(amountAwarded)   : undefined,
        requiresLOI,
        loiDeadline:          loiDeadline          || null,
        applicationDeadline:  applicationDeadline  || null,
        reportingDeadline:    reportingDeadline     || null,
        notes: notes.trim() || undefined,
      };

      let result: Grant;
      if (isEdit) {
        result = await apiFetch<Grant>(`/api/grants/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        result = await apiFetch<Grant>("/api/grants", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceSetupModal
      title={isEdit ? "Edit Grant" : "New Grant Opportunity"}
      subtitle="Manage grant pipeline details, deadlines, and amounts with a unified CRM workflow modal."
      checklist={["1. Select funder", "2. Define status and amounts", "3. Save grant opportunity"]}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
    >
      <div className="px-6 py-5 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900">Grant Details</h3>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {error && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grant Title <span className="text-red-500">*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Community Innovation Fund 2026"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Funder */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funder <span className="text-red-500">*</span></label>
              <select
                value={funderId}
                onChange={(e) => setFunderId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Select funder —</option>
                {funders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {funders.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No funders yet — add one in the Funders tab first.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program Area</label>
              <input
                value={programArea}
                onChange={(e) => setProgramArea(e.target.value)}
                placeholder="e.g., Youth Services"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Status + Amounts */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GrantStatus)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Requested ($)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={amountRequested}
                onChange={(e) => setAmountRequested(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Awarded ($)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={amountAwarded}
                onChange={(e) => setAmountAwarded(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Deadlines */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresLOI}
                  onChange={(e) => setRequiresLOI(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                This grant requires a Letter of Intent (LOI)
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {requiresLOI && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LOI Deadline</label>
                  <input
                    type="date"
                    value={loiDeadline}
                    onChange={(e) => setLoiDeadline(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Application Deadline</label>
                <input
                  type="date"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Deadline</label>
                <input
                  type="date"
                  value={reportingDeadline}
                  onChange={(e) => setReportingDeadline(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes about this grant opportunity..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Grant"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSetupModal>
  );
}
