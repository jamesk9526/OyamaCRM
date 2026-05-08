"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS, DONATION_STATUSES, methodLabel } from "./donation-utils";
import { apiFetch } from "@/app/lib/auth-client";

type Props = {
  mode?: "create" | "edit";
  donationId?: string;
  defaultValues?: Partial<FormData>;
  constituents: { id: string; firstName: string; lastName: string }[];
  campaigns:    { id: string; name: string }[];
  designations: { id: string; name: string }[];
};

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

const EMPTY: FormData = {
  constituentId: "", amount: "", date: new Date().toISOString().split("T")[0],
  paymentMethod: "ONLINE", checkNumber: "", campaignId: "", designationId: "",
  status: "COMPLETED", isRecurring: false, frequency: "", taxDeductible: true, notes: "",
};

export default function DonationForm({ mode = "create", donationId, defaultValues, constituents, campaigns, designations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormData>({ ...EMPTY, ...defaultValues });
  const [error, setError] = useState<string | null>(null);

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
        await apiFetch(path, {
          method,
          body: JSON.stringify({
            ...form,
            campaignId:    form.campaignId    || null,
            designationId: form.designationId || null,
            checkNumber:   form.checkNumber   || null,
            frequency:     form.isRecurring ? form.frequency : null,
            notes:         form.notes || null,
          }),
        });
        router.push("/donations");
        router.refresh();
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
        <div>
          <label className={labelCls}>Constituent *</label>
          <select className={selectCls} value={form.constituentId} onChange={e => update("constituentId", e.target.value)} required>
            <option value="">— Select Constituent —</option>
            {constituents.map(c => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
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
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
