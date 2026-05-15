/** Real sponsors management page for Events CRM — wired to /api/events/:eventId/sponsors. */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

interface Constituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  employer?: string;
}

interface Sponsor {
  id: string;
  eventId: string;
  constituentId: string;
  level: SponsorshipLevel;
  amount: string;
  benefits?: string;
  logoUrl?: string;
  websiteUrl?: string;
  notes?: string;
  createdAt: string;
  constituent: Constituent;
}

/** Sponsorship level enum values matching the Prisma schema. */
type SponsorshipLevel = "TITLE" | "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "PARTNER" | "IN_KIND";

const SPONSORSHIP_LEVELS: SponsorshipLevel[] = [
  "TITLE",
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "PARTNER",
  "IN_KIND",
];

// ─── Level badge colors ───────────────────────────────────────────────────────

/**
 * Returns a Tailwind color class pair for a given sponsorship level badge.
 */
function levelBadgeClass(level: SponsorshipLevel): string {
  switch (level) {
    case "TITLE":
      return "bg-purple-100 text-purple-800";
    case "PLATINUM":
      return "bg-indigo-100 text-indigo-800";
    case "GOLD":
      return "bg-yellow-100 text-yellow-800";
    case "SILVER":
      return "bg-gray-100 text-gray-700";
    case "BRONZE":
      return "bg-orange-100 text-orange-800";
    case "PARTNER":
      return "bg-green-100 text-green-800";
    case "IN_KIND":
      return "bg-teal-100 text-teal-800";
  }
}

// ─── Sponsor Form Modal ───────────────────────────────────────────────────────

interface SponsorFormData {
  eventId: string;
  constituentId: string;
  level: SponsorshipLevel;
  amount: string;
  benefits: string;
  logoUrl: string;
  websiteUrl: string;
  notes: string;
}

/**
 * Modal form for creating or editing a sponsor record.
 * Props:
 *   mode — "create" opens a blank form; "edit" pre-fills the existing sponsor
 *   initialData — pre-filled values for edit mode
 *   events — list of available events for the event selector
 *   defaultEventId — pre-selected event (used in create mode from event context)
 */
function SponsorModal({
  mode,
  initialData,
  events,
  defaultEventId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initialData?: Sponsor;
  events: Event[];
  defaultEventId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SponsorFormData>({
    eventId: initialData?.eventId ?? defaultEventId,
    constituentId: initialData?.constituentId ?? "",
    level: initialData?.level ?? "GOLD",
    amount: initialData ? String(Number(initialData.amount).toFixed(2)) : "",
    benefits: initialData?.benefits ?? "",
    logoUrl: initialData?.logoUrl ?? "",
    websiteUrl: initialData?.websiteUrl ?? "",
    notes: initialData?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Submit create or update */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.eventId || !form.constituentId || !form.amount) {
      setError("Event, constituent ID, and amount are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (mode === "create") {
        await apiFetch(`/api/events/${form.eventId}/sponsors`, {
          method: "POST",
          body: JSON.stringify({
            constituentId: form.constituentId,
            level: form.level,
            amount: Number(form.amount),
            benefits: form.benefits || undefined,
            logoUrl: form.logoUrl || undefined,
            websiteUrl: form.websiteUrl || undefined,
            notes: form.notes || undefined,
          }),
        });
      } else if (initialData) {
        await apiFetch(`/api/events/sponsors/${initialData.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            level: form.level,
            amount: Number(form.amount),
            benefits: form.benefits || undefined,
            logoUrl: form.logoUrl || undefined,
            websiteUrl: form.websiteUrl || undefined,
            notes: form.notes || undefined,
          }),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sponsor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceSetupModal
      title={mode === "create" ? "Add Sponsor" : "Edit Sponsor"}
      subtitle="Manage event sponsorship commitments, levels, and benefits in one guided modal."
      checklist={["1. Select event and constituent", "2. Set level and amount", "3. Save sponsor"]}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
    >
      <div className="bg-white w-full overflow-y-auto max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {mode === "create" ? "Add Sponsor" : "Edit Sponsor"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Event selector — pre-selected in create mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Event</label>
            <select
              value={form.eventId}
              onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
              disabled={mode === "edit"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-50"
              required
            >
              <option value="">Select event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} — {new Date(ev.startDate).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {/* Constituent ID input (search/type) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Constituent ID
            </label>
            <input
              type="text"
              value={form.constituentId}
              onChange={(e) => setForm((f) => ({ ...f, constituentId: e.target.value }))}
              disabled={mode === "edit"}
              placeholder="Paste constituent ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Find IDs in the Constituents module. Sponsor must belong to this organization.
            </p>
          </div>

          {/* Level & Amount row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as SponsorshipLevel }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                required
              >
                {SPONSORSHIP_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Benefits</label>
            <textarea
              value={form.benefits}
              onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
              placeholder="Logo on program, table for 10, speaking slot..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Logo & Website URLs */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Logo URL</label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Website URL</label>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : mode === "create" ? "Add Sponsor" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSetupModal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

/**
 * EventsSponsorsPage — manage event sponsors with full CRUD wired to the backend.
 * Shows metrics, a sponsor table/grid, and modals for add/edit/delete.
 */
export default function EventsSponsorsPage() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const workspaceEventId = params.eventId ?? searchParams.get("eventId") ?? "";
  const eventScoped = workspaceEventId.length > 0;

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceEventId) {
      setSelectedEventId(workspaceEventId);
    }
  }, [workspaceEventId]);

  /** Load active events for the selector */
  useEffect(() => {
    apiFetch("/api/events")
      .then((data) => {
        const active = (data as Event[]).filter((e) => e.active);
        setEvents(active);
        // Auto-select first event
        if (!workspaceEventId && active.length > 0) setSelectedEventId(active[0].id);
      })
      .catch(console.error);
  }, [workspaceEventId]);

  /** Load sponsors when the selected event changes */
  const loadSponsors = useCallback(async () => {
    if (!selectedEventId) {
      setSponsors([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch(`/api/events/${selectedEventId}/sponsors`);
      setSponsors(data as Sponsor[]);
    } catch (err) {
      console.error("Failed to load sponsors:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadSponsors();
  }, [loadSponsors]);

  /** Delete a sponsor after confirmation */
  async function handleDelete(sponsorId: string) {
    setDeletingId(sponsorId);
    try {
      await apiFetch(`/api/events/sponsors/${sponsorId}`, { method: "DELETE" });
      setSponsors((prev) => prev.filter((s) => s.id !== sponsorId));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete sponsor:", err);
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Metrics ───────────────────────────────────────────────────────────────

  const totalRevenue = sponsors.reduce((sum, s) => sum + Number(s.amount), 0);
  const withLogos = sponsors.filter((s) => s.logoUrl).length;
  const missingLogos = sponsors.length - withLogos;

  return (
    <div className="p-6 space-y-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/workspace" },
          { label: "Sponsors" },
        ]}
        statusLabel={eventScoped ? "Event Scoped" : "All Events"}
        metadata={`${sponsors.length.toLocaleString()} sponsor${sponsors.length === 1 ? "" : "s"} · $${totalRevenue.toFixed(2)} revenue`}
        accentTone="amber"
        primaryAction={selectedEventId ? <WorkspaceRibbonButton label="Add Sponsor" onClick={() => { setEditingSponsor(null); setShowModal(true); }} variant="primary" accentTone="amber" /> : undefined}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Create">
          <WorkspaceRibbonButton label="Add Sponsor" onClick={() => { setEditingSponsor(null); setShowModal(true); }} variant="primary" disabled={!selectedEventId} accentTone="amber" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadSponsors()} disabled={!selectedEventId} accentTone="amber" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      {/* Event Selector */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Event</label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          disabled={eventScoped}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
        >
          <option value="">{eventScoped ? "Event Workspace" : "Select an event"}</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — {new Date(e.startDate).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {!selectedEventId ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Select an event to view sponsors
        </div>
      ) : (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Total Sponsors</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{sponsors.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Revenue</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                ${totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">With Logos</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{withLogos}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Missing Logos</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{missingLogos}</p>
            </div>
          </div>

          {/* Sponsor list */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading sponsors...</div>
            ) : sponsors.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No sponsors yet. Click &quot;Add Sponsor&quot; to add one.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sponsor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Benefits</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Website</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Logo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sponsors.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      {/* Sponsor name from linked constituent */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {s.constituent.firstName} {s.constituent.lastName}
                        </p>
                        {s.constituent.employer && (
                          <p className="text-xs text-gray-500">{s.constituent.employer}</p>
                        )}
                        {s.constituent.email && (
                          <p className="text-xs text-gray-400">{s.constituent.email}</p>
                        )}
                      </td>

                      {/* Level badge — color-coded by tier */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${levelBadgeClass(s.level)}`}>
                          {s.level}
                        </span>
                      </td>

                      {/* Dollar amount */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900">
                          ${Number(s.amount).toFixed(2)}
                        </span>
                      </td>

                      {/* Benefits snippet */}
                      <td className="px-4 py-3">
                        {s.benefits ? (
                          <p className="text-xs text-gray-600 max-w-[180px] truncate" title={s.benefits}>
                            {s.benefits}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Website link */}
                      <td className="px-4 py-3">
                        {s.websiteUrl ? (
                          <a
                            href={s.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-amber-600 hover:underline truncate max-w-[120px] block"
                          >
                            {s.websiteUrl.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Logo status */}
                      <td className="px-4 py-3 text-center">
                        {s.logoUrl ? (
                          <span className="text-xs text-green-600 font-medium">✓ Yes</span>
                        ) : (
                          <span className="text-xs text-red-500">Missing</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditingSponsor(s); setShowModal(true); }}
                            className="text-xs text-gray-600 hover:text-amber-700 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(s.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <SponsorModal
          mode={editingSponsor ? "edit" : "create"}
          initialData={editingSponsor ?? undefined}
          events={events}
          defaultEventId={selectedEventId}
          onClose={() => { setShowModal(false); setEditingSponsor(null); }}
          onSaved={() => { setShowModal(false); setEditingSponsor(null); loadSponsors(); }}
        />
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <WorkspaceSetupModal
          title="Remove Sponsor"
          subtitle="Confirm sponsor removal from this event. Constituent records stay intact."
          checklist={["1. Review warning", "2. Confirm removal"]}
          onClose={() => setConfirmDeleteId(null)}
          maxWidthClassName="max-w-4xl"
        >
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Sponsor?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will remove the sponsor record from this event. The constituent profile will remain.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmDeleteId ? "Removing..." : "Remove Sponsor"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}
