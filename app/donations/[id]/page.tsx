"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import { getConstituentDisplayName } from "@/app/components/constituents/constituent-utils";
import { formatCurrency, formatDonationDate, methodLabel, statusColor } from "@/app/components/donations/donation-utils";

interface GiftDetail {
  id: string;
  amount: string;
  date: string;
  status: string;
  paymentMethod: string;
  checkNumber: string | null;
  transactionId: string | null;
  isRecurring: boolean;
  frequency: string | null;
  taxDeductible: boolean;
  taxDeductibleAmount: string | null;
  taxDeductibleNotes: string | null;
  taxReceiptRequested: boolean;
  receiptNumber: string | null;
  receiptSentAt: string | null;
  acknowledgmentSentAt: string | null;
  notes: string | null;
  eventId: string | null;
  constituent: { id: string; firstName: string; lastName: string; email: string | null };
  campaign: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border-b border-slate-100 py-3 last:border-b-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</dd></div>;
}

export default function GiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [gift, setGift] = useState<GiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void apiFetch<GiftDetail>(`/api/donations/${encodeURIComponent(id)}`)
      .then((data) => { if (active) setGift(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Gift details could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const donorName = gift ? getConstituentDisplayName(gift.constituent) : "Gift";

  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6">
    <WorkspaceBreadcrumbBar items={[{ label: "Donor CRM", href: "/" }, { label: "Donations", href: "/donations" }, { label: "Gift details" }]} statusLabel={gift?.status ?? "Gift"} metadata={gift ? `${donorName} · ${formatDonationDate(gift.date)}` : "Donation record"} />
    {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading gift details…</p> : error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"><p>{error}</p><Link href="/donations" className="mt-3 inline-block font-semibold underline">Return to donations</Link></div> : gift ? <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Recorded gift</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(gift.amount)}</h1><p className="mt-2 text-sm text-slate-600">{formatDonationDate(gift.date)} · {donorName}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(gift.status)}`}>{gift.status.charAt(0) + gift.status.slice(1).toLowerCase()}</span></div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5"><Link href={`/donations/${encodeURIComponent(gift.id)}/edit`} className="rounded-lg bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115ea3]">Edit gift</Link><Link href={`/constituents/${encodeURIComponent(gift.constituent.id)}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Open donor</Link><Link href="/donations" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Donation ledger</Link></div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-slate-950">Gift and attribution</h2><dl className="mt-3"><Detail label="Donor" value={<Link href={`/constituents/${encodeURIComponent(gift.constituent.id)}`} className="text-[#0f6cbd] hover:underline">{donorName}</Link>} /><Detail label="Payment method" value={methodLabel(gift.paymentMethod)} /><Detail label="Fund" value={gift.designation?.name ?? "Undesignated"} /><Detail label="Campaign" value={gift.campaign?.name ?? "None"} /><Detail label="Recurring" value={gift.isRecurring ? gift.frequency ? gift.frequency.charAt(0) + gift.frequency.slice(1).toLowerCase() : "Yes · frequency not set" : "No"} />{gift.eventId ? <Detail label="Event" value={<Link href={`/events/${encodeURIComponent(gift.eventId)}`} className="text-[#0f6cbd] hover:underline">Open linked event</Link>} /> : null}{gift.checkNumber ? <Detail label="Check number" value={gift.checkNumber} /> : null}{gift.transactionId ? <Detail label="Transaction ID" value={gift.transactionId} /> : null}</dl></section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-slate-950">Receipt and follow-up</h2><dl className="mt-3"><Detail label="Tax-deductible amount" value={formatCurrency(gift.taxDeductible ? gift.taxDeductibleAmount ?? gift.amount : 0)} /><Detail label="Receipt requested" value={gift.taxReceiptRequested ? "Yes" : "No"} /><Detail label="Receipt" value={gift.receiptSentAt ? `Sent ${formatDonationDate(gift.receiptSentAt)}` : gift.receiptNumber ? `Recorded: ${gift.receiptNumber}` : "Not sent"} /><Detail label="Acknowledgment" value={gift.acknowledgmentSentAt ? `Thanked ${formatDonationDate(gift.acknowledgmentSentAt)}` : gift.status === "COMPLETED" ? "Needs acknowledgment" : "Not due for acknowledgment"} />{gift.taxDeductibleNotes ? <Detail label="Tax notes" value={gift.taxDeductibleNotes} /> : null}{gift.notes ? <Detail label="Gift notes" value={gift.notes} /> : null}</dl>{gift.status === "COMPLETED" ? <Link href={`/oyama-letters/generate?mode=single&constituentId=${encodeURIComponent(gift.constituent.id)}&donationId=${encodeURIComponent(gift.id)}`} className="mt-5 inline-block rounded-lg border border-[#0f6cbd] px-4 py-2 text-sm font-semibold text-[#0f6cbd] hover:bg-blue-50">Prepare receipt in OyamaLetters</Link> : null}</section>
      </div>
    </> : null}
  </main>;
}
