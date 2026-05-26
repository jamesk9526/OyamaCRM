"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS, DONATION_STATUSES, methodLabel } from "./donation-utils";
import { apiFetch } from "@/app/lib/auth-client";
import { usePlugins } from "@/app/components/plugins/PluginProvider";

type Props = {
  mode?: "create" | "edit";
  donationId?: string;
  defaultValues?: Partial<FormData>;
  constituents: { id: string; firstName: string; lastName: string; email?: string }[];
  campaigns:    { id: string; name: string }[];
  designations: { id: string; name: string }[];
  onCancel?: () => void;
  onSaved?: (donationId?: string) => void | Promise<void>;
};

type ConstituentOption = { id: string; firstName: string; lastName: string; email?: string };

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function buildDisplayName(option: ConstituentOption): string {
  return `${option.firstName} ${option.lastName}`.trim();
}

function rankConstituent(option: ConstituentOption, query: string): number {
  const q = normalizeText(query);
  const first = normalizeText(option.firstName);
  const last = normalizeText(option.lastName);
  const full = normalizeText(buildDisplayName(option));
  const email = normalizeText(option.email);

  if (!q) return 999;
  if (first.startsWith(q)) return 0;
  if (last.startsWith(q)) return 1;
  if (full.startsWith(q)) return 2;
  if (first.includes(q)) return 3;
  if (last.includes(q)) return 4;
  if (email.startsWith(q)) return 5;
  if (email.includes(q)) return 6;
  return 999;
}

function orderConstituentResults(results: ConstituentOption[], query: string): ConstituentOption[] {
  const q = normalizeText(query);
  if (!q) return results;

  const withRank = results.map((option) => ({ option, rank: rankConstituent(option, q) }));
  const nameMatched = withRank.filter((entry) => entry.rank <= 4);
  const otherMatched = withRank.filter((entry) => entry.rank > 4);

  const sortedByRelevance = (list: typeof withRank) =>
    list
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        const aName = buildDisplayName(a.option).toLowerCase();
        const bName = buildDisplayName(b.option).toLowerCase();
        return aName.localeCompare(bName);
      })
      .map((entry) => entry.option);

  // For very short queries, avoid noisy matches from email domains unless needed.
  if (q.length <= 2 && nameMatched.length > 0) {
    return sortedByRelevance(nameMatched);
  }

  return [...sortedByRelevance(nameMatched), ...sortedByRelevance(otherMatched)];
}

type FormData = {
  constituentId: string;
  amount: string;
  date: string;
  paymentMethod: string;
  checkNumber: string;
  campaignId: string;
  designationId: string;
  status: string;
  isRecurring: boolean;
  frequency: string;
  taxDeductible: boolean;
  notes: string;
};

function getTodayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const EMPTY: FormData = {
  constituentId: "", amount: "", date: getTodayInputValue(),
  paymentMethod: "ONLINE", checkNumber: "", campaignId: "", designationId: "",
  status: "COMPLETED", isRecurring: false, frequency: "", taxDeductible: true, notes: "",
};

export default function DonationForm({ mode = "create", donationId, defaultValues, constituents, campaigns, designations, onCancel, onSaved }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormData>({ ...EMPTY, ...defaultValues });
  const [error, setError] = useState<string | null>(null);
  const [addToQB, setAddToQB] = useState(false);
  const [constituentQuery, setConstituentQuery] = useState("");
  const [constituentResults, setConstituentResults] = useState<ConstituentOption[]>([]);
  const [constituentSearchOpen, setConstituentSearchOpen] = useState(false);
  const [constituentSearching, setConstituentSearching] = useState(false);
  const [constituentSearchError, setConstituentSearchError] = useState<string | null>(null);
  const constituentSearchRef = useRef<HTMLDivElement | null>(null);
  const searchRequestRef = useRef(0);
  const { qbEnabled } = usePlugins();

  const seedConstituentOptions = useMemo(() => {
    const selected = constituents.find((c) => c.id === form.constituentId);
    if (!selected) return constituents.slice(0, 12);
    return [selected, ...constituents.filter((c) => c.id !== selected.id)].slice(0, 12);
  }, [constituents, form.constituentId]);

  useEffect(() => {
    const selected = constituents.find((c) => c.id === form.constituentId);
    if (selected) {
      setConstituentQuery(`${selected.firstName} ${selected.lastName}`.trim());
      setConstituentResults([selected, ...constituents.filter((c) => c.id !== selected.id)].slice(0, 12));
      return;
    }
    setConstituentResults(seedConstituentOptions);
  }, [constituents, form.constituentId, seedConstituentOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!constituentSearchRef.current) return;
      if (constituentSearchRef.current.contains(event.target as Node)) return;
      setConstituentSearchOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!constituentSearchOpen) return;

    const trimmed = constituentQuery.trim();
    if (!trimmed) {
      setConstituentResults(seedConstituentOptions);
      setConstituentSearching(false);
      setConstituentSearchError(null);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setConstituentSearching(true);
    setConstituentSearchError(null);

    const timeout = window.setTimeout(async () => {
      try {
        const data = await apiFetch<ConstituentOption[] | { items?: ConstituentOption[] }>(`/api/constituents?search=${encodeURIComponent(trimmed)}&limit=25`);
        if (requestId !== searchRequestRef.current) return;
        const results = Array.isArray(data) ? data : (data.items ?? []);
        setConstituentResults(orderConstituentResults(results, trimmed));
      } catch (err) {
        if (requestId !== searchRequestRef.current) return;
        setConstituentSearchError(err instanceof Error ? err.message : "Unable to search constituents.");
      } finally {
        if (requestId === searchRequestRef.current) {
          setConstituentSearching(false);
        }
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [constituentQuery, constituentSearchOpen, seedConstituentOptions]);

  function pickConstituent(option: ConstituentOption) {
    update("constituentId", option.id);
    setConstituentQuery(`${option.firstName} ${option.lastName}`.trim());
    setConstituentSearchOpen(false);
    setConstituentSearchError(null);
    setConstituentResults([option, ...constituentResults.filter((row) => row.id !== option.id)].slice(0, 12));
  }

  function update(field: keyof FormData, value: string | boolean) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.constituentId) { setError("Please select a constituent."); return; }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError("Please enter a valid amount."); return; }
    setError(null);

    startTransition(async () => {
      const path  = mode === "edit" ? `/api/donations/${donationId}` : "/api/donations";
      const method = mode === "edit" ? "PUT" : "POST";

      try {
        const savedRes = await apiFetch(path, {
          method,
          body: JSON.stringify({
            ...form,
            campaignId:    form.campaignId    || null,
            designationId: form.designationId || null,
            checkNumber:   form.checkNumber   || null,
            frequency:     form.isRecurring ? form.frequency : null,
            notes:         form.notes || null,
          }),
        }) as { id?: string };

        // After a new donation is created, optionally add it to the QB sync queue
        if (mode === "create" && addToQB && savedRes?.id) {
          try {
            await apiFetch("/api/quickbooks/sync-queue", {
              method: "POST",
              body: JSON.stringify({ donationId: savedRes.id }),
            });
          } catch {
            // QB queue add failure is non-fatal — donation was saved successfully
          }
        }

        if (onSaved) {
          await onSaved(savedRes?.id);
        } else {
          router.push("/donations");
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save donation.");
      }
    });
  }

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500";
  const selectCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Donor */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Donor</h3>
        <div ref={constituentSearchRef} className="relative">
          <label className={labelCls}>Constituent *</label>
          <input
            type="text"
            className={inputCls}
            placeholder="Search donors by name, email, or phone..."
            value={constituentQuery}
            onFocus={() => setConstituentSearchOpen(true)}
            onChange={(e) => {
              setConstituentQuery(e.target.value);
              update("constituentId", "");
              setConstituentSearchOpen(true);
            }}
            autoComplete="off"
            required
          />

          {constituentSearchOpen ? (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {constituentSearching ? (
                <p className="px-3 py-2 text-xs text-gray-500">Searching...</p>
              ) : constituentSearchError ? (
                <p className="px-3 py-2 text-xs text-red-600">{constituentSearchError}</p>
              ) : constituentResults.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">No matching constituents.</p>
              ) : (
                constituentResults.map((option) => {
                  const selected = form.constituentId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => pickConstituent(option)}
                      className={`block w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 ${selected ? "bg-green-50" : "hover:bg-gray-50"}`}
                    >
                      <p className="text-sm font-medium text-gray-900">{option.firstName} {option.lastName}</p>
                      <p className="text-xs text-gray-500">{option.email || "No email"}</p>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Gift Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Gift Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount ($) *</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" className={inputCls}
              value={form.amount} onChange={e => update("amount", e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" className={inputCls}
              value={form.date} onChange={e => update("date", e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Payment Method</label>
            <select className={selectCls} value={form.paymentMethod} onChange={e => update("paymentMethod", e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}
            </select>
          </div>
          {form.paymentMethod === "CHECK" && (
            <div>
              <label className={labelCls}>Check Number</label>
              <input type="text" placeholder="1234" className={inputCls}
                value={form.checkNumber} onChange={e => update("checkNumber", e.target.value)} />
            </div>
          )}
          <div>
            <label className={labelCls}>Status</label>
            <select className={selectCls} value={form.status} onChange={e => update("status", e.target.value)}>
              {DONATION_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.taxDeductible} onChange={e => update("taxDeductible", e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
            Tax Deductible
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.isRecurring} onChange={e => update("isRecurring", e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
            Recurring Gift
          </label>
        </div>

        {form.isRecurring && (
          <div>
            <label className={labelCls}>Frequency</label>
            <select className={selectCls} value={form.frequency} onChange={e => update("frequency", e.target.value)}>
              <option value="">— Select —</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
            </select>
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Attribution</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Fund / Designation</label>
            <select className={selectCls} value={form.designationId} onChange={e => update("designationId", e.target.value)}>
              <option value="">— Undesignated —</option>
              {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Campaign</label>
            <select className={selectCls} value={form.campaignId} onChange={e => update("campaignId", e.target.value)}>
              <option value="">— None —</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <label className={labelCls}>Notes</label>
        <textarea rows={3} className={inputCls + " resize-none"} placeholder="Optional notes about this gift…"
          value={form.notes} onChange={e => update("notes", e.target.value)} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
          {isPending ? "Saving…" : mode === "edit" ? "Update Donation" : "Record Donation"}
        </button>
        <button type="button" onClick={() => onCancel ? onCancel() : router.back()}
          className="px-6 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        {/* QB sync checkbox — only shows on create when the QB plugin is enabled */}
        {mode === "create" && qbEnabled && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none ml-auto">
            <input
              type="checkbox"
              checked={addToQB}
              onChange={(e) => setAddToQB(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span>Add to QuickBooks Queue</span>
          </label>
        )}
      </div>
    </form>
  );
}
