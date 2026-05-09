/**
 * NewAutomationModal — modal form to create a new Steward Path workflow.
 * Sends POST /api/automations with trigger + 1 initial action.
 */
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

const TRIGGERS = [
  { value: "DONATION_RECEIVED", label: "Donation received" },
  { value: "CONSTITUENT_CREATED", label: "New constituent added" },
  { value: "TASK_DUE", label: "Task becomes due" },
  { value: "PLEDGE_CREATED", label: "Pledge created" },
  { value: "EMAIL_OPENED", label: "Email opened" },
  { value: "EVENT_REGISTERED", label: "Event registration" },
];

const ACTION_TYPES = [
  { value: "SEND_EMAIL", label: "Send email" },
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

/**
 * Modal form for creating a new Steward Path rule.
 * Supports one initial action; more can be added later (future feature).
 */
export default function NewAutomationModal({ onClose, onCreated }: NewAutomationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("DONATION_RECEIVED");
  const [actionType, setActionType] = useState("SEND_EMAIL");
  const [firstDonationOnly, setFirstDonationOnly] = useState(false);
  const [majorGiftMinAmount, setMajorGiftMinAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const triggerConfig: Record<string, unknown> = {};
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

      await apiFetch("/api/automations", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          trigger,
          triggerConfig: Object.keys(triggerConfig).length ? triggerConfig : undefined,
          actions: [{ type: actionType, order: 0 }],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">New Steward Path</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thank-you email after donation"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — describe what this Steward Path does"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {trigger === "DONATION_RECEIVED" && (
            <div className="rounded-lg border border-green-100 bg-green-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Donation Guardrails</p>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={firstDonationOnly}
                  onChange={(e) => setFirstDonationOnly(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Run only for the constituent's first completed donation
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Major gift threshold (optional)</label>
                <input
                  value={majorGiftMinAmount}
                  onChange={(e) => setMajorGiftMinAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Additional actions can be configured after creation.</p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? "Creating…" : "Create Steward Path"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
