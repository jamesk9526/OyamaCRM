// Password manager and secret vault workspace for Watchdog.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  copyWatchdogVaultSecret,
  createWatchdogVaultItem,
  fetchWatchdogVaultAccessEvents,
  fetchWatchdogVaultItems,
  revealWatchdogVaultSecret,
  updateWatchdogVaultItem,
} from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogVaultAccessEvent, WatchdogVaultItem } from "@/app/components/watchdog/ops/types";

/** Renders encrypted vault records, audited reveal/copy actions, and secret metadata controls. */
export default function WatchdogVaultPage() {
  const [items, setItems] = useState<WatchdogVaultItem[]>([]);
  const [accessEvents, setAccessEvents] = useState<WatchdogVaultAccessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Database");
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [revealedById, setRevealedById] = useState<Record<string, string>>({});

  const sortedEvents = useMemo(() => {
    return [...accessEvents].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [accessEvents]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vaultItems, historyItems] = await Promise.all([
        fetchWatchdogVaultItems(),
        fetchWatchdogVaultAccessEvents(),
      ]);
      setItems(vaultItems);
      setAccessEvents(historyItems);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load Watchdog vault workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function handleCreateSecret() {
    setBusyAction("create");
    setError(null);
    setMessage(null);
    try {
      await createWatchdogVaultItem({
        name: name.trim(),
        category: category.trim(),
        username: username.trim() || undefined,
        website: website.trim() || undefined,
        password,
        notes: notes.trim() || undefined,
        metadata: {
          needsRotation: false,
          owner: "operations",
          status: "active",
        },
      });
      setName("");
      setCategory("Database");
      setUsername("");
      setWebsite("");
      setPassword("");
      setNotes("");
      setMessage("Vault secret created.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create vault secret.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReveal(item: WatchdogVaultItem) {
    const reason = (reasonById[item.id] ?? "").trim() || "Operational troubleshooting";
    setBusyAction(`reveal:${item.id}`);
    setError(null);
    setMessage(null);
    try {
      const revealed = await revealWatchdogVaultSecret(item.id, reason);
      setRevealedById((previous) => ({
        ...previous,
        [item.id]: revealed.password ?? "",
      }));
      setMessage(`Secret revealed for ${item.name}. Access was audited.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to reveal secret.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopy(item: WatchdogVaultItem) {
    const reason = (reasonById[item.id] ?? "").trim() || "Incident response";
    setBusyAction(`copy:${item.id}`);
    setError(null);
    setMessage(null);
    try {
      const copied = await copyWatchdogVaultSecret(item.id, reason);
      if (copied.password) {
        await navigator.clipboard.writeText(copied.password);
      }
      setMessage(`Secret copied for ${item.name}. Copy action was audited.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to copy secret.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMarkNeedsRotation(item: WatchdogVaultItem) {
    setBusyAction(`rotate-flag:${item.id}`);
    setError(null);
    setMessage(null);
    try {
      await updateWatchdogVaultItem({
        id: item.id,
        patch: {
          metadata: {
            needsRotation: true,
            status: "needs_rotation",
            updatedAt: new Date().toISOString(),
          },
        },
      });
      setMessage(`${item.name} marked as needs rotation.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update vault metadata.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRotateSecret(item: WatchdogVaultItem) {
    const nextPassword = window.prompt(`Enter new secret value for ${item.name}`) ?? "";
    if (!nextPassword.trim()) return;

    setBusyAction(`rotate:${item.id}`);
    setError(null);
    setMessage(null);
    try {
      await updateWatchdogVaultItem({
        id: item.id,
        patch: {
          password: nextPassword,
          metadata: {
            needsRotation: false,
            status: "active",
            rotatedAt: new Date().toISOString(),
          },
        },
      });
      setMessage(`${item.name} secret rotated and audited.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to rotate secret.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="Password Vault"
        description="Encrypted secret management with audited reveal/copy/rotate operations and access history."
        actions={(
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        )}
      />

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading vault workspace...</div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Add Secret</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700">
                Secret Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {[
                    "Database",
                    "Email/SMTP",
                    "AI Provider",
                    "Payment Provider",
                    "Hosting",
                    "DNS",
                    "Storage",
                    "OAuth/API",
                    "Backup Encryption",
                    "Internal Service",
                    "Other",
                  ].map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Website/Service
                <input
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700 md:col-span-2">
                Secret Value
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateSecret()}
              disabled={busyAction !== null || !name.trim() || !password.trim()}
              className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add Secret
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Vault Records</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Secret</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Reason</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={4}>No secrets yet.</td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-3 text-slate-900">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.username ?? "no username"}</p>
                          <p className="mt-1 text-xs text-slate-600">Masked by default</p>
                          {revealedById[item.id] ? (
                            <p className="mt-1 rounded bg-emerald-50 px-2 py-1 font-mono text-xs text-emerald-700">{revealedById[item.id]}</p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="space-y-1">
                            <p className="text-slate-700">{item.category}</p>
                            <StatusChip status="Working" />
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={reasonById[item.id] ?? ""}
                            onChange={(event) => setReasonById((prev) => ({ ...prev, [item.id]: event.target.value }))}
                            placeholder="Reason for reveal/copy"
                            className="w-52 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                          />
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleReveal(item)}
                              disabled={busyAction !== null}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reveal
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopy(item)}
                              disabled={busyAction !== null}
                              className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleMarkNeedsRotation(item)}
                              disabled={busyAction !== null}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Needs Rotation
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRotateSecret(item)}
                              disabled={busyAction !== null}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Rotate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Secret Access History</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Secret</th>
                    <th className="py-2 pr-3">Access</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={5}>No access events yet.</td>
                    </tr>
                  ) : (
                    sortedEvents.slice(0, 40).map((event) => (
                      <tr key={event.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-700">{new Date(event.createdAt).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-slate-700">{event.vaultEntryId}</td>
                        <td className="py-2 pr-3 text-slate-900">{event.accessType}</td>
                        <td className="py-2 pr-3 text-slate-700">{event.accessedBy}</td>
                        <td className="py-2 text-slate-700">{event.reason ?? "No reason provided"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
