/**
 * NewAutomationModal — modal form to create a new automation workflow.
 * Sends POST /api/automations with trigger + 1 initial action.
 */
"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
 * Modal form for creating a new automation rule.
 * Supports one initial action; more can be added later (future feature).
 */
export default function NewAutomationModal({ onClose, onCreated }: NewAutomationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("DONATION_RECEIVED");
  const [actionType, setActionType] = useState("SEND_EMAIL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          trigger,
          actions: [{ type: actionType, order: 0 }],
        }),
      });
      if (!res.ok) throw new Error("Failed to create automation");
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
          <h2 className="text-lg font-semibold text-gray-900">New Automation</h2>
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
              placeholder="Optional — describe what this automation does"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">When (trigger)</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

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
              {saving ? "Creating…" : "Create Automation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
