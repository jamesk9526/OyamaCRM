/**
 * QuickGiftModal — record a donation from the constituent profile page.
 * Pre-fills the constituent and opens a streamlined donation form.
 * On save it calls POST /api/donations and returns the new donation.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import DonationFollowUpModal from "@/app/components/donations/DonationFollowUpModal";

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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * QuickGiftModal — streamlined donation entry pre-filled for a constituent.
 * Provides amount, date, payment method, campaign, fund, check number, and notes.
 */
export default function QuickGiftModal({ constituentId, constituentName, onClose, onSaved }: Props) {
  const [savedGift, setSavedGift] = useState<Donation | null>(null);
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
  const [lookups, setLookups] = useState({ campaign: { loading: true, loaded: false, error: "" }, fund: { loading: true, loaded: false, error: "" } });
  const lookupRequests = useRef({ campaign: 0, fund: 0 });
  const loadLookup = useCallback(async (kind: "campaign" | "fund") => {
    const current = ++lookupRequests.current[kind];
    setLookups(previous => ({ ...previous, [kind]: { ...previous[kind], loading: true, error: "" } }));
    try {
      const payload = await apiFetch<Campaign[] | Designation[]>(kind === "campaign" ? "/api/campaigns" : "/api/designations");
      if (lookupRequests.current[kind] !== current) return;
      if (!Array.isArray(payload)) throw new Error(`The ${kind === "campaign" ? "campaign" : "fund"} list could not be loaded.`);
      if (kind === "campaign") setCampaigns((payload as Campaign[]).filter(item => item.active));
      else setDesignations(payload);
      setLookups(previous => ({ ...previous, [kind]: { loading: false, loaded: true, error: "" } }));
    } catch (error) {
      if (lookupRequests.current[kind] !== current) return;
      setLookups(previous => ({ ...previous, [kind]: { loading: false, loaded: false, error: error instanceof Error ? error.message : `The ${kind} list could not be loaded.` } }));
    }
  }, []);
  const cancelLookups = useCallback(() => { lookupRequests.current.campaign++; lookupRequests.current.fund++; }, []);
  const lookupsReady = lookups.campaign.loaded && !lookups.campaign.loading && lookups.fund.loaded && !lookups.fund.loading;

  // Load campaigns and designations for the dropdowns
  useEffect(() => {
    void loadLookup("campaign"); void loadLookup("fund");
    return cancelLookups;
  }, [loadLookup, cancelLookups]);

  /** Validate and POST the donation to the API. */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!lookupsReady) { setError("Load the campaign and fund lists before recording this gift so its attribution can be reviewed."); return; }
    const amt = Number(amount.trim());
    if (!Number.isFinite(amt) || amt <= 0) { setError("Please enter a valid amount."); return; }
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
      setSavedGift(donation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save donation");
    } finally {
      setSaving(false);
    }
  }

  if (savedGift) return <DonationFollowUpModal donationId={savedGift.id} newlyRecorded onClose={() => onSaved(savedGift)} />;
  return (
    <WorkspaceSetupModal
      title="Record Gift"
      subtitle={`Create a donation record for ${constituentName} and keep stewardship history current.`}
      checklist={["1. Enter gift details", "2. Link campaign and fund", "3. Save donation record"]}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
    >
      <div className="px-6 py-5 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900">Gift Entry</h3>
        <p className="text-sm text-gray-500 mt-1">for {constituentName}</p>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {(lookups.campaign.loading || lookups.fund.loading) && <p role="status" className="text-sm text-slate-600">Loading gift attribution choices…</p>}
          {(["campaign", "fund"] as const).map(kind => lookups[kind].error && <div key={kind} role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>{kind === "campaign" ? "Campaigns" : "Funds"} are unavailable: {lookups[kind].error}</p><button type="button" onClick={() => { setError(null); void loadLookup(kind); }} className="mt-2 font-semibold underline">Retry {kind === "campaign" ? "campaigns" : "funds"}</button><p className="mt-1">Your gift details are retained. Recording is paused until the choices can be reviewed.</p></div>)}
          {error && (
            <div role="alert" className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {/* Amount — most important field, large */}
          <div>
            <label htmlFor="quick-gift-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
              <input
                type="number"
                id="quick-gift-amount"
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
              <label htmlFor="quick-gift-date" className="block text-sm font-medium text-gray-700 mb-1">Gift Date *</label>
              <input
                type="date"
                id="quick-gift-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label htmlFor="quick-gift-payment" className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                id="quick-gift-payment"
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
              <label htmlFor="quick-gift-check" className="block text-sm font-medium text-gray-700 mb-1">Check Number</label>
              <input
                id="quick-gift-check"
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
              <label htmlFor="quick-gift-campaign" className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
              <select
                id="quick-gift-campaign"
                disabled={!lookups.campaign.loaded || lookups.campaign.loading || saving}
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">{lookups.campaign.loading ? "Loading campaigns…" : !lookups.campaign.loaded ? "Campaigns unavailable" : "— None —"}</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="quick-gift-fund" className="block text-sm font-medium text-gray-700 mb-1">Fund</label>
              <select
                id="quick-gift-fund"
                disabled={!lookups.fund.loaded || lookups.fund.loading || saving}
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">{lookups.fund.loading ? "Loading funds…" : !lookups.fund.loaded ? "Funds unavailable" : "— General Fund —"}</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="quick-gift-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              id="quick-gift-notes"
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
              disabled={saving || !lookupsReady}
              className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Record Gift"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSetupModal>
  );
}
