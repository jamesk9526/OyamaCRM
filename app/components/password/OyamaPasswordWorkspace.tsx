// OyamaPASSWORD workspace page for encrypted credential storage and sharing.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface PasswordEntry {
  id: string;
  title: string;
  username: string | null;
  website: string | null;
  ownerUserId: string;
  canEdit: boolean;
  sharedByYou: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  password?: string;
  notes?: string;
}

interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface ShareItem {
  sharedWithUserId: string;
  canEdit: boolean;
  createdBy: string;
  createdAt: string;
}

/** Renders OyamaPASSWORD encrypted vault management for all authenticated users. */
export default function OyamaPasswordWorkspace() {
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState("");
  const [revealedNotes, setRevealedNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [shareUserId, setShareUserId] = useState("");
  const [shareCanEdit, setShareCanEdit] = useState(false);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesPayload, usersPayload] = await Promise.all([
        apiFetch<{ items: PasswordEntry[] }>("/api/oyama-password/entries"),
        apiFetch<{ items: OrgUser[] }>("/api/oyama-password/users"),
      ]);

      setEntries(entriesPayload.items ?? []);
      setUsers(usersPayload.items ?? []);

      if (!selectedEntryId && entriesPayload.items?.length) {
        setSelectedEntryId(entriesPayload.items[0].id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load OyamaPASSWORD workspace.");
    } finally {
      setLoading(false);
    }
  }, [selectedEntryId]);

  const loadShares = useCallback(async (entryId: string) => {
    try {
      const payload = await apiFetch<{ items: ShareItem[] }>(`/api/oyama-password/entries/${entryId}/shares`);
      setShares(payload.items ?? []);
    } catch {
      setShares([]);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedEntryId) {
      setShares([]);
      return;
    }
    void loadShares(selectedEntryId);
  }, [selectedEntryId, loadShares]);

  async function handleCreateEntry() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!newTitle.trim() || !newPassword.trim()) {
        throw new Error("Title and password are required.");
      }

      await apiFetch("/api/oyama-password/entries", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          username: newUsername,
          website: newWebsite,
          password: newPassword,
          notes: newNotes,
        }),
      });

      setNewTitle("");
      setNewUsername("");
      setNewWebsite("");
      setNewPassword("");
      setNewNotes("");
      setMessage("Credential saved in encrypted vault.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create password entry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevealSecret() {
    if (!selectedEntryId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiFetch<{ item: PasswordEntry }>(`/api/oyama-password/entries/${selectedEntryId}/reveal`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setRevealedPassword(payload.item.password ?? "");
      setRevealedNotes(payload.item.notes ?? "");
      setMessage("Password revealed. Copy responsibly.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to reveal password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShareEntry() {
    if (!selectedEntryId || !shareUserId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/oyama-password/entries/${selectedEntryId}/shares`, {
        method: "POST",
        body: JSON.stringify({
          sharedWithUserId: shareUserId,
          canEdit: shareCanEdit,
        }),
      });
      setShareUserId("");
      setShareCanEdit(false);
      setMessage("Entry share updated.");
      await loadShares(selectedEntryId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to share entry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntry() {
    if (!selectedEntryId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/oyama-password/entries/${selectedEntryId}`, { method: "DELETE" });
      setSelectedEntryId(null);
      setRevealedPassword("");
      setRevealedNotes("");
      setShares([]);
      setMessage("Entry deleted.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.2em] text-sky-700">OyamaPASSWORD</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Encrypted Password Workspace</h1>
        <p className="mt-1 text-sm text-slate-700">
          Credentials are encrypted with AES-256-GCM and stored in a separate external database dedicated to OyamaPASSWORD.
        </p>
      </header>

      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1.05fr_1.4fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">New Credential</h2>
          <div className="mt-3 space-y-2">
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Title" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="Username" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={newWebsite} onChange={(event) => setNewWebsite(event.target.value)} placeholder="Website" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Password" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="Notes" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void handleCreateEntry()} disabled={busy} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60">
              {busy ? "Saving..." : "Save Encrypted Credential"}
            </button>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">My Password Vault</h2>
          {loading ? <p className="mt-3 text-sm text-slate-600">Loading entries...</p> : null}
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.1fr]">
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setSelectedEntryId(entry.id);
                    setRevealedPassword("");
                    setRevealedNotes("");
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${selectedEntryId === entry.id ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}
                >
                  <p className="text-sm font-medium text-slate-900">{entry.title}</p>
                  <p className="text-xs text-slate-600">{entry.username || "No username"}{entry.website ? ` • ${entry.website}` : ""}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{entry.canEdit ? "Editable" : "Read only"}</p>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              {!selectedEntry ? (
                <p className="text-sm text-slate-600">Select an entry to reveal or share.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedEntry.title}</p>
                    <p className="text-xs text-slate-600">Last updated {new Date(selectedEntry.updatedAt).toLocaleString()}</p>
                  </div>

                  <button type="button" onClick={() => void handleRevealSecret()} disabled={busy} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60">
                    Reveal Password
                  </button>

                  {revealedPassword ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-900">Password</p>
                      <p className="mt-1 break-all font-mono text-xs text-amber-900">{revealedPassword}</p>
                      {revealedNotes ? <p className="mt-2 text-xs text-amber-800">Notes: {revealedNotes}</p> : null}
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-slate-200 bg-white p-2">
                    <p className="text-xs font-semibold text-slate-800">Share access</p>
                    <div className="mt-2 space-y-2">
                      <select value={shareUserId} onChange={(event) => setShareUserId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm">
                        <option value="">Select user</option>
                        {users.filter((user) => user.id !== selectedEntry.ownerUserId).map((user) => (
                          <option key={user.id} value={user.id}>{user.firstName} {user.lastName} ({user.email})</option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                        <input type="checkbox" checked={shareCanEdit} onChange={(event) => setShareCanEdit(event.target.checked)} className="rounded border-slate-300" />
                        Allow edit access
                      </label>
                      <button type="button" onClick={() => void handleShareEntry()} disabled={busy || !shareUserId || !selectedEntry.canEdit} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                        Save Share
                      </button>
                    </div>

                    <ul className="mt-2 space-y-1">
                      {shares.map((share) => {
                        const user = users.find((item) => item.id === share.sharedWithUserId);
                        return (
                          <li key={`${share.sharedWithUserId}-${share.createdAt}`} className="text-[11px] text-slate-600">
                            {user ? `${user.firstName} ${user.lastName}` : share.sharedWithUserId} • {share.canEdit ? "edit" : "view"}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <button type="button" onClick={() => void handleDeleteEntry()} disabled={busy || !selectedEntry.sharedByYou} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    Delete Entry (Owner only)
                  </button>
                </div>
              )}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
