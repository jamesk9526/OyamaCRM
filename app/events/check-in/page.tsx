/**
 * EventCheckInPage - fast event-night check-in workflow for door volunteers.
 */
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

interface Event {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

interface Guest {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  checkedIn: boolean;
  checkedInAt?: string;
  dietaryRestrictions?: string;
  specialNeeds?: string;
  notes?: string;
  event: { id: string; name: string; startDate: string };
  constituent?: { id: string; firstName: string; lastName: string; email?: string };
  ticketType?: { id: string; name: string };
  order?: { id: string; orderNumber: string; status: string };
  table?: { id: string; name: string };
  paymentStatus?: string;
  rsvpStatus?: string;
  checkinCode?: string;
}

/**
 * EventCheckInPage provides fast, volunteer-friendly event check-in for Events CRM.
 */
export default function EventCheckInPage() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const workspaceEventId = params.eventId ?? searchParams.get("eventId") ?? "";
  const eventScoped = workspaceEventId.length > 0;

  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedInFilter, setCheckedInFilter] = useState("false"); // Default to not checked in
  const [autoRefresh, setAutoRefresh] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Tab state for Search vs. QR/Code Scan vs. Table browse modes */
  const [activeTab, setActiveTab] = useState<"search" | "scan" | "tables">("search");
  const [scanCode, setScanCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanGuest, setScanGuest] = useState<Guest | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanSuccess, setScanSuccess] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);

  /** Load guests for selected event */
  async function loadData() {
    if (!selectedEventId) {
      setGuests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch(`/api/events/${selectedEventId}/guests`);
      setGuests(data as Guest[]);
    } catch (err) {
      console.error("Failed to load guests:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workspaceEventId) {
      setSelectedEventId(workspaceEventId);
    }
  }, [workspaceEventId]);

  /** Load events on mount */
  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await apiFetch("/api/events");
        const activeEvents = (data as Event[]).filter((e) => e.active);
        setEvents(activeEvents);
        if (!workspaceEventId && activeEvents.length > 0) {
          setSelectedEventId(activeEvents[0].id);
        }
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    }
    loadEvents();
  }, [workspaceEventId]);

  useEffect(() => {
    async function loadData() {
      if (!selectedEventId) {
        setGuests([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await apiFetch(`/api/events/${selectedEventId}/guests`);
        setGuests(data as Guest[]);
      } catch (err) {
        console.error("Failed to load guests:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedEventId]);

  /** Auto-refresh when enabled */
  useEffect(() => {
    if (!autoRefresh || !selectedEventId) return;
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/events/${selectedEventId}/guests`);
        setGuests(data as Guest[]);
      } catch (err) {
        console.error("Failed to load guests:", err);
      }
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, selectedEventId]);

  /** Filter guests by search and check-in status */
  const filteredGuests = guests.filter((guest) => {
    if (checkedInFilter === "true" && !guest.checkedIn) return false;
    if (checkedInFilter === "false" && guest.checkedIn) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = `${guest.firstName || ""} ${guest.lastName || ""}`.toLowerCase().includes(query);
      const matchesEmail = guest.email?.toLowerCase().includes(query);
      const matchesPhone = guest.phone?.toLowerCase().includes(query);
      const matchesTable = guest.table?.name?.toLowerCase().includes(query);
      const matchesConstituentName = guest.constituent
        ? `${guest.constituent.firstName} ${guest.constituent.lastName}`.toLowerCase().includes(query)
        : false;
      if (!matchesName && !matchesEmail && !matchesPhone && !matchesTable && !matchesConstituentName) {
        return false;
      }
    }

    return true;
  });

  /** Metrics calculation */
  const totalGuests = guests.length;
  const checkedInCount = guests.filter((g) => g.checkedIn).length;
  const notCheckedInCount = totalGuests - checkedInCount;
  const paymentIssues = guests.filter((g) => g.order?.status === "PENDING").length;

  const guestsByTable = useMemo(() => {
    const grouped = new Map<string, Guest[]>();
    for (const guest of guests) {
      const tableName = guest.table?.name ?? "Unassigned";
      const bucket = grouped.get(tableName) ?? [];
      bucket.push(guest);
      grouped.set(tableName, bucket);
    }
    return Array.from(grouped.entries())
      .map(([tableName, tableGuests]) => ({ tableName, guests: tableGuests }))
      .sort((a, b) => a.tableName.localeCompare(b.tableName));
  }, [guests]);

  /** Check in or undo check-in for a guest */
  async function toggleCheckIn(guestId: string, currentStatus: boolean) {
    try {
      await apiFetch(`/api/events/guests/${guestId}/check-in`, {
        method: "POST",
        body: JSON.stringify({ checkedIn: !currentStatus }),
      });
      // Update local state immediately for responsiveness
      setGuests((prev) =>
        prev.map((g) =>
          g.id === guestId
            ? { ...g, checkedIn: !currentStatus, checkedInAt: !currentStatus ? new Date().toISOString() : undefined }
            : g
        )
      );
      // Clear search after successful check-in to prepare for next guest
      if (!currentStatus) {
        setSearchQuery("");
        searchInputRef.current?.focus();
      }
    } catch (err) {
      console.error("Failed to toggle check-in:", err);
      // Reload data on error to stay in sync
      loadData();
    }
  }

  /** Look up a guest by their printed or scanned check-in code. */
  async function lookupByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = scanCode.trim();
    if (!code) return;

    setScanLoading(true);
    setScanError("");
    setScanGuest(null);
    setScanSuccess("");

    try {
      const eventScopeQuery = selectedEventId ? `?eventId=${encodeURIComponent(selectedEventId)}` : "";
      const guest = await apiFetch<Guest>(`/api/events/guests/by-code/${encodeURIComponent(code)}${eventScopeQuery}`);
      setScanGuest(guest);
    } catch {
      setScanError("No guest found for that code. Please check and try again.");
    } finally {
      setScanLoading(false);
    }
  }

  /**
   * Handle check-in toggle for a guest found via code scan.
   * Updates scan guest state and the main guest list, then shows
   * a 2-second success banner before resetting for the next guest.
   */
  async function toggleScanCheckIn(guest: Guest) {
    const newCheckedIn = !guest.checkedIn;
    try {
      await apiFetch(`/api/events/guests/${guest.id}/check-in`, {
        method: "POST",
        body: JSON.stringify({ checkedIn: newCheckedIn }),
      });
      // Update scan guest card immediately
      setScanGuest((prev) =>
        prev ? { ...prev, checkedIn: newCheckedIn, checkedInAt: newCheckedIn ? new Date().toISOString() : undefined } : prev
      );
      // Also keep the main guest list in sync for accurate metrics
      setGuests((prev) =>
        prev.map((g) =>
          g.id === guest.id
            ? { ...g, checkedIn: newCheckedIn, checkedInAt: newCheckedIn ? new Date().toISOString() : undefined }
            : g
        )
      );
      if (newCheckedIn) {
        // Show success banner for 2 seconds, then clear for next scan
        const guestName = `${guest.firstName || ""} ${guest.lastName || ""}`.trim() || "Guest";
        setScanSuccess(`✓ ${guestName} checked in!`);
        setTimeout(() => {
          setScanSuccess("");
          setScanCode("");
          setScanGuest(null);
          setScanError("");
          scanInputRef.current?.focus();
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to toggle check-in via scan:", err);
      loadData();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/workspace" },
          { label: "Check-In" },
        ]}
        statusLabel={eventScoped ? "Event Scoped" : "Multi-Event"}
        metadata={`${checkedInCount.toLocaleString()} checked in · ${notCheckedInCount.toLocaleString()} remaining · ${totalGuests.toLocaleString()} total`}
        accentTone="amber"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="View">
          <WorkspaceRibbonButton label="Not Checked" onClick={() => setCheckedInFilter("false")} variant={checkedInFilter === "false" ? "primary" : "secondary"} accentTone="amber" />
          <WorkspaceRibbonButton label="Checked In" onClick={() => setCheckedInFilter("true")} variant={checkedInFilter === "true" ? "primary" : "secondary"} accentTone="amber" />
          <WorkspaceRibbonButton label="All Guests" onClick={() => setCheckedInFilter("")} variant={!checkedInFilter ? "primary" : "secondary"} accentTone="amber" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Mode">
          <WorkspaceRibbonButton label="Search" onClick={() => setActiveTab("search")} variant={activeTab === "search" ? "primary" : "secondary"} accentTone="amber" />
          <WorkspaceRibbonButton label="Scan" onClick={() => setActiveTab("scan")} variant={activeTab === "scan" ? "primary" : "secondary"} accentTone="amber" />
          <WorkspaceRibbonButton label="Tables" onClick={() => setActiveTab("tables")} variant={activeTab === "tables" ? "primary" : "secondary"} accentTone="amber" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadData()} accentTone="amber" />
          <WorkspaceRibbonButton label={autoRefresh ? "Auto On" : "Auto Off"} onClick={() => setAutoRefresh((value) => !value)} variant={autoRefresh ? "primary" : "secondary"} accentTone="amber" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      {/* Event Selector & Auto-Refresh */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={eventScoped}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          >
            <option value="">Select an event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} - {new Date(e.startDate).toLocaleDateString()}
              </option>
            ))}
          </select>
          {eventScoped && (
            <p className="text-xs text-amber-700 mt-1">Event is locked by workspace context.</p>
          )}
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-amber-600"
            />
            <span className="text-sm font-medium text-gray-700">Auto-refresh (10s)</span>
          </label>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Select an event to start check-in
        </div>
      ) : (
        <>
          {/* Metrics — visible for both tabs to track event progress */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Checked In</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{checkedInCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Not Checked In</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{notCheckedInCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Total Guests</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalGuests}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Payment Issues</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{paymentIssues}</p>
            </div>
          </div>

          {/* Tab switcher — Search (name/email) vs. Scan (QR / printed code) */}
          <div className="flex gap-0 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("search")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "search"
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              🔍 Search
            </button>
            <button
              onClick={() => {
                setActiveTab("scan");
                // Focus the scan input after the tab switch renders
                setTimeout(() => scanInputRef.current?.focus(), 50);
              }}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "scan"
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              📷 Scan Code
            </button>
            <button
              onClick={() => setActiveTab("tables")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "tables"
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              🪑 Tables
            </button>
          </div>

          {/* SEARCH TAB */}
          {activeTab === "search" && (
            <>
              {/* Search & Filters */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Quick Search
                    </label>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Name, email, phone, or table..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 text-lg border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="w-full md:w-48">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                    <select
                      value={checkedInFilter}
                      onChange={(e) => setCheckedInFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="">All Guests</option>
                      <option value="false">Not Checked In</option>
                      <option value="true">Checked In</option>
                    </select>
                  </div>
                  <button
                    onClick={loadData}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {/* Guest List */}
              {loading ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                  Loading guests...
                </div>
              ) : filteredGuests.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                  {searchQuery ? "No guests match your search." : "No guests found."}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGuests.map((guest) => (
                    <GuestCheckInCard
                      key={guest.id}
                      guest={guest}
                      onToggleCheckIn={() => toggleCheckIn(guest.id, guest.checkedIn)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* SCAN TAB — look up a single guest by QR code or printed ticket code */}
          {activeTab === "scan" && (
            <div className="max-w-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Scan Check-In Code</h2>
              <p className="text-sm text-gray-500 mb-5">
                Scan the QR code or type the code printed on the guest&apos;s ticket or badge.
              </p>

              {/* Code input form */}
              <form onSubmit={lookupByCode} className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Code</label>
                <div className="flex gap-2">
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanCode}
                    onChange={(e) => {
                      setScanCode(e.target.value);
                      setScanError("");
                      setScanGuest(null);
                      setScanSuccess("");
                    }}
                    placeholder="Scan or type code..."
                    className="flex-1 px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none font-mono tracking-widest"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    disabled={scanLoading || !scanCode.trim()}
                    className="px-5 py-3 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {scanLoading ? "..." : "Look Up"}
                  </button>
                </div>
              </form>

              {/* Success banner — auto-dismissed after 2 seconds */}
              {scanSuccess && (
                <div className="mb-4 px-4 py-3 bg-green-100 border border-green-300 rounded-lg text-green-800 font-semibold text-sm">
                  {scanSuccess}
                </div>
              )}

              {/* Error message */}
              {scanError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {scanError}
                </div>
              )}

              {/* Guest card shown after successful lookup */}
              {scanGuest && !scanSuccess && (
                <GuestCheckInCard
                  guest={scanGuest}
                  onToggleCheckIn={() => toggleScanCheckIn(scanGuest)}
                />
              )}
            </div>
          )}

          {/* TABLES TAB — GalaSoft-inspired table browse mode for fast floor operations */}
          {activeTab === "tables" && (
            <div className="space-y-4">
              {guestsByTable.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                  No tables or guests found for this event.
                </div>
              ) : (
                guestsByTable.map((group) => {
                  const tableCheckedIn = group.guests.filter((g) => g.checkedIn).length;
                  return (
                    <div key={group.tableName} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{group.tableName}</h3>
                          <p className="text-xs text-gray-500">{tableCheckedIn}/{group.guests.length} checked in</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {group.guests.map((guest) => (
                          <GuestCheckInCard
                            key={guest.id}
                            guest={guest}
                            onToggleCheckIn={() => toggleCheckIn(guest.id, guest.checkedIn)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * GuestCheckInCard - large, volunteer-friendly guest card for check-in.
 */
function GuestCheckInCard({
  guest,
  onToggleCheckIn,
}: {
  guest: Guest;
  onToggleCheckIn: () => void;
}) {
  const guestName = `${guest.firstName || guest.constituent?.firstName || "—"} ${
    guest.lastName || guest.constituent?.lastName || ""
  }`.trim();

  const hasPaymentIssue = guest.order?.status === "PENDING";

  return (
    <div
      className={`bg-white rounded-lg border-2 p-4 transition-all ${
        guest.checkedIn ? "border-green-300 bg-green-50" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Guest Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 truncate">{guestName}</h3>
              {guest.email && <p className="text-sm text-gray-600 truncate">{guest.email}</p>}
              {guest.phone && <p className="text-sm text-gray-600">{guest.phone}</p>}
            </div>
            {guest.checkedIn && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 whitespace-nowrap">
                ✓ Checked In
              </span>
            )}
          </div>

          {/* Additional Info Row */}
          <div className="flex flex-wrap gap-3 mt-3">
            {guest.table && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Table:</span>
                <span className="font-semibold text-gray-900">{guest.table.name}</span>
              </div>
            )}
            {guest.ticketType && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Ticket:</span>
                <span className="font-medium text-gray-700">{guest.ticketType.name}</span>
              </div>
            )}
            {guest.order && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">Order:</span>
                <span className="font-medium text-gray-700">{guest.order.orderNumber}</span>
                {hasPaymentIssue && (
                  <span className="ml-1 text-xs font-semibold text-red-600">(Payment Pending)</span>
                )}
              </div>
            )}
          </div>

          {/* Notes & Special Needs */}
          {(guest.dietaryRestrictions || guest.specialNeeds || guest.notes) && (
            <div className="mt-3 space-y-1">
              {guest.dietaryRestrictions && (
                <div className="flex gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Dietary:</span>
                  <span className="text-sm text-gray-700">{guest.dietaryRestrictions}</span>
                </div>
              )}
              {guest.specialNeeds && (
                <div className="flex gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Special Needs:</span>
                  <span className="text-sm text-gray-700">{guest.specialNeeds}</span>
                </div>
              )}
              {guest.notes && (
                <div className="flex gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Notes:</span>
                  <span className="text-sm text-gray-700">{guest.notes}</span>
                </div>
              )}
            </div>
          )}

          {guest.checkedInAt && (
            <p className="text-xs text-gray-500 mt-2">
              Checked in at {new Date(guest.checkedInAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Check-In Button */}
        <div className="flex-shrink-0">
          <button
            onClick={onToggleCheckIn}
            className={`px-6 py-4 text-lg font-bold rounded-lg transition-colors whitespace-nowrap ${
              guest.checkedIn
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
          >
            {guest.checkedIn ? "Undo Check-In" : "✓ Check In"}
          </button>
        </div>
      </div>
    </div>
  );
}
