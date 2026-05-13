/**
 * AddGrantModal — modal form for creating or editing a grant case-file record.
 * Fetches the funder list so the user can pick one via dropdown.
 * On creation, the API auto-seeds writing sections and optional case-file helper rows.
 */
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { Grant, GrantFunder, GrantStatus } from "./types";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
};

interface Props {
  /** Existing grant for edit mode; undefined = create mode. */
  grant?: Grant | null;
  onClose: () => void;
  onSaved: (g: Grant) => void;
}

/** All selectable grant statuses shown in the form dropdown. */
const STATUS_OPTIONS: { value: GrantStatus; label: string }[] = [
  { value: "IDEA",               label: "Watching" },
  { value: "RESEARCH",           label: "Researching" },
  { value: "LOI_DRAFT",          label: "LOI Needed" },
  { value: "LOI_SUBMITTED",      label: "LOI Submitted" },
  { value: "PROPOSAL_DRAFT",     label: "Application In Progress" },
  { value: "PROPOSAL_SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW",       label: "Awaiting Decision" },
  { value: "AWARDED",            label: "Awarded" },
  { value: "REJECTED",           label: "Declined" },
  { value: "WITHDRAWN",          label: "Closed" },
  { value: "CLOSED",             label: "Archived" },
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
  const [users, setUsers] = useState<UserOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState(initial?.title ?? "");
  const [funderId, setFunderId] = useState(initial?.funderId ?? "");
  const [programArea, setProgramArea] = useState(initial?.programArea ?? "");
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? "");
  const [status, setStatus] = useState<GrantStatus>(initial?.status ?? "IDEA");
  const [amountRequested, setAmountRequested] = useState(String(initial?.amountRequested ?? ""));
  const [amountAwarded, setAmountAwarded] = useState(String(initial?.amountAwarded ?? ""));
  const [requiresLOI, setRequiresLOI] = useState(initial?.requiresLOI ?? false);
  const [loiDeadline, setLoiDeadline] = useState(toDateInput(initial?.loiDeadline));
  const [applicationDeadline, setApplicationDeadline] = useState(toDateInput(initial?.applicationDeadline));
  const [reportingDeadline, setReportingDeadline] = useState(toDateInput(initial?.reportingDeadline));
  const [reminderDate, setReminderDate] = useState("");
  const [applicationPortalUrl, setApplicationPortalUrl] = useState("");
  const [eligibilityNotes, setEligibilityNotes] = useState(initial?.internalNotes ?? "");
  const [researchNotes, setResearchNotes] = useState(initial?.notes ?? "");
  const [requiredDocuments, setRequiredDocuments] = useState("");

  // Load funder list on mount
  useEffect(() => {
    apiFetch<GrantFunder[]>("/api/grants/funders").then(setFunders).catch(() => {});
    apiFetch<{ items?: UserOption[] }>("/api/users")
      .then((response) => setUsers(response.items ?? []))
      .catch(() => setUsers([]));
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
        assigneeId: assigneeId || null,
        status,
        amountRequested: amountRequested ? Number(amountRequested) : undefined,
        amountAwarded:   amountAwarded   ? Number(amountAwarded)   : undefined,
        requiresLOI,
        loiDeadline:          loiDeadline          || null,
        applicationDeadline:  applicationDeadline  || null,
        reportingDeadline:    reportingDeadline     || null,
        notes: researchNotes.trim() || undefined,
        internalNotes: eligibilityNotes.trim() || undefined,
      };

      let result: Grant;
      if (isEdit) {
        result = await apiFetch<Grant>(`/api/grants/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        result = await apiFetch<Grant>("/api/grants", { method: "POST", body: JSON.stringify(body) });

        // Seed helper case-file rows for the new grant workspace.
        if (reminderDate) {
          await apiFetch(`/api/grants/${result.id}/case-items`, {
            method: "POST",
            body: JSON.stringify({
              kind: "REMINDER",
              title: "Primary grant reminder",
              description: "Initial reminder captured during grant setup.",
              status: "PENDING",
              dueAt: reminderDate,
              remindAt: reminderDate,
              assignedToId: assigneeId || undefined,
              reminderType: "Custom Reminder",
              priority: "MEDIUM",
            }),
          }).catch(() => {});
        }

        if (applicationPortalUrl.trim()) {
          await apiFetch(`/api/grants/${result.id}/case-items`, {
            method: "POST",
            body: JSON.stringify({
              kind: "RESOURCE",
              title: "Application Portal",
              description: "Primary funder application link.",
              status: "ACTIVE",
              resourceType: "Portal",
              url: applicationPortalUrl.trim(),
              pinned: true,
            }),
          }).catch(() => {});
        }

        const requirementRows = requiredDocuments
          .split("\n")
          .map((row) => row.trim())
          .filter(Boolean)
          .slice(0, 20);

        for (const requirementTitle of requirementRows) {
          await apiFetch(`/api/grants/${result.id}/case-items`, {
            method: "POST",
            body: JSON.stringify({
              kind: "REQUIREMENT",
              title: requirementTitle,
              description: "Required grant application item",
              status: "NOT_STARTED",
              assignedToId: assigneeId || undefined,
              dueAt: applicationDeadline || undefined,
              priority: "MEDIUM",
            }),
          }).catch(() => {});
        }
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
      subtitle="Capture a complete grant research case file with deadlines, writing ownership, reminders, and resources."
      checklist={["1. Select funder and writer", "2. Add deadlines, portal, and notes", "3. Save case file and reminders"]}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
    >
      <div className="px-6 py-5 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900">Grant Research Case File</h3>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {error && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grant Opportunity Name <span className="text-red-500">*</span></label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Program / Purpose</label>
              <input
                value={programArea}
                onChange={(e) => setProgramArea(e.target.value)}
                placeholder="e.g., Youth Services"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Grant Writer</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— Unassigned —</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Reminder Date</label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Application Portal URL</label>
            <input
              value={applicationPortalUrl}
              onChange={(e) => setApplicationPortalUrl(e.target.value)}
              placeholder="https://"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
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
                placeholder="Optional until decision is recorded"
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

          {/* Research and requirement context */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Eligibility Notes</label>
              <textarea
                value={eligibilityNotes}
                onChange={(e) => setEligibilityNotes(e.target.value)}
                rows={2}
                placeholder="Eligibility fit, restrictions, required match, and geographic notes"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Research Notes</label>
              <textarea
                value={researchNotes}
                onChange={(e) => setResearchNotes(e.target.value)}
                rows={3}
                placeholder="Mission fit, funder priorities, strategy notes, and writing context"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Required Documents (one per line)</label>
              <textarea
                value={requiredDocuments}
                onChange={(e) => setRequiredDocuments(e.target.value)}
                rows={3}
                placeholder="LOI\nProgram budget\nOrganization budget\nIRS letter\nBoard list"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>

            <p className="text-xs text-gray-500">Security note: do not store passwords in grant resources or notes.</p>
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
              {saving ? "Saving…" : isEdit ? "Save Case File" : "Create Grant Case File"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSetupModal>
  );
}
