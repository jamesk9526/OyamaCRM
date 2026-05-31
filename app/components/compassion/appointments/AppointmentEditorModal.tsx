// Modal for creating and editing Compassion appointments with conflict handling.
// NOTE: Keep this modal custom; it includes conflict resolution and destructive confirmation flows.
"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { apiFetchResponse } from "@/app/lib/auth-client";
import {
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
  type ClientOption,
  type CompassionAppointmentRecord,
  type StaffOption,
} from "./types";
import { humanizeEnum, toDatetimeLocalValue } from "./appointmentUtils";

interface AppointmentEditorModalProps {
  open: boolean;
  mode: "create" | "edit";
  appointment?: CompassionAppointmentRecord | null;
  initialStartTime?: string | null;
  clientOptions: ClientOption[];
  staffOptions: StaffOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface ConflictPayload {
  id: string;
  reasons: string[];
  clientName: string;
  assignedStaffName: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
}

/** Returns a rounded next-hour default datetime-local string. */
function defaultStartTime(): string {
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return toDatetimeLocalValue(next.toISOString());
}

/** AppointmentEditorModal handles create/edit/cancel/no-show/delete workflows. */
export default function AppointmentEditorModal({
  open,
  mode,
  appointment,
  initialStartTime,
  clientOptions,
  staffOptions,
  onClose,
  onSaved,
}: AppointmentEditorModalProps) {
  const clientLabelById = useMemo(() => {
    return new Map(clientOptions.map((client) => [client.id, `${client.firstName} ${client.lastName}`.trim()]));
  }, [clientOptions]);

  const initialForm = useMemo(() => ({
    clientId: appointment?.clientId ?? "",
    appointmentType: appointment?.appointmentType ?? "INTAKE",
    status: appointment?.status ?? "SCHEDULED",
    startTime: appointment ? toDatetimeLocalValue(appointment.startTime) : (initialStartTime ? toDatetimeLocalValue(initialStartTime) : defaultStartTime()),
    durationMinutes: String(appointment?.durationMinutes ?? 60),
    assignedStaffId: appointment?.assignedCompassionStaffId ?? appointment?.assignedStaffId ?? "",
    location: appointment?.location ?? "",
    notes: appointment?.notes ?? "",
    followUpNeeded: Boolean(appointment?.followUpNeeded ?? appointment?.flags?.followUpNeeded),
  }), [appointment, initialStartTime]);

  const [form, setForm] = useState(initialForm);
  const [clientSearch, setClientSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictPayload[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Keep modal state aligned when switching between create/edit or opening another appointment.
  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setClientSearch(initialForm.clientId ? (clientLabelById.get(initialForm.clientId) ?? "") : "");
  }, [open, initialForm, clientLabelById]);

  const filteredClientOptions = useMemo(() => {
    const needle = clientSearch.trim().toLowerCase();
    if (!needle) return clientOptions;
    return clientOptions.filter((client) => {
      const name = `${client.firstName} ${client.lastName}`.toLowerCase();
      const email = (client.email ?? "").toLowerCase();
      const phone = (client.phone ?? "").toLowerCase();
      return name.includes(needle) || email.includes(needle) || phone.includes(needle);
    });
  }, [clientOptions, clientSearch]);

  if (!open) return null;

  const title = mode === "create" ? "Schedule Appointment" : "Edit Appointment";

  /** Runs create/update request and optionally forces save after conflict warning. */
  async function submit(forceConflict: boolean) {
    setSaving(true);
    setError(null);
    if (!forceConflict) setConflicts([]);

    try {
      const payload = {
        clientId: form.clientId,
        appointmentType: form.appointmentType,
        status: form.status,
        startTime: new Date(form.startTime).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        assignedCompassionStaffId: form.assignedStaffId || null,
        location: form.location || null,
        notes: form.notes || null,
        followUpNeeded: form.followUpNeeded,
        ...(forceConflict ? { allowConflict: true } : {}),
      };

      const path = mode === "create"
        ? "/api/compassion/appointments"
        : `/api/compassion/appointments/${appointment?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const response = await apiFetchResponse(path, {
        method,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 409 && Array.isArray(body?.conflicts)) {
          setConflicts(body.conflicts as ConflictPayload[]);
          throw new Error("This time overlaps with existing appointments.");
        }
        throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
      }

      await onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save appointment.");
    } finally {
      setSaving(false);
    }
  }

  /** Applies quick status transitions for front desk workflows. */
  async function runQuickStatus(status: string) {
    if (!appointment?.id) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetchResponse(`/api/compassion/appointments/${appointment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Failed to set status (${response.status})`);
      }
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  /** Deletes the appointment after explicit confirmation. */
  async function removeAppointment() {
    if (!appointment?.id) return;

    setSaving(true);
    setError(null);
    try {
      const response = await apiFetchResponse(`/api/compassion/appointments/${appointment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Failed to delete (${response.status})`);
      }
      await onSaved();
      setConfirmDeleteOpen(false);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete appointment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close appointment editor"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(false);
          }}
          className="p-6 space-y-4 overflow-y-auto max-h-[80vh]"
        >
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-900">Scheduling conflict detected</p>
              <div className="space-y-1 text-xs text-amber-800">
                {conflicts.map((conflict) => (
                  <p key={conflict.id}>
                    {new Date(conflict.startTime).toLocaleString()} with {conflict.clientName}
                    {conflict.assignedStaffName ? ` (${conflict.assignedStaffName})` : ""}
                    {conflict.location ? ` at ${conflict.location}` : ""}
                    {` [${conflict.reasons.join(", ")}]`}
                  </p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void submit(true)}
                className="text-xs font-medium text-amber-900 border border-amber-300 rounded px-2 py-1 hover:bg-amber-100"
                disabled={saving}
              >
                Save Anyway
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
              <input
                type="text"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Search client by name, email, or phone"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
              />
              <select
                required
                value={form.clientId}
                onChange={(event) => {
                  const nextClientId = event.target.value;
                  setForm((current) => ({ ...current, clientId: nextClientId }));
                  if (nextClientId) {
                    setClientSearch(clientLabelById.get(nextClientId) ?? "");
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select client…</option>
                {filteredClientOptions.map((client) => (
                  <option key={client.id} value={client.id}>{client.firstName} {client.lastName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Appointment Type</label>
              <select
                value={form.appointmentType}
                onChange={(event) => setForm((current) => ({ ...current, appointmentType: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {APPOINTMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{humanizeEnum(option)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Date & Time *</label>
              <input
                required
                type="datetime-local"
                value={form.startTime}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input
                min={5}
                max={720}
                step={5}
                type="number"
                value={form.durationMinutes}
                onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Staff</label>
              <select
                value={form.assignedStaffId}
                onChange={(event) => setForm((current) => ({ ...current, assignedStaffId: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.fullName ?? staff.displayName ?? `${staff.firstName} ${staff.lastName}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location / Room</label>
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Counseling Room A"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {APPOINTMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{humanizeEnum(option)}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 mt-6 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.followUpNeeded}
                onChange={(event) => setForm((current) => ({ ...current, followUpNeeded: event.target.checked }))}
                className="rounded border-gray-300"
              />
              Follow-up needed
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Staff Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              {mode === "edit" && (
                <>
                  <button
                    type="button"
                    onClick={() => void runQuickStatus("COMPLETED")}
                    className="text-xs font-medium px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    disabled={saving}
                  >
                    Mark Completed
                  </button>
                  <button
                    type="button"
                    onClick={() => void runQuickStatus("NO_SHOW")}
                    className="text-xs font-medium px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={saving}
                  >
                    Mark No-Show
                  </button>
                  <button
                    type="button"
                    onClick={() => void runQuickStatus("CANCELLED")}
                    className="text-xs font-medium px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {mode === "edit" && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="text-sm text-red-600 hover:text-red-700"
                  disabled={saving}
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                disabled={saving}
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Appointment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[90] bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Delete Appointment</h3>
            <p className="mt-2 text-sm text-gray-700">Delete this appointment? This action cannot be undone.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeAppointment()}
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
