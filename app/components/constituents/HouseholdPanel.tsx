"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency, statusLabel, statusColor } from "@/app/components/constituents/constituent-utils";
import { apiFetch } from "@/app/lib/auth-client";

interface HouseholdMember {
  id: string;
  firstName: string;
  lastName: string;
  prefix?: string;
  email?: string;
  phone?: string;
  type: string;
  donorStatus: string;
  isPrimaryContact: boolean;
  totalLifetimeGiving: string;
}

interface Household {
  id: string;
  name: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  members: HouseholdMember[];
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  type: string;
}

export default function HouseholdPanel({ householdId, headConstituentId }: {
  householdId: string;
  headConstituentId: string;
}) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Household>(`/api/households/${householdId}`);
      setHousehold(data);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiFetch<SearchResult[]>(`/api/constituents?search=${encodeURIComponent(search)}&limit=10`);
          // Exclude head and current members
          const memberIds = new Set([headConstituentId, ...(household?.members.map((m) => m.id) ?? [])]);
          setSearchResults(data.filter((r) => !memberIds.has(r.id)));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, household, headConstituentId]);

  async function addMember(constituentId: string) {
    await apiFetch(`/api/households/${householdId}/members`, {
      method: "POST",
      body: JSON.stringify({ constituentId }),
    });
    setSearch("");
    setSearchResults([]);
    setAddOpen(false);
    await load();
  }

  async function removeMember(constituentId: string) {
    setRemovingId(constituentId);
    try {
      await apiFetch(`/api/households/${householdId}/members/${constituentId}`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!household) {
    return <p className="text-sm text-gray-400 italic">Household data unavailable.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{household.name}</h3>
          {household.city && (
            <p className="text-xs text-gray-400 mt-0.5">
              {[household.addressLine1, household.city, household.state, household.zip].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <button
          onClick={() => setAddOpen(!addOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </button>
      </div>

      {/* Add member search */}
      {addOpen && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-xs font-medium text-green-800">Search for an existing constituent to add to this household:</p>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
          {searching && <p className="text-xs text-gray-400">Searching…</p>}
          {searchResults.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
              {searchResults.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.firstName} {r.lastName}</p>
                    <p className="text-xs text-gray-400">{r.email ?? r.type}</p>
                  </div>
                  <button
                    onClick={() => addMember(r.id)}
                    className="text-xs px-2.5 py-1 bg-green-600 text-white rounded font-medium hover:bg-green-700"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 italic">No matching constituents found outside this household.</p>
          )}
          <div className="flex justify-end">
            <button onClick={() => { setAddOpen(false); setSearch(""); setSearchResults([]); }} className="text-xs text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      {household.members.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No members in this household yet. Add members using the button above.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {household.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold shrink-0">
                  {m.firstName[0]}{m.lastName[0]}
                </div>
                <div>
                  <Link
                    href={`/constituents/${m.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-green-600 transition-colors"
                  >
                    {m.prefix ? `${m.prefix} ` : ""}{m.firstName} {m.lastName}
                    {m.isPrimaryContact && (
                      <span className="ml-1.5 text-xs text-green-600 font-normal">(Primary)</span>
                    )}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {m.email ?? m.type} · {formatCurrency(m.totalLifetimeGiving)} lifetime
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(m.donorStatus)}`}>
                  {statusLabel(m.donorStatus)}
                </span>
                <button
                  onClick={() => removeMember(m.id)}
                  disabled={removingId === m.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                  title="Remove from household"
                >
                  {removingId === m.id ? "…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
