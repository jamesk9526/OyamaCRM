// Encrypted credential-vault panel for OyamaWatchdog.
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { WatchdogVaultItem } from "@/app/components/watchdog/types";

interface Props {
  items: WatchdogVaultItem[];
  onRefresh: () => Promise<void>;
}

/** WatchdogVaultPanel provides starter vault creation and secret reveal workflows. */
export default function WatchdogVaultPanel({ items, onRefresh }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});

  /** Creates one encrypted vault entry via Watchdog API. */
  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/watchdog/vault", {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
          username,
          website,
          password,
          notes,
        }),
      });
      setName("");
      setCategory("general");
      setUsername("");
      setWebsite("");
      setPassword("");
      setNotes("");
      await onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create vault entry.");
    } finally {
      setSaving(false);
    }
  }

  /** Reveals one secret if permission allows watchdog:vault:read_secret. */
  async function revealSecret(itemId: string) {
    setError(null);
    try {
      const response = await apiFetch<{ item: WatchdogVaultItem }>(`/api/watchdog/vault/${itemId}?reveal=true`);
      setRevealedSecrets((prev) => ({ ...prev, [itemId]: response.item.password ?? "(empty)" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reveal secret.");
    }
  }

  return (
    <section id="vault" className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Encrypted Password Vault</h2>
        <p className="text-xs text-slate-400">Stored in Watchdog secondary DB with AES-256-GCM encrypted secret payloads.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={createEntry} className="grid md:grid-cols-2 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Entry name (required)"
          className="px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-800 text-slate-100"
          required
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-800 text-slate-100"
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-800 text-slate-100"
        />
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="Website / URL"
          className="px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-800 text-slate-100"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (required)"
          className="px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-800 text-slate-100 md:col-span-2"
          required
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          className="px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-800 text-slate-100 md:col-span-2 min-h-20"
        />
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Encrypted Entry"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-700">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Username</th>
              <th className="py-2 pr-3">Website</th>
              <th className="py-2 pr-3">Updated</th>
              <th className="py-2">Secret</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className="py-4 text-slate-500" colSpan={6}>No vault entries yet.</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-800/80">
                <td className="py-2 pr-3 text-slate-200">{item.name}</td>
                <td className="py-2 pr-3 text-slate-300">{item.category}</td>
                <td className="py-2 pr-3 text-slate-300">{item.username ?? "-"}</td>
                <td className="py-2 pr-3 text-slate-300">{item.website ?? "-"}</td>
                <td className="py-2 pr-3 text-slate-400">{new Date(item.updatedAt).toLocaleString()}</td>
                <td className="py-2">
                  {revealedSecrets[item.id] ? (
                    <span className="font-mono text-xs text-emerald-300">{revealedSecrets[item.id]}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void revealSecret(item.id)}
                      className="px-2 py-1 text-xs rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
                    >
                      Reveal
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
