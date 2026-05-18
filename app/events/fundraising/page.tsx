/** Event donations/fundraising workspace for Events CRM. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  active?: boolean;
}

interface EventReport {
  event: { id: string; name: string; startDate: string };
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
}

interface EventOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  constituent?: { firstName: string; lastName: string; email?: string };
}

function formatDate(value?: string): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** EventFundraisingPage shows live event revenue and donor-follow-up signals. */
export default function EventFundraisingPage() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const workspaceEventId = params.eventId ?? searchParams.get("eventId") ?? "";
  const eventScoped = workspaceEventId.length > 0;
  const router = useRouter();

  // Legacy global route redirects to the event selector when no event is selected.
  useEffect(() => {
    if (!eventScoped) {
      router.replace("/events/events");
    }
  }, [eventScoped, router]);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [report, setReport] = useState<EventReport | null>(null);
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceEventId) setSelectedEventId(workspaceEventId);
  }, [workspaceEventId]);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await apiFetch<EventItem[]>("/api/events");
        const activeEvents = (Array.isArray(data) ? data : []).filter((event) => event.active !== false);
        setEvents(activeEvents);
        if (!workspaceEventId && activeEvents.length > 0) {
          setSelectedEventId((current) => current || activeEvents[0].id);
        }
      } catch (error) {
        console.error("Failed to load events for fundraising workspace:", error);
      }
    }

    void loadEvents();
  }, [workspaceEventId]);

  async function loadWorkspace(eventId: string) {
    if (!eventId) {
      setReport(null);
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [reportData, orderData] = await Promise.all([
        apiFetch<EventReport>(`/api/events/${eventId}/report`),
        apiFetch<EventOrder[]>(`/api/events/${eventId}/orders`),
      ]);
      setReport(reportData);
      setOrders(Array.isArray(orderData) ? orderData : []);
    } catch (error) {
      console.error("Failed to load event fundraising workspace:", error);
      setReport(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace(selectedEventId);
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const confirmedOrders = orders.filter((order) => order.status === "CONFIRMED");

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="fundraising and donations" />;
  }

  return (
    <div className="space-y-6 p-6">
      <FeatureStatusWarning
        status="Partially Implemented"
        title="Donations and pledge workflows are partially working"
        description="Core event donation summaries are available, but pledge conversion automation and deeper donor handoff workflows still require manual review."
      />

      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Donations" },
        ]}
        statusLabel="Partially Working"
        metadata={`${(report?.revenue.total ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} total event revenue`}
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Workspace">
          <WorkspaceRibbonButton label="Orders" href={selectedEventId ? `/events/${selectedEventId}/orders` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Reports" href={selectedEventId ? `/events/${selectedEventId}/reports` : undefined} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Follow-Up" href={selectedEventId ? `/events/${selectedEventId}/follow-up` : undefined} disabled={!selectedEventId} accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadWorkspace(selectedEventId)} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Donor-Safe Export" href={selectedEventId ? `/api/events/${selectedEventId}/donor-safe-export?format=csv` : undefined} disabled={!selectedEventId} variant="primary" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Event fundraising</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Event Donations And Revenue</h1>
            <p className="mt-1 text-sm text-slate-600">Track confirmed order revenue, event-tagged donations, and donor follow-up actions from one workspace.</p>
          </div>
          {!eventScoped ? (
            <label className="w-full max-w-sm space-y-1">
              <span className="text-xs font-semibold text-slate-600">Selected event</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="">{loading ? "Loading events..." : "Select an event"}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} - {formatDate(event.startDate)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-violet-700">Event lock active. Switch from All Events.</p>
          )}
        </div>
      </section>

      {!selectedEventId ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Select an event to view fundraising performance.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">
                {(report?.revenue.total ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500">{selectedEvent?.name ?? "Event"}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orders Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {(report?.revenue.fromOrders ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500">{report?.revenue.orderCount ?? 0} order records</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Donations Revenue</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {(report?.revenue.fromDonations ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500">{report?.revenue.donationCount ?? 0} donations</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs Follow-Up</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{report?.donorInsights.needsFollowUp ?? 0}</p>
              <p className="text-xs text-slate-500">{report?.donorInsights.unlinkedGuests ?? 0} unlinked guests</p>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Recent confirmed orders</h2>
                <Link href={selectedEventId ? `/events/${selectedEventId}/orders` : "/events/orders"} className="text-xs font-semibold text-violet-700 hover:text-violet-900">
                  Open orders
                </Link>
              </div>
              {confirmedOrders.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No confirmed orders yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Order</th>
                        <th className="px-3 py-2 text-left">Constituent</th>
                        <th className="px-3 py-2 text-left">Amount</th>
                        <th className="px-3 py-2 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {confirmedOrders.slice(0, 8).map((order) => (
                        <tr key={order.id}>
                          <td className="px-3 py-2 font-medium text-slate-900">{order.orderNumber}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {order.constituent ? `${order.constituent.firstName} ${order.constituent.lastName}` : "Unlinked"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {Number(order.totalAmount ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{formatDate(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-violet-900">Donor-safe handoff</h2>
              <p className="mt-2 text-xs leading-5 text-violet-900">
                Export post-event follow-up rows without private client-service fields. This export includes check-in, RSVP, payment, table, and suggested follow-up action.
              </p>
              <div className="mt-3 space-y-2 text-xs">
                <Link href={selectedEventId ? `/api/events/${selectedEventId}/donor-safe-export?format=csv` : "#"} className="block font-semibold text-violet-700 hover:text-violet-900">
                  Download CSV export
                </Link>
                <Link href={selectedEventId ? `/api/events/${selectedEventId}/donor-safe-export` : "#"} className="block font-semibold text-violet-700 hover:text-violet-900">
                  Open JSON preview
                </Link>
              </div>
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Pledge conversion automation remains partially working and still requires staff review before final updates.
              </p>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

