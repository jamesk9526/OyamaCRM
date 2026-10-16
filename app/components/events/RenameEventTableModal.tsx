"use client";

import { useId, useState, type FormEvent } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

export default function RenameEventTableModal({ table, onClose, onSaved }: {
  table: { id: string; name: string };
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const nameId = useId();
  const [name, setName] = useState(table.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120) { setError("Enter a table name of 1–120 characters."); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<{ name: string }>(`/api/events/tables/${table.id}`, { method: "PATCH", body: JSON.stringify({ name: trimmed }) });
      onSaved(updated.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The table could not be renamed.");
    } finally { setSaving(false); }
  }
  return (
    <WorkspaceSetupModal title="Rename Table" subtitle={table.name} onClose={onClose} maxWidthClassName="max-w-lg">
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label htmlFor={nameId} className="mb-1 block text-sm font-semibold">Table name</label>
          <input id={nameId} data-modal-autofocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving || name.trim() === table.name} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Name"}</button>
        </div>
      </form>
    </WorkspaceSetupModal>
  );
}
