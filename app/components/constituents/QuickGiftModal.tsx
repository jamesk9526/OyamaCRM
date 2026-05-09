/**
 * QuickGiftModal — record a donation from the constituent profile page.
 * Pre-fills the constituent and opens a streamlined donation form.
 * On save it calls POST /api/donations and returns the new donation.
 */
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface Campaign {
  id: string;
  name: string;
  active: boolean;
}

interface Designation {
  id: string;
  name: string;
}

interface Donation {
  id: string;
  amount: number | string;
  date: string;
  paymentMethod: string;
  status: string;
  campaign?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
}

interface Props {
  /** The constituent receiving this donation. */
  constituentId: string;
  constituentName: string;
  onClose: () => void;
  /** Called with the newly created donation after a successful save. */
  onSaved: (donation: Donation) => void;
}

const PAYMENT_METHODS = [
  { value: "CHECK",       label: "Check" },
  { value: "CASH",        label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "ACH",         label: "ACH / Bank Transfer" },
  { value: "ONLINE",      label: "Online" },
  { value: "STOCK",       label: "Stock" },
  { value: "IN_KIND",     label: "In-Kind" },
  { value: "OTHER",       label: "Other" },
];

/** Format today as YYYY-MM-DD for the date input default. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * QuickGiftModal — streamlined donation entry pre-filled for a constituent.
 * Provides amount, date, payment method, campaign, fund, check number, and notes.
 */
export default function QuickGiftModal({ constituentId, constituentName, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("CHECK");
  const [checkNumber, setCheckNumber] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [notes, setNotes] = useState("");
  const [taxDeductible, setTaxDeductible] = useState(true);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load campaigns and designations for the dropdowns
  useEffect(() => {
    Promise.all([
      apiFetch<Campaign[]>("/api/campaigns").catch(() => []),
      apiFetch<Designation[]>("/api/designations").catch(() => []),
    ]).then(([c, d]) => {
      setCampaigns(Array.isArray(c) ? c.filter((x) => x.active) : []);
      setDesignations(Array.isArray(d) ? d : []);
    });
  }, []);

  /** Validate and POST the donation to the API. */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Please enter a valid amount."); return; }
    if (!date) { setError("Please enter a gift date."); return; }

    setSaving(true);
    setError(null);
    try {
      const donation = await apiFetch<Donation>("/api/donations", {
        method: "POST",
        body: JSON.stringify({
          constituentId,
          amount: amt,
          date,
          paymentMethod,
          checkNumber: paymentMethod === "CHECK" && checkNumber ? checkNumber : undefined,
          campaignId:    campaignId    || undefined,
          designationId: designationId || undefined,
          taxDeductible,
          notes: notes.trim() || undefined,
          status: "COMPLETED",
        }),
      });
      onSaved(donation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save donation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-green-50">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Record Gift</h2>
            <p className="text-xs text-green-700 mt-0.5">for {constituentName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {/* Amount — most important field, large */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
          </div>

          {/* Date + Payment method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gift Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Check number — only shown for CHECK payments */}
          {paymentMethod === "CHECK" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check Number</label>
              <input
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="e.g. 1042"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Campaign + Fund */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— None —</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fund</label>
              <select
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— General Fund —</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this gift…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Tax deductible toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={taxDeductible}
              onChange={(e) => setTaxDeductible(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Tax-deductible gift
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Record Gift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
