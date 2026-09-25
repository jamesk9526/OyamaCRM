"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Gift, Info, ReceiptText, Repeat2 } from "lucide-react";
import { PAYMENT_METHODS, DONATION_STATUSES, formatCurrency, formatDonationDate, methodLabel } from "./donation-utils";
import { apiFetch } from "@/app/lib/auth-client";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import { getConstituentDisplayName } from "@/app/components/constituents/constituent-utils";

type Props = {
  mode?: "create" | "edit";
  donationId?: string;
  receiptNumber?: string | null;
  receiptSentAt?: string | null;
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
  return getConstituentDisplayName(option);
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
  taxDeductibleAmount: string;
  taxDeductibleNotes: string;
  taxReceiptRequested: boolean;
  notes: string;
  eventId: string;
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
  status: "COMPLETED", isRecurring: false, frequency: "", taxDeductible: true,
  taxDeductibleAmount: "", taxDeductibleNotes: "", taxReceiptRequested: false,
  notes: "", eventId: "",
};

export default function DonationForm({ mode = "create", donationId, receiptNumber, receiptSentAt, defaultValues, constituents, campaigns, designations, onCancel, onSaved }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(() => {
    const initial = { ...EMPTY, ...defaultValues };
    return {
      ...initial,
      taxDeductibleAmount: initial.taxDeductible
        ? initial.taxDeductibleAmount || initial.amount
        : "0",
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
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
      setConstituentQuery(buildDisplayName(selected));
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
    setConstituentQuery(buildDisplayName(option));
    setConstituentSearchOpen(false);
    setConstituentSearchError(null);
    setConstituentResults([option, ...constituentResults.filter((row) => row.id !== option.id)].slice(0, 12));
  }

  function update(field: keyof FormData, value: string | boolean) {
    setHasUnsavedChanges(true);
    setForm(p => ({ ...p, [field]: value }));
  }

  function updateAmount(value: string) {
    setHasUnsavedChanges(true);
    setForm((previous) => ({
      ...previous,
      amount: value,
      taxDeductibleAmount: previous.taxDeductible
        && (!previous.taxDeductibleAmount || previous.taxDeductibleAmount === previous.amount)
        ? value
        : previous.taxDeductibleAmount,
    }));
  }

  function toggleTaxDeductible(checked: boolean) {
    setHasUnsavedChanges(true);
    setForm((previous) => ({
      ...previous,
      taxDeductible: checked,
      taxDeductibleAmount: checked
        ? previous.taxDeductibleAmount === "0" ? previous.amount : previous.taxDeductibleAmount || previous.amount
        : "0",
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.constituentId) { setError("Please select a constituent."); return; }
    const giftAmount = Number(form.amount);
    const deductibleAmount = Number(form.taxDeductibleAmount || form.amount);
    if (!form.amount || !Number.isFinite(giftAmount) || giftAmount < 0 || Math.abs(giftAmount * 100 - Math.round(giftAmount * 100)) > 0.000001) { setError("Enter a valid gift amount with at most two decimal places."); return; }
    if (form.taxDeductible && (!Number.isFinite(deductibleAmount) || deductibleAmount < 0 || deductibleAmount > giftAmount || Math.abs(deductibleAmount * 100 - Math.round(deductibleAmount * 100)) > 0.000001)) {
      setError("Enter a tax-deductible amount between zero and the gift amount, with at most two decimal places.");
      return;
    }
    if (form.isRecurring && !form.frequency) { setError("Choose a frequency for this recurring gift."); return; }
    setError(null);
    setSaving(true);

    void (async () => {
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
            taxDeductibleAmount: form.taxDeductible ? form.taxDeductibleAmount || form.amount : "0",
            taxDeductibleNotes: form.taxDeductibleNotes || null,
            notes:         form.notes || null,
          }),
        }) as { id?: string };

        if (onSaved) {
          await onSaved(savedRes?.id);
        } else {
          router.push(mode === "edit" && donationId ? `/donations/${encodeURIComponent(donationId)}` : "/donations");
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save donation.");
      } finally {
        setSaving(false);
      }
    })();
  }

  const inputCls = "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] placeholder:text-[#a19f9d] focus:border-[#0078d4] focus:outline-none focus:ring-1 focus:ring-[#0078d4]";
  const selectCls = "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] focus:border-[#0078d4] focus:outline-none focus:ring-1 focus:ring-[#0078d4]";
  const labelCls = "mb-1 block text-sm font-semibold text-[#323130]";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="border border-[#a4262c] bg-[#fdf3f4] px-4 py-3 text-sm text-[#a4262c]">{error}</div>
      )}

      {/* Donor */}
      <div className="space-y-4 border border-[#edebe9] bg-white p-5">
        <h3 className="text-base font-semibold text-[#323130]">Donor</h3>
        <div ref={constituentSearchRef} className="relative">
          <label htmlFor="gift-constituent" className={labelCls}>Constituent *</label>
          <input
            id="gift-constituent"
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
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-[#8a8886] bg-white shadow-[0_4px_14px_rgba(0,0,0,0.16)]">
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
                      className={`block w-full border-b border-[#edebe9] px-3 py-2 text-left last:border-b-0 ${selected ? "bg-[#deecf9]" : "hover:bg-[#f3f2f1]"}`}
                    >
                        <p className="text-sm font-medium text-gray-900">{buildDisplayName(option)}</p>
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
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="gift-details-heading">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Gift className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 id="gift-details-heading" className="text-lg font-semibold text-slate-950">Gift details</h3>
            <p className="mt-0.5 text-sm text-slate-600">Enter the amount, payment information, and tax-receipt preferences.</p>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gift-amount" className={labelCls}>Amount ($) *</label>
              <input id="gift-amount" type="number" min="0" step="0.01" placeholder="0.00" className={inputCls}
                value={form.amount} onChange={e => updateAmount(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="gift-date" className={labelCls}>Date *</label>
              <input id="gift-date" type="date" className={inputCls}
                value={form.date} onChange={e => update("date", e.target.value)} required />
            </div>
            <div>
              <label htmlFor="gift-payment-method" className={labelCls}>Payment method</label>
              <select id="gift-payment-method" className={selectCls} value={form.paymentMethod} onChange={e => update("paymentMethod", e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}
              </select>
            </div>
            {form.paymentMethod === "CHECK" && (
              <div>
                <label htmlFor="gift-check-number" className={labelCls}>Check number</label>
                <input id="gift-check-number" type="text" placeholder="1234" className={inputCls}
                  value={form.checkNumber} onChange={e => update("checkNumber", e.target.value)} />
              </div>
            )}
            <div>
              <label htmlFor="gift-status" className={labelCls}>Status</label>
              <select id="gift-status" className={selectCls} value={form.status} onChange={e => update("status", e.target.value)}>
                {DONATION_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.taxDeductible}
                  onChange={(event) => toggleTaxDeductible(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-400 text-blue-700 focus:ring-blue-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-950">Tax deductible</span>
                  <span className="mt-0.5 block text-xs text-slate-600">Track the portion of this gift eligible for the donor&apos;s tax receipt.</span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-expanded={showReceiptPreview}
                  aria-controls="gift-receipt-preview"
                  onClick={() => setShowReceiptPreview((open) => !open)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  <ReceiptText className="size-4" aria-hidden="true" />
                  {showReceiptPreview ? "Hide receipt data" : "Preview receipt data"}
                </button>
                {mode === "edit" && donationId && !hasUnsavedChanges ? (
                  <Link
                    href={`/oyama-letters/generate?mode=single&constituentId=${encodeURIComponent(form.constituentId)}&donationId=${encodeURIComponent(donationId)}`}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  >
                    Prepare receipt
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : mode === "edit" && hasUnsavedChanges ? (
                  <span className="text-xs font-medium text-blue-800">Save changes to prepare a receipt with these details.</span>
                ) : null}
              </div>
            </div>

            {showReceiptPreview ? (
              <div id="gift-receipt-preview" className="mt-4 rounded-lg border border-blue-200 bg-white p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">Receipt data preview</p>
                <p className="mt-1 text-xs text-slate-600">The final receipt uses your selected template and is reviewed in OyamaLetters.</p>
                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-500">Donor</dt><dd className="font-medium">{constituentQuery || "Select a donor"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Gift date</dt><dd className="font-medium">{formatDonationDate(form.date)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Gift amount</dt><dd className="font-medium">{formatCurrency(form.amount)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Tax-deductible amount</dt><dd className="font-medium">{formatCurrency(form.taxDeductible ? form.taxDeductibleAmount || form.amount : 0)}</dd></div>
                </dl>
              </div>
            ) : null}

            {form.taxDeductible ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(190px,0.7fr)_minmax(0,1.25fr)]">
                <div>
                  <label htmlFor="gift-tax-amount" className={labelCls}>Tax-deductible amount ($)</label>
                  <input
                    id="gift-tax-amount"
                    type="number"
                    min="0"
                    max={form.amount || undefined}
                    step="0.01"
                    className={inputCls}
                    value={form.taxDeductibleAmount}
                    onChange={(event) => update("taxDeductibleAmount", event.target.value)}
                    placeholder={form.amount || "0.00"}
                  />
                  <p className="mt-1.5 text-xs text-slate-600">Use a partial amount when goods or services reduced the eligible value.</p>
                </div>

                <div className="flex min-h-28 flex-col justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <CheckCircle2 className="mx-auto size-6 text-emerald-700" aria-hidden="true" />
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">Receipt amount</p>
                  <p className="text-2xl font-semibold text-emerald-900">
                    {formatCurrency(form.taxDeductibleAmount || form.amount)}
                  </p>
                </div>

                <div>
                  <label htmlFor="gift-tax-notes" className={labelCls}>Tax-deductible notes</label>
                  <textarea
                    id="gift-tax-notes"
                    rows={3}
                    className={`${inputCls} resize-y`}
                    value={form.taxDeductibleNotes}
                    onChange={(event) => update("taxDeductibleNotes", event.target.value)}
                    placeholder="Document non-deductible portions or special receipt instructions."
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                This gift will show a $0.00 tax-deductible amount on receipt merge fields.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-blue-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.taxReceiptRequested}
                  onChange={(event) => update("taxReceiptRequested", event.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-400 text-blue-700 focus:ring-blue-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Tax receipt requested</span>
                  <span className="block text-xs text-slate-600">Record the donor&apos;s request without sending anything automatically.</span>
                </span>
              </label>
              <span className="text-xs font-medium text-slate-600" role="status">
                {receiptSentAt
                  ? `Receipt sent ${new Date(receiptSentAt).toLocaleDateString()}`
                  : receiptNumber
                    ? `Receipt ${receiptNumber} recorded`
                    : form.taxReceiptRequested
                      ? "Requested · not yet prepared"
                      : "No receipt request recorded"}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={form.isRecurring} onChange={e => update("isRecurring", e.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-400 text-blue-700 focus:ring-blue-600" />
              <Repeat2 className="size-5 text-slate-500" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">Recurring gift</span>
                <span className="block text-xs text-slate-600">Mark this gift as part of an ongoing giving series.</span>
              </span>
            </label>
            {form.isRecurring ? (
              <div className="mt-3 max-w-sm pl-12">
                <label htmlFor="gift-frequency" className={labelCls}>Frequency *</label>
                <select id="gift-frequency" required className={selectCls} value={form.frequency} onChange={e => update("frequency", e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </div>
            ) : null}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
            <Info className="mt-0.5 size-5 shrink-0 text-violet-700" aria-hidden="true" />
            <p><span className="font-semibold">Receipt workflow:</span> A receipt is prepared only when you choose to create it in the receipt workspace.</p>
          </div>
        </div>
      </section>

      {/* Attribution */}
      <div className="space-y-4 border border-[#edebe9] bg-white p-5">
        <h3 className="text-base font-semibold text-[#323130]">Attribution</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="gift-designation" className={labelCls}>Fund / Designation</label>
            <select id="gift-designation" className={selectCls} value={form.designationId} onChange={e => update("designationId", e.target.value)}>
              <option value="">— Undesignated —</option>
              {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="gift-campaign" className={labelCls}>Campaign</label>
            <select id="gift-campaign" className={selectCls} value={form.campaignId} onChange={e => update("campaignId", e.target.value)}>
              <option value="">— None —</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="border border-[#edebe9] bg-white p-5">
        <label className={labelCls}>Notes</label>
        <textarea rows={3} className={inputCls + " resize-none"} placeholder="Optional notes about this gift…"
          value={form.notes} onChange={e => update("notes", e.target.value)} />
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-[#edebe9] bg-[#faf9f8] px-5 py-4 sm:-mx-6 sm:px-6">
        <button type="submit" disabled={saving}
          className="rounded-sm bg-[#0078d4] px-5 py-2 text-sm font-semibold text-white hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-2 disabled:opacity-60">
          {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Record gift"}
        </button>
        <button type="button" onClick={() => onCancel ? onCancel() : router.back()}
          className="rounded-sm border border-[#8a8886] bg-white px-5 py-2 text-sm font-semibold text-[#323130] hover:bg-[#f3f2f1] focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:ring-offset-2">
          Cancel
        </button>
        {/* Queueing is server-owned so every gift entry path behaves consistently. */}
        {mode === "create" && qbEnabled && (
          <p className="ml-auto text-sm font-medium text-green-700" role="status">
            Completed gifts are automatically queued for QuickBooks.
          </p>
        )}
      </div>
    </form>
  );
}
