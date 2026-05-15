/** Signature block management UI for reusable signer presets. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { SignatureBlock } from "@/app/components/letters/types";

/** Manages create/edit for signature presets used by letter templates. */
export default function LetterSignaturesManager() {
  const [items, setItems] = useState<SignatureBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<SignatureBlock[]>("/api/letters/signatures");
      setItems(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load signatures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Creates one signature block with the minimum required signer fields. */
  async function createSignature() {
    await apiFetch("/api/letters/signatures", {
      method: "POST",
      body: JSON.stringify({
        name,
        signerName,
        signerTitle: signerTitle || null,
        isActive: true,
      }),
    });
    setName("");
    setSignerName("");
    setSignerTitle("");
    await load();
  }

  /** Toggles one signature active state for soft enable/disable behavior. */
  async function toggleActive(item: SignatureBlock) {
    await apiFetch(`/api/letters/signatures/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    await load();
  }

  return (
    <div className="space-y-5 pt-2">
      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Add Signature Block</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Preset name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Signer name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input value={signerTitle} onChange={(event) => setSignerTitle(event.target.value)} placeholder="Signer title" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button onClick={() => void createSignature()} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">Save Signature</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Saved Signatures</h2>
          <button onClick={() => void load()} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">No signatures yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.signerName}{item.signerTitle ? ` · ${item.signerTitle}` : ""}</p>
                </div>
                <button onClick={() => void toggleActive(item)} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50">
                  {item.isActive ? "Disable" : "Enable"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
