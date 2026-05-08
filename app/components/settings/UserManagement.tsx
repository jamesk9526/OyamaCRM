/**
 * UserManagement component — full CRUD UI for managing staff user accounts.
 * Admin-only: list, add, edit (role/active), and reset passwords.
 * Calls GET/POST/PUT/PATCH /api/users via apiFetch.
 */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";

/** Shape of a user record returned by the API (omits passwordHash). */
interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Available roles and their display labels */
const ROLES: { value: string; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "readonly", label: "Read Only" },
];

/** Role badge colors: admin = green, staff = blue, readonly = gray */
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-green-100 text-green-800",
    staff: "bg-blue-100 text-blue-800",
    readonly: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[role] ?? "bg-gray-100 text-gray-700"}`}>
      {role}
    </span>
  );
}

/** Format a nullable ISO date string into a relative or absolute display. */
function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).format(new Date(iso));
}

// ─── Add User Modal ────────────────────────────────────────────────────────

interface AddUserModalProps {
  onClose: () => void;
  onSaved: () => void;
}

/** Modal form to create a new staff user account. */
function AddUserModal({ onClose, onSaved }: AddUserModalProps) {
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: "staff", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h2>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* First name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {/* Last name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {/* Temporary password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="mt-1 text-xs text-gray-500">User will be required to change this on first login.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit User Modal ───────────────────────────────────────────────────────

interface EditUserModalProps {
  user: UserRecord;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Modal form to update a user's role or active status. */
function EditUserModal({ user, isSelf, onClose, onSaved }: EditUserModalProps) {
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, role: user.role, active: user.active });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Edit User</h2>
        <p className="text-sm text-gray-500 mb-4">{user.email}</p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          {/* Role — disabled for self to prevent self-demotion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              disabled={isSelf}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {isSelf && <p className="mt-1 text-xs text-gray-400">You cannot change your own role.</p>}
          </div>
          {/* Active toggle — disabled for self */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <p className="text-sm font-medium text-gray-700">Account Active</p>
              <p className="text-xs text-gray-500">Inactive users cannot log in.</p>
            </div>
            <button
              type="button"
              disabled={isSelf}
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.active ? "bg-green-600" : "bg-gray-300"} disabled:opacity-50`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          {isSelf && <p className="text-xs text-amber-600">⚠ You cannot deactivate your own account.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Password Reset Modal ──────────────────────────────────────────────────

interface ResetPasswordModalProps {
  user: UserRecord;
  onClose: () => void;
  onSaved: () => void;
}

/** Modal form to set a new password for a user (admin reset flow). */
function ResetPasswordModal({ user, onClose, onSaved }: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/users/${user.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset Password</h2>
        <p className="text-sm text-gray-500 mb-4">{user.firstName} {user.lastName} — {user.email}</p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
          This will immediately invalidate the user&apos;s existing sessions.
        </p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main UserManagement Component ────────────────────────────────────────

/**
 * UserManagement renders the full admin user management interface.
 * Displays user list with role/status badges, and provides modals for
 * adding users, editing roles/status, and resetting passwords.
 *
 * Must be used within a page where the current user has the "admin" role.
 */
export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Which modal is open, and which user it targets (null = new user for addModal). */
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRecord | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);

  /** Success banner after an action completes. */
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /** Load all users from the API. */
  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: UserRecord[]; total: number }>("/api/users");
      setUsers(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount
  useEffect(() => {
    loadUsers();
  }, []);

  /** Show a temporary success banner then reload the list. */
  function handleSaved(msg: string) {
    setAddOpen(false);
    setEditTarget(null);
    setResetTarget(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
    loadUsers();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage access, roles, and passwords for your organization.</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 font-medium"
        >
          + Add User
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded">
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">No users found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((u) => {
                const isSelf = me?.id === u.id;
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {u.firstName} {u.lastName}
                      {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {/* Edit user */}
                      <button
                        onClick={() => setEditTarget(u)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      {/* Reset password */}
                      <button
                        onClick={() => setResetTarget(u)}
                        className="text-xs text-amber-600 hover:underline"
                      >
                        Reset PW
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {addOpen && (
        <AddUserModal
          onClose={() => setAddOpen(false)}
          onSaved={() => handleSaved("User created successfully.")}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          isSelf={me?.id === editTarget.id}
          onClose={() => setEditTarget(null)}
          onSaved={() => handleSaved("User updated successfully.")}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSaved={() => handleSaved("Password reset successfully. The user will need to log in again.")}
        />
      )}
    </div>
  );
}
