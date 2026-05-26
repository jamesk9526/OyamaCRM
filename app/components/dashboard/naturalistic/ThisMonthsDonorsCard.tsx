/**
 * ThisMonthsDonorsCard places the existing current-month donor workflow inside
 * the naturalistic dashboard layout without replacing its real API-backed actions.
 */
"use client";

import MonthlyDonationsWidget from "@/app/components/dashboard/MonthlyDonationsWidget";

export default function ThisMonthsDonorsCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <MonthlyDonationsWidget />
    </div>
  );
}
