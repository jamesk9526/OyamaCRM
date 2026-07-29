"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { ConstituentRow, formatCurrency, getConstituentDisplayName } from "./constituent-utils";

type Props = {
  constituents: ConstituentRow[];
  onClose: () => void;
  onMerged: (keepId: string) => void;
};

export default function ConstituentMergeModal({ constituents, onClose, onMerged }: Props) {
  const [keepId, setKeepId] = useState(constituents[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keep = useMemo(() => constituents.find((item) => item.id === keepId), [constituents, keepId]);
  const duplicates = constituents.filter((item) => item.id !== keepId);

  async function submit() {
    if (!keepId || duplicates.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/constituents/merge", {
        method: "POST",
        body: JSON.stringify({ keepId, mergeIds: duplicates.map((item) => item.id) }),
      });
      onMerged(keepId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The constituents could not be merged.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="merge-constituents-title">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0f6cbd]">Data quality</p>
          <h2 id="merge-constituents-title" className="mt-1 text-xl font-semibold text-slate-950">Merge duplicate constituents</h2>
          <p className="mt-2 text-sm text-slate-600">Choose the profile to keep. Gifts, tasks, notes, tags, communication history, and event records from the other selected profiles will move into it.</p>
        </div>
        <div className="space-y-3 px-6 py-5">
          {constituents.map((item) => {
            const isKeep = item.id === keepId;
            return (
              <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${isKeep ? "border-[#0f6cbd] bg-[#eff6fc]" : "border-slate-200 hover:border-slate-300"}`}>
                <input type="radio" name="keep-constituent" checked={isKeep} onChange={() => setKeepId(item.id)} className="mt-1 h-4 w-4 accent-[#0f6cbd]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-semibold text-slate-900">{getConstituentDisplayName(item)}</span>{isKeep ? <span className="rounded-full bg-[#0f6cbd] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Keep this profile</span> : null}</span>
                  <span className="mt-1 block text-xs text-slate-600">{item.email || "No email"} · {item.giftCount ?? 0} gifts · {formatCurrency(item.totalLifetimeGiving ?? 0)}</span>
                </span>
              </label>
            );
          })}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The original profiles are recoverable from the resulting profile using <strong>Undo merge</strong>. Review the selected records carefully before continuing.
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-[3px] border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || !keep} className="rounded-[3px] bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Merging…" : `Merge ${duplicates.length} into ${keep ? getConstituentDisplayName(keep) : "profile"}`}</button>
        </div>
      </div>
    </div>
  );
}
