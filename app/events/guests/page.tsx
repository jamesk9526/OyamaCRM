/**
 * EventGuestsPage - manage guest lists, constituent linking, and check-in rosters.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import NewGuestModal from "@/app/components/events/NewGuestModal";

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
  /** Payment status from the EventGuestPaymentStatus enum: PAID | DUE | PENDING_CHECK | COMP | SPONSORED */
  paymentStatus?: string;
  /** RSVP status from the EventGuestRsvpStatus enum: PENDING | CONFIRMED | DECLINED | WAITLIST */
  rsvpStatus?: string;
  event: { id: string; name: string; startDate: string };
  constituent?: { id: string; firstName: string; lastName: string; email?: string };
  ticketType?: { id: string; name: string };
  order?: { id: string; orderNumber: string; status: string };
  table?: { id: string; name: string };
}

/** EventGuestsPage provides guest roster management for Events CRM. */
export default function EventGuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGuestModal, setShowNewGuestModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedInFilter, setCheckedInFilter] = useState("");
  const [linkedFilter, setLinkedFilter] = useState("");
  /** Filter by EventGuestPaymentStatus: PAID | DUE | PENDING_CHECK | COMP | SPONSORED */
  const [paymentFilter, setPaymentFilter] = useState("");
  /** Filter by EventGuestRsvpStatus: PENDING | CONFIRMED | DECLINED | WAITLIST */
  const [rsvpFilter, setRsvpFilter] = useState("");

  /** Load guests and events */
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [guestsData, eventsData] = await Promise.all([
          apiFetch("/api/events/guests"),
          apiFetch("/api/events"),
        ]);
        setGuests(guestsData as Guest[]);
        setEvents((eventsData as Event[]).filter((e) => e.active));
      } catch (err) {
        console.error("Failed to load guests:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  /** Filter guests by all active filter criteria */
  const filteredGuests = guests.filter((guest) => {
    if (selectedEventId && guest.event.id !== selectedEventId) return false;
    if (checkedInFilter === "true" && !guest.checkedIn) return false;
    if (checkedInFilter === "false" && guest.checkedIn) return false;
    if (linkedFilter === "true" && !guest.constituent) return false;
    if (linkedFilter === "false" && guest.constituent) return false;
    if (paymentFilter && guest.paymentStatus !== paymentFilter) return false;
    if (rsvpFilter && guest.rsvpStatus !== rsvpFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = `${guest.firstName || ""} ${guest.lastName || ""}`.toLowerCase().includes(query);
      const matchesEmail = guest.email?.toLowerCase().includes(query);
      const matchesConstituentName = guest.constituent
        ? `${guest.constituent.firstName} ${guest.constituent.lastName}`.toLowerCase().includes(query)
        : false;
      if (!matchesName && !matchesEmail && !matchesConstituentName) return false;
    }
    return true;
  });

  /** Metrics calculation */
  const metrics = {
    total: filteredGuests.length,
    linked: filteredGuests.filter((g) => g.constituent).length,
    needsReview: filteredGuests.filter((g) => !g.firstName || !g.lastName || !g.constituent).length,
    checkedIn: filteredGuests.filter((g) => g.checkedIn).length,
    /** Guests who confirmed their RSVP */
    confirmedRsvp: filteredGuests.filter((g) => g.rsvpStatus === "CONFIRMED").length,
  };

  /** Reload data helper for mutations */
  const reloadData = useCallback(async () => {
    setLoading(true);
    try {
      const [guestsData, eventsData] = await Promise.all([
        apiFetch("/api/events/guests"),
        apiFetch("/api/events"),
      ]);
      setGuests(guestsData as Guest[]);
      setEvents((eventsData as Event[]).filter((e) => e.active));
    } catch (err) {
      console.error("Failed to load guests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Toggle check-in status */
  async function toggleCheckIn(guestId: string, currentStatus: boolean) {
    try {
      await apiFetch(`/api/events/guests/${guestId}`, {
        method: "PATCH",
        body: JSON.stringify({
          checkedIn: !currentStatus,
          checkedInAt: !currentStatus ? new Date().toISOString() : null,
        }),
      });
      reloadData();
    } catch (err) {
      console.error("Failed to update check-in:", err);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Event Guests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage attendees, link to constituents, and prep check-in rosters
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Guests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Linked to CRM</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{metrics.linked}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Needs Review</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{metrics.needsReview}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Checked In</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.checkedIn}</p>
        </div>
        {/* 5th card: Confirmed RSVP count */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Confirmed RSVP</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.confirmedRsvp}</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="Name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All Events</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <label className="block text-xs font-semibold text-gray-600 mb-1">CRM Link</label>
            <select
              value={linkedFilter}
              onChange={(e) => setLinkedFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All</option>
              <option value="true">Linked</option>
              <option value="false">Not Linked</option>
            </select>
          </div>
          <div className="w-full md:w-40">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Check-in</label>
            <select
              value={checkedInFilter}
              onChange={(e) => setCheckedInFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All</option>
              <option value="true">Checked In</option>
              <option value="false">Not Checked In</option>
            </select>
          </div>
          {/* Payment status filter */}
          <div className="w-full md:w-44">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All</option>
              <option value="PAID">Paid</option>
              <option value="DUE">Due</option>
              <option value="PENDING_CHECK">Pending Check</option>
              <option value="COMP">Comp</option>
              <option value="SPONSORED">Sponsored</option>
            </select>
          </div>
          {/* RSVP status filter */}
          <div className="w-full md:w-44">
            <label className="block text-xs font-semibold text-gray-600 mb-1">RSVP</label>
            <select
              value={rsvpFilter}
              onChange={(e) => setRsvpFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
              <option value="DECLINED">Declined</option>
              <option value="WAITLIST">Waitlist</option>
            </select>
          </div>
          <button
            onClick={() => {
              if (events.length > 0) {
                setSelectedEventId(events[0].id);
                setShowNewGuestModal(true);
              } else {
                alert("Create an event first");
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 whitespace-nowrap"
          >
            + Add Guest
          </button>
        </div>
      </div>

      {/* Guests Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading guests...</div>
        ) : filteredGuests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No guests found. {searchQuery || linkedFilter || checkedInFilter || selectedEventId ? "Try adjusting filters." : "Add your first guest."}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Guest Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Constituent Link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ticket Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dietary</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">RSVP</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {guest.firstName || "—"} {guest.lastName || ""}
                    </p>
                    {guest.email && <p className="text-xs text-gray-500">{guest.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{guest.event.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    {guest.constituent ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {guest.constituent.firstName} {guest.constituent.lastName}
                        </p>
                        <p className="text-xs text-green-600">✓ Linked</p>
                      </div>
                    ) : (
                      <p className="text-xs text-yellow-600">Not linked</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{guest.ticketType?.name || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {guest.order ? (
                      <div>
                        <p className="text-sm text-gray-900">{guest.order.orderNumber}</p>
                        <p className="text-xs text-gray-500">{guest.order.status}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">—</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {guest.dietaryRestrictions ? (
                      <p className="text-sm text-gray-700" title={guest.dietaryRestrictions}>
                        {guest.dietaryRestrictions.substring(0, 20)}
                        {guest.dietaryRestrictions.length > 20 ? "..." : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </td>
                  {/* Payment status badge */}
                  <td className="px-4 py-3">
                    {guest.paymentStatus ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        guest.paymentStatus === "PAID" ? "bg-green-100 text-green-800" :
                        guest.paymentStatus === "DUE" ? "bg-red-100 text-red-800" :
                        guest.paymentStatus === "PENDING_CHECK" ? "bg-yellow-100 text-yellow-800" :
                        guest.paymentStatus === "COMP" ? "bg-gray-100 text-gray-700" :
                        guest.paymentStatus === "SPONSORED" ? "bg-amber-100 text-amber-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {guest.paymentStatus.replace("_", " ")}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  {/* RSVP status badge */}
                  <td className="px-4 py-3">
                    {guest.rsvpStatus ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        guest.rsvpStatus === "CONFIRMED" ? "bg-green-100 text-green-800" :
                        guest.rsvpStatus === "PENDING" ? "bg-amber-100 text-amber-800" :
                        guest.rsvpStatus === "DECLINED" ? "bg-red-100 text-red-800" :
                        guest.rsvpStatus === "WAITLIST" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {guest.rsvpStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleCheckIn(guest.id, guest.checkedIn)}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        guest.checkedIn
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {guest.checkedIn ? "✓ Checked In" : "Check In"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Guest Modal */}
      {showNewGuestModal && selectedEventId && (
        <NewGuestModal
          eventId={selectedEventId}
          onClose={() => setShowNewGuestModal(false)}
          onCreated={() => {
            setShowNewGuestModal(false);
            reloadData();
          }}
        />
      )}
    </div>
  );
}
