/**
 * FunderManager — manage grant funders (foundations, government agencies, etc.).
 * Lists all funders with grant counts, supports add/edit via modal.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { GrantFunder, GrantFunderType } from "./types";

const FUNDER_TYPES: { value: GrantFunderType; label: string }[] = [
  { value: "PRIVATE_FOUNDATION", label: "Private Foundation" },
  { value: "GOVERNMENT",         label: "Government" },
  { value: "CORPORATE",          label: "Corporate / Business" },
  { value: "COMMUNITY",          label: "Community Foundation" },
  { value: "FAITH_BASED",        label: "Faith-Based" },
  { value: "INDIVIDUAL",         label: "Individual Donor" },
  { value: "OTHER",              label: "Other" },
];

/** Inline add/edit form that appears as a card below the button. */
function FunderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: GrantFunder;
  onSave: (f: GrantFunder) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<GrantFunderType>(initial?.type ?? "PRIVATE_FOUNDATION");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), type, website: website.trim() || undefined,
        contactName: contactName.trim() || undefined, contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined, notes: notes.trim() || undefined };
      let result: GrantFunder;
      if (initial) {
        result = await apiFetch<GrantFunder>(`/api/grants/funders/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        result = await apiFetch<GrantFunder>("/api/grants/funders", { method: "POST", body: JSON.stringify(body) });
      }
      onSave(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">{initial ? "Edit Funder" : "Add New Funder"}</h3>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Organization Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Smith Family Foundation"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as GrantFunderType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            {FUNDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes / Research</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder="Giving interests, funding cycles, relationship notes…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Funder"}
        </button>
      </div>
    </div>
  );
}

/** FunderManager — list and manage grant funders for the organization. */
export default function FunderManager() {
  const [funders, setFunders] = useState<GrantFunder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<GrantFunder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<GrantFunder[]>("/api/grants/funders");
      setFunders(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(f: GrantFunder) {
    setFunders((prev) => {
      const idx = prev.findIndex((x) => x.id === f.id);
      return idx >= 0 ? prev.map((x) => x.id === f.id ? f : x) : [f, ...prev];
    });
    setShowAdd(false);
    setEditTarget(null);
  }

  const TYPE_LABELS: Record<GrantFunderType, string> = {
    PRIVATE_FOUNDATION: "Private Foundation",
    GOVERNMENT: "Government",
    CORPORATE: "Corporate",
    COMMUNITY: "Community Foundation",
    FAITH_BASED: "Faith-Based",
    INDIVIDUAL: "Individual",
    OTHER: "Other",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Grant Funders</h2>
          <p className="text-xs text-gray-500 mt-0.5">Foundations, government agencies, and corporate funders</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Add Funder
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <FunderForm onSave={handleSaved} onCancel={() => setShowAdd(false)} />
      )}

      {/* Funder list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : funders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          No funders yet. Add your first grant funder to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {funders.map((f) => (
            <div key={f.id}>
              {editTarget?.id === f.id ? (
                <FunderForm initial={f} onSave={handleSaved} onCancel={() => setEditTarget(null)} />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4 hover:border-gray-300 transition-colors">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{f.name}</p>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[f.type] ?? f.type}
                      </span>
                      {(f._count?.grants ?? 0) > 0 && (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          {f._count?.grants} grant{(f._count?.grants ?? 0) !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      {f.contactName && <span>👤 {f.contactName}</span>}
                      {f.contactEmail && <span>✉ {f.contactEmail}</span>}
                      {f.website && (
                        <a href={f.website} target="_blank" rel="noreferrer" className="hover:underline text-blue-600">
                          🌐 Website
                        </a>
                      )}
                    </div>
                    {f.notes && <p className="text-xs text-gray-400 line-clamp-1">{f.notes}</p>}
                  </div>
                  <button
                    onClick={() => setEditTarget(f)}
                    className="text-xs text-gray-400 hover:text-gray-700 shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
