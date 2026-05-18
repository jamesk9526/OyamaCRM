/**
 * EventReportsContent — Real event reporting page with live data.
 * Displays event performance metrics, revenue breakdowns, attendance, and donor insights.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import EventsMetricCard from "@/app/components/events/EventsMetricCard";
import { apiFetch } from "@/app/lib/auth-client";

interface Event {
  id: string;
  name: string;
  type: string;
  startDate: string;
}

interface EventReport {
  event: {
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: string;
    endDate: string | null;
    revenueGoal: number | null;
    registrationGoal: number | null;
    capacity: number | null;
  };
  attendance: {
    total: number;
    checkedIn: number;
    noShows: number;
    attendanceRate: number;
    goal: number | null;
    progress: number | null;
  };
  revenue: {
    total: number;
    fromOrders: number;
    fromDonations: number;
    orderCount: number;
    donationCount: number;
    goal: number | null;
    progress: number | null;
  };
  donorInsights: {
    linkedGuests: number;
    unlinkedGuests: number;
    newDonors: number;
    needsFollowUp: number;
  };
  counts: {
    sponsors: number;
    activities: number;
  };
}

interface SummaryReport {
  totalEvents: number;
  totalRevenue: number;
  totalAttendees: number;
  topEvents: Array<{
    id: string;
    name: string;
    type: string;
    startDate: string;
    revenue: number;
    guests: number;
    checkedIn: number;
  }>;
}

export default function EventReportsContent() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const scopedEventId = params.eventId ?? searchParams.get("eventId") ?? null;

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(scopedEventId);
  const [eventReport, setEventReport] = useState<EventReport | null>(null);
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"summary" | "detail">(scopedEventId ? "detail" : "summary");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scopedEventId) return;
    setSelectedEventId(scopedEventId);
    setViewMode("detail");
  }, [scopedEventId]);

  // Load events list
  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<Event[]>("/api/events");
        if (cancelled) return;
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        setEvents([]);
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load summary report
  useEffect(() => {
    if (viewMode !== "summary") return;

    let cancelled = false;

    async function loadSummaryReport() {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<SummaryReport>("/api/events/reports/summary");
        if (cancelled) return;
        setSummaryReport(data ?? null);
      } catch (err) {
        if (cancelled) return;
        setSummaryReport(null);
        setError(err instanceof Error ? err.message : "Failed to load summary report");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSummaryReport();

    return () => {
      cancelled = true;
    };
  }, [viewMode]);

  // Load event-specific report when selected
  useEffect(() => {
    if (!selectedEventId || viewMode !== "detail") return;

    let cancelled = false;

    async function loadReport() {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<EventReport>(`/api/events/${selectedEventId}/report`);
        if (cancelled) return;
        setEventReport(data ?? null);
      } catch (err) {
        if (cancelled) return;
        setEventReport(null);
        setError(err instanceof Error ? err.message : "Failed to load event report");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [selectedEventId, viewMode]);

  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    setViewMode("detail");
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Event Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Measure attendance, revenue, sponsorships, and event-driven donor growth
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("summary")}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === "summary"
                ? "bg-amber-600 text-white"
                : "border border-amber-200 text-amber-700 bg-white hover:bg-amber-50"
            }`}
          >
            All Events Summary
          </button>
          {selectedEventId && (
            <button
              onClick={() => setViewMode("detail")}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === "detail"
                  ? "bg-amber-600 text-white"
                  : "border border-amber-200 text-amber-700 bg-white hover:bg-amber-50"
              }`}
            >
              Event Detail
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary View */}
      {viewMode === "summary" && summaryReport && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <EventsMetricCard
              label="Total Events"
              value={summaryReport.totalEvents}
              helper="All events in the system"
            />
            <EventsMetricCard
              label="Total Revenue"
              value={`$${summaryReport.totalRevenue.toLocaleString()}`}
              helper="Ticket sales and event donations"
            />
            <EventsMetricCard
              label="Total Attendees"
              value={summaryReport.totalAttendees}
              helper="Checked-in guests across all events"
            />
          </div>

          {/* Top Events Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Top Events by Revenue</h2>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {summaryReport.topEvents.map((event) => (
                <article key={event.id} className="px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{event.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{event.type} • {new Date(event.startDate).toLocaleDateString()}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-gray-50 px-2 py-1.5">
                      <p className="text-gray-500">Revenue</p>
                      <p className="font-semibold text-gray-900">${event.revenue.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-gray-50 px-2 py-1.5">
                      <p className="text-gray-500">Guests</p>
                      <p className="font-medium text-gray-800">{event.guests}</p>
                    </div>
                    <div className="rounded-md bg-gray-50 px-2 py-1.5">
                      <p className="text-gray-500">Checked In</p>
                      <p className="font-medium text-gray-800">{event.checkedIn}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={() => handleEventSelect(event.id)}
                      className="text-amber-600 hover:text-amber-700 text-xs font-medium"
                    >
                      View Report
                    </button>
                  </div>
                </article>
              ))}
              {summaryReport.topEvents.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-500">
                  No events found. Create your first event to get started.
                </div>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Guests</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Checked In</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {summaryReport.topEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{event.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(event.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                        ${event.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-500">{event.guests}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-500">{event.checkedIn}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        <button
                          onClick={() => handleEventSelect(event.id)}
                          className="text-amber-600 hover:text-amber-700 font-medium"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summaryReport.topEvents.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No events found. Create your first event to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === "summary" && !loading && !summaryReport && !error && (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No report data is available yet.
        </div>
      )}

      {/* Detail View */}
      {viewMode === "detail" && selectedEventId && (
        <div className="space-y-6">
          {/* Event Selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} ({new Date(event.startDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading report...</div>
            </div>
          )}

          {!loading && eventReport && (
            <>
              {/* Attendance Metrics */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Attendance</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <EventsMetricCard
                    label="Total Registered"
                    value={eventReport.attendance.total}
                    helper={eventReport.attendance.goal ? `Goal: ${eventReport.attendance.goal}` : undefined}
                  />
                  <EventsMetricCard
                    label="Checked In"
                    value={eventReport.attendance.checkedIn}
                    helper={`${eventReport.attendance.attendanceRate}% attendance rate`}
                  />
                  <EventsMetricCard
                    label="No-Shows"
                    value={eventReport.attendance.noShows}
                    helper="Registered but did not attend"
                  />
                  {eventReport.attendance.progress !== null && (
                    <EventsMetricCard
                      label="Goal Progress"
                      value={`${eventReport.attendance.progress}%`}
                      helper={`Target: ${eventReport.attendance.goal}`}
                    />
                  )}
                </div>
              </div>

              {/* Revenue Metrics */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Revenue</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <EventsMetricCard
                    label="Total Revenue"
                    value={`$${eventReport.revenue.total.toLocaleString()}`}
                    helper={eventReport.revenue.goal ? `Goal: $${eventReport.revenue.goal.toLocaleString()}` : undefined}
                  />
                  <EventsMetricCard
                    label="From Orders"
                    value={`$${eventReport.revenue.fromOrders.toLocaleString()}`}
                    helper={`${eventReport.revenue.orderCount} orders`}
                  />
                  <EventsMetricCard
                    label="From Donations"
                    value={`$${eventReport.revenue.fromDonations.toLocaleString()}`}
                    helper={`${eventReport.revenue.donationCount} donations`}
                  />
                  {eventReport.revenue.progress !== null && (
                    <EventsMetricCard
                      label="Goal Progress"
                      value={`${eventReport.revenue.progress}%`}
                      helper={`Target: $${eventReport.revenue.goal?.toLocaleString()}`}
                    />
                  )}
                </div>
              </div>

              {/* Donor Insights */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Donor Impact</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <EventsMetricCard
                    label="Linked Guests"
                    value={eventReport.donorInsights.linkedGuests}
                    helper="Guests connected to donor records"
                  />
                  <EventsMetricCard
                    label="Unlinked Guests"
                    value={eventReport.donorInsights.unlinkedGuests}
                    helper="Guests not yet linked to constituents"
                  />
                  <EventsMetricCard
                    label="New Donors"
                    value={eventReport.donorInsights.newDonors}
                    helper="First-time donors from this event"
                  />
                  <EventsMetricCard
                    label="Needs Follow-Up"
                    value={eventReport.donorInsights.needsFollowUp}
                    helper="Unlinked guests and no-shows"
                  />
                </div>
              </div>

              {/* Other Event Data */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Additional Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EventsMetricCard
                    label="Sponsors"
                    value={eventReport.counts.sponsors}
                    helper="Event sponsors registered"
                  />
                  <EventsMetricCard
                    label="Activities Logged"
                    value={eventReport.counts.activities}
                    helper="Donor timeline activities from this event"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
