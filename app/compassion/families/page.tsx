// Compassion CRM Families page — inferred household groupings for faster family-oriented care workflows.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  clientStatus: string;
  email?: string | null;
  phone?: string | null;
}

interface FamilyGroup {
  id: string;
  familyName: string;
  memberCount: number;
  activeMembers: number;
  location?: string;
  members: FamilyMember[];
}

interface FamiliesResponse {
  totalFamilies: number;
  totalClientsGrouped: number;
  families: FamilyGroup[];
}

/** Returns a subtle badge style for client status display. */
function memberStatusStyle(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "bg-blue-100 text-blue-700",
    PENDING: "bg-amber-100 text-amber-700",
    INACTIVE: "bg-gray-100 text-gray-600",
    ARCHIVED: "bg-gray-100 text-gray-500",
    GRADUATED: "bg-emerald-100 text-emerald-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

/**
 * CompassionFamiliesPage shows inferred household groups so staff can
 * quickly work with connected clients in a family context.
 * TODO: enforce Compassion workspace permission
 */
export default function CompassionFamiliesPage() {
  const [groups, setGroups] = useState<FamilyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [minimumMembers, setMinimumMembers] = useState<"1" | "2" | "3">("2");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "200",
        minMembers: minimumMembers,
      });
      if (search.trim()) params.set("search", search.trim());
      const result = await apiFetch<FamiliesResponse>(`/api/compassion/families?${params}`);
      setGroups(Array.isArray(result?.families) ? result.families : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load families");
    } finally {
      setLoading(false);
    }
  }, [minimumMembers, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const totals = useMemo(() => {
    const members = groups.reduce((sum, family) => sum + family.memberCount, 0);
    const activeMembers = groups.reduce((sum, family) => sum + family.activeMembers, 0);
    return {
      families: groups.length,
      members,
      activeMembers,
    };
  }, [groups]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl">🏠</div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Families</h1>
            <p className="text-sm text-gray-500 mt-0.5">Inferred household groups built from address and contact overlap.</p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Family Groups</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.families}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Grouped Clients</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.members}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active Members</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.activeMembers}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search family by name, address, or phone..."
            className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={minimumMembers}
            onChange={(e) => setMinimumMembers(e.target.value as "1" | "2" | "3")}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="1">Show 1+ members</option>
            <option value="2">Show 2+ members</option>
            <option value="3">Show 3+ members</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400 animate-pulse">
            Loading family groups...
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-blue-200 p-10 text-center text-sm text-gray-500">
            No family groups match the current filters.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{group.familyName}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{group.location || "No shared address on file"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800">{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-gray-500">{group.activeMembers} active</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
                {group.members.map((member) => (
                  <div key={member.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.preferredName?.trim() || `${member.firstName} ${member.lastName}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{member.email || member.phone || "No contact info"}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${memberStatusStyle(member.clientStatus)}`}>
                        {member.clientStatus}
                      </span>
                    </div>
                    <Link
                      href={`/compassion/clients/${member.id}`}
                      className="inline-block mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Open profile →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
