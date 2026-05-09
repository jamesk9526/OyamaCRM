/**
 * EventCheckInPage - fast event-night check-in workflow for door volunteers.
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/app/lib/auth-client";

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
}

/**
 * EventCheckInPage provides fast, volunteer-friendly event check-in for Events CRM.
 */
export default function EventCheckInPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedInFilter, setCheckedInFilter] = useState("false"); // Default to not checked in
  const [autoRefresh, setAutoRefresh] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  /** Load events on mount */
  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await apiFetch("/api/events");
        const activeEvents = (data as Event[]).filter((e) => e.active);
        setEvents(activeEvents);
        if (activeEvents.length > 0) {
          setSelectedEventId(activeEvents[0].id);
        }
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    }
    loadEvents();
  }, []);

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Event Check-In</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fast, volunteer-friendly check-in for event night
        </p>
      </div>

      {/* Event Selector & Auto-Refresh */}
      <div className="mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          >
            <option value="">Select an event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} - {new Date(e.startDate).toLocaleDateString()}
              </option>
            ))}
          </select>
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
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
