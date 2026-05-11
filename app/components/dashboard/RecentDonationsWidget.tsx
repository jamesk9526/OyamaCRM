"use client";
/**
 * RecentDonationsWidget — live feed of the last 8 completed donations.
 * Fetches /api/reports/recent-donations. Shows amount, constituent name (linked),
 * campaign name, payment method badge, and relative date.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

interface RecentDonation {
  id: string;
  amount: number;
  date: string;
  paymentMethod: string | null;
  constituentId: string;
  constituentName: string;
  campaignName: string | null;
}

/** Convert a date string to a human-readable relative string */
function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) {
    const daysUntil = Math.ceil(Math.abs(diff) / 86_400_000);
    if (daysUntil <= 1) return "Tomorrow";
    return `in ${daysUntil}d`;
  }
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Payment method display label */
function methodLabel(method: string | null): string {
  if (!method) return "—";
  const map: Record<string, string> = {
    CREDIT_CARD: "Card",
    ACH: "ACH",
    CHECK: "Check",
    CASH: "Cash",
    WIRE: "Wire",
    STOCK: "Stock",
    CRYPTO: "Crypto",
    OTHER: "Other",
  };
  return map[method] ?? method;
}

/** Payment method badge color */
function methodColor(method: string | null): string {
  const map: Record<string, string> = {
    CREDIT_CARD: "bg-blue-100 text-blue-700",
    ACH: "bg-green-100 text-green-700",
    CHECK: "bg-amber-100 text-amber-700",
    CASH: "bg-emerald-100 text-emerald-700",
    WIRE: "bg-purple-100 text-purple-700",
    STOCK: "bg-rose-100 text-rose-700",
  };
  return map[method ?? ""] ?? "bg-gray-100 text-gray-600";
}

export default function RecentDonationsWidget() {
  const [donations, setDonations] = useState<RecentDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentDonations() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<RecentDonation[]>("/api/reports/recent-donations?limit=8");
        if (cancelled) return;
        setDonations(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (cancelled) return;
        setDonations([]);
        setError(requestError instanceof Error ? requestError.message : "Failed to load recent donations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRecentDonations();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex gap-2.5 items-center">
            <div className="w-10 h-10 bg-gray-100 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (donations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 mb-2 opacity-40">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
        <p className="text-sm">{error ? "Could not load recent donations" : "No recent donations"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {donations.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          {/* Amount badge */}
          <div className="w-14 text-right shrink-0">
            <span className="text-sm font-bold text-green-700">
              ${d.amount.toLocaleString()}
            </span>
          </div>

          {/* Name + campaign */}
          <div className="flex-1 min-w-0">
            <Link
              href={`/constituents/${d.constituentId}`}
              className="text-sm font-medium text-gray-900 hover:text-green-700 truncate block"
            >
              {d.constituentName || "Unknown Donor"}
            </Link>
            {d.campaignName && (
              <p className="text-xs text-gray-400 truncate">{d.campaignName}</p>
            )}
          </div>

          {/* Method badge + date */}
          <div className="flex flex-col items-end shrink-0 gap-0.5">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${methodColor(d.paymentMethod)}`}>
              {methodLabel(d.paymentMethod)}
            </span>
            <span className="text-[10px] text-gray-400">{relativeDate(d.date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
