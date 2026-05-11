// Compassion staff directory manager for adding, editing, linking, and optional account creation.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface LinkedUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
}

interface CompassionStaffRecord {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  fullName: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  supportsScheduling: boolean;
  linkedUserId?: string | null;
  hasLinkedAccount: boolean;
  notes?: string | null;
  linkedUser?: LinkedUserSummary | null;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface StaffFormState {
  firstName: string;
  lastName: string;
  displayName: string;
  title: string;
  email: string;
  phone: string;
  linkedUserId: string;
  supportsScheduling: boolean;
  isActive: boolean;
  notes: string;
}

interface AccountFormState {
  email: string;
  password: string;
  role: "report_viewer" | "readonly";
}

const EMPTY_STAFF_FORM: StaffFormState = {
  firstName: "",
  lastName: "",
  displayName: "",
  title: "",
  email: "",
  phone: "",
  linkedUserId: "",
  supportsScheduling: true,
  isActive: true,
  notes: "",
};

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  email: "",
  password: "",
  role: "report_viewer",
};

/** Returns a normalized display label for linked users in account selector dropdowns. */
function userOptionLabel(user: UserOption): string {
  return `${user.firstName} ${user.lastName} (${user.email})`;
}

/**
 * CompassionStaffDirectoryManager renders CRUD + account-link workflows for Compassion staff.
 * TODO: enforce Compassion workspace permission
 */
export default function CompassionStaffDirectoryManager() {
  const [staff, setStaff] = useState<CompassionStaffRecord[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_STAFF_FORM);

  const [accountModalStaff, setAccountModalStaff] = useState<CompassionStaffRecord | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);

  /** Loads staff directory and available user-link options. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffRows, users] = await Promise.all([
        apiFetch<CompassionStaffRecord[]>("/api/compassion/staff?limit=300"),
        apiFetch<UserOption[]>("/api/compassion/staff/user-options").catch(() => []),
      ]);
      setStaff(Array.isArray(staffRows) ? staffRows : []);
      setUserOptions(Array.isArray(users) ? users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Compassion staff directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => staff.filter((member) => member.isActive).length, [staff]);
  const linkedAccountCount = useMemo(() => staff.filter((member) => member.hasLinkedAccount).length, [staff]);

  /** Opens form in create mode. */
  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_STAFF_FORM);
    setSuccess(null);
    setError(null);
  }

  /** Opens form in edit mode for one staff record. */
  function startEdit(member: CompassionStaffRecord) {
    setEditingId(member.id);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      displayName: member.displayName ?? "",
      title: member.title ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      linkedUserId: member.linkedUserId ?? "",
      supportsScheduling: member.supportsScheduling,
      isActive: member.isActive,
      notes: member.notes ?? "",
    });
    setSuccess(null);
    setError(null);
  }

  /** Resets form and leaves edit/create mode. */
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_STAFF_FORM);
  }

  /** Persists create or update based on current editing state. */
  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        displayName: form.displayName.trim() || undefined,
        title: form.title.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        linkedUserId: form.linkedUserId || null,
        supportsScheduling: form.supportsScheduling,
        isActive: form.isActive,
        notes: form.notes.trim() || undefined,
      };

      if (editingId) {
        await apiFetch(`/api/compassion/staff/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccess("Staff profile updated.");
      } else {
        await apiFetch("/api/compassion/staff", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Staff profile created.");
      }

      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save staff profile.");
    } finally {
      setSaving(false);
    }
  }

  /** Opens optional linked-account creation modal for a staff record. */
  function openAccountModal(member: CompassionStaffRecord) {
    setAccountModalStaff(member);
    setAccountForm({
      ...EMPTY_ACCOUNT_FORM,
      email: member.email ?? "",
    });
    setError(null);
    setSuccess(null);
  }

  /** Creates a linked platform account scoped for Compassion workflows. */
  async function createLinkedAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountModalStaff) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch(`/api/compassion/staff/${accountModalStaff.id}/create-account`, {
        method: "POST",
        body: JSON.stringify(accountForm),
      });
      setSuccess("Linked account created for staff member.");
      setAccountModalStaff(null);
      setAccountForm(EMPTY_ACCOUNT_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create linked account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800">Compassion Staff Directory</p>
        <p className="text-sm text-blue-700 mt-1">
          Manage staff names for assignment and scheduling. Optional linked accounts can be created without changing existing DonorCRM roles.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Staff</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{staff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
          <p className="text-2xl font-semibold text-blue-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Linked Accounts</p>
          <p className="text-2xl font-semibold text-emerald-700 mt-1">{linkedAccountCount}</p>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{editingId ? "Edit Staff Profile" : "Add Staff Profile"}</h2>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded px-2 py-1"
            >
              Cancel editing
            </button>
          ) : (
            <button
              type="button"
              onClick={startCreate}
              className="text-xs text-blue-700 hover:text-blue-900 border border-blue-200 rounded px-2 py-1"
            >
              Clear form
            </button>
          )}
        </div>

        <form onSubmit={submitForm} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
              <input
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
              <input
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Optional short name for calendar"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Case Manager, RN, Advocate..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Linked Existing Platform User (optional)</label>
            <select
              value={form.linkedUserId}
              onChange={(event) => setForm((current) => ({ ...current, linkedUserId: event.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">No linked user</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>{userOptionLabel(user)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.supportsScheduling}
                onChange={(event) => setForm((current) => ({ ...current, supportsScheduling: event.target.checked }))}
                className="rounded border-gray-300"
              />
              Available for scheduling
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="rounded border-gray-300"
              />
              Active staff profile
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : (editingId ? "Update Staff" : "Add Staff")}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading staff directory...</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No staff profiles yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{member.fullName}</p>
                    {member.phone && <p className="text-xs text-gray-500 mt-0.5">{member.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{member.title || "-"}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{member.email || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${member.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${member.supportsScheduling ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {member.supportsScheduling ? "Schedulable" : "No Scheduling"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {member.linkedUser ? (
                      <div>
                        <p className="text-xs font-medium text-gray-800">{member.linkedUser.firstName} {member.linkedUser.lastName}</p>
                        <p className="text-xs text-gray-500">{member.linkedUser.email}</p>
                        <p className="text-[11px] text-gray-400">{member.linkedUser.role}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No account linked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(member)}
                        className="text-xs text-blue-700 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      {!member.hasLinkedAccount && (
                        <button
                          type="button"
                          onClick={() => openAccountModal(member)}
                          className="text-xs text-emerald-700 border border-emerald-200 rounded px-2 py-1 hover:bg-emerald-50"
                        >
                          Create Account
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {accountModalStaff && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Create Linked Account</h3>
              <button
                type="button"
                onClick={() => setAccountModalStaff(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={createLinkedAccount} className="p-5 space-y-3">
              <p className="text-xs text-gray-500">
                Creating account for {accountModalStaff.fullName}. Default role is report_viewer for Compassion-only workflows.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={accountForm.email}
                  onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={accountForm.password}
                  onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={accountForm.role}
                  onChange={(event) => setAccountForm((current) => ({ ...current, role: event.target.value as AccountFormState["role"] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="report_viewer">report_viewer (recommended)</option>
                  <option value="readonly">readonly</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccountModalStaff(null)}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
