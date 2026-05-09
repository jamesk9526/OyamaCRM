"use client";
/**
 * TopDonorsWidget — ranked list of the organization's top donors by lifetime giving.
 * Fetches /api/reports/top-donors?limit=5. Shows rank, name (linked), lifetime giving,
 * and donor status badge. Gold/silver/bronze medals for the top 3.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

interface TopDonor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  totalLifetimeGiving: number;
  lastGiftDate: string | null;
  lastGiftAmount: number | null;
  donorStatus: string;
}

/** Medal color for ranks 1–3 */
function medalColor(rank: number): string {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-600";
  return "text-gray-300";
}

/** Donor status badge styles */
function statusBadge(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    LAPSED: "bg-amber-100 text-amber-700",
    NEW: "bg-blue-100 text-blue-700",
    MAJOR_DONOR: "bg-purple-100 text-purple-700",
    PROSPECT: "bg-gray-100 text-gray-600",
    DECEASED: "bg-red-100 text-red-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-500";
}

function statusLabel(status: string): string {
  return status.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TopDonorsWidget() {
  const [donors, setDonors] = useState<TopDonor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTopDonors() {
      try {
        const data = await apiFetch<TopDonor[]>("/api/reports/top-donors?limit=5");
        if (!cancelled) {
          setDonors(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setDonors([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTopDonors();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex gap-3 items-center">
            <div className="w-6 h-6 bg-gray-100 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
            <div className="w-16 h-5 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (donors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 mb-2 opacity-40">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
        <p className="text-sm">No donor data yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {donors.map((donor, i) => {
        const rank = i + 1;
        return (
          <div
            key={donor.id}
            className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {/* Rank / medal */}
            <div className={`w-5 text-center font-bold text-sm shrink-0 ${medalColor(rank)}`}>
              {rank <= 3 ? "★" : rank}
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/constituents/${donor.id}`}
                className="text-sm font-medium text-gray-900 hover:text-green-700 truncate block"
              >
                {donor.firstName} {donor.lastName}
              </Link>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusBadge(donor.donorStatus)}`}>
                {statusLabel(donor.donorStatus)}
              </span>
            </div>

            {/* Lifetime giving */}
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-gray-800">
                ${Number(donor.totalLifetimeGiving).toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400">lifetime</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
