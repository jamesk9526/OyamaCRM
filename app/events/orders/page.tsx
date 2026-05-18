/**
 * EventOrdersPage - manage event orders, payments, and manual registrations.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import { apiFetch } from "@/app/lib/auth-client";
import NewOrderModal from "@/app/components/events/NewOrderModal";
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

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentMethod?: string;
  paidAt?: string;
  createdAt: string;
  event: { id: string; name: string; startDate: string };
  constituent: { id: string; firstName: string; lastName: string; email?: string };
  items: Array<{ id: string; quantity: number; unitPrice: number; ticketType: { name: string } }>;
  _count: { guests: number };
}

/** EventOrdersPage provides operational order management for Events CRM. */
export default function EventOrdersPage() {
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

  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (workspaceEventId) {
      setSelectedEventId(workspaceEventId);
    }
  }, [workspaceEventId]);

  /** Load orders and events */
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [ordersData, eventsData] = await Promise.all([
          selectedEventId
            ? apiFetch(`/api/events/${selectedEventId}/orders`)
            : apiFetch("/api/events/orders"),
          apiFetch("/api/events"),
        ]);
        setOrders(ordersData as Order[]);
        const activeEvents = (eventsData as Event[]).filter((e) => e.active);
        setEvents(activeEvents);
        if (!workspaceEventId && !selectedEventId && activeEvents.length > 0) {
          setSelectedEventId(activeEvents[0].id);
        }
      } catch (err) {
        console.error("Failed to load orders:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedEventId, workspaceEventId]);

  /** Filter orders by event, status, search */
  const filteredOrders = orders.filter((order) => {
    if (selectedEventId && order.event.id !== selectedEventId) return false;
    if (statusFilter && order.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesOrderNumber = order.orderNumber.toLowerCase().includes(query);
      const matchesName = `${order.constituent.firstName} ${order.constituent.lastName}`.toLowerCase().includes(query);
      const matchesEmail = order.constituent.email?.toLowerCase().includes(query);
      if (!matchesOrderNumber && !matchesName && !matchesEmail) return false;
    }
    return true;
  });

  /** Metrics calculation */
  const metrics = {
    total: filteredOrders.length,
    pending: filteredOrders.filter((o) => o.status === "PENDING").length,
    confirmed: filteredOrders.filter((o) => o.status === "CONFIRMED").length,
    totalRevenue: filteredOrders
      .filter((o) => o.status === "CONFIRMED")
      .reduce((sum, o) => sum + Number(o.totalAmount), 0),
  };

  /** Status badge color */
  function getStatusColor(status: string) {
    switch (status) {
      case "CONFIRMED": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "CANCELLED": return "bg-gray-100 text-gray-800";
      case "REFUNDED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="the orders workspace" />;
  }

  return (
    <div className="p-6 space-y-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Orders" },
        ]}
        statusLabel={eventScoped ? "Event Scoped" : "All Events"}
        metadata={`${metrics.total.toLocaleString()} orders · ${metrics.confirmed.toLocaleString()} confirmed · $${metrics.totalRevenue.toFixed(2)} revenue`}
        accentTone="amber"
        primaryAction={
          <WorkspaceRibbonButton
            label="Manual Order"
            onClick={() => {
              if (events.length > 0) {
                setSelectedEventId(events[0].id);
                setShowNewOrderModal(true);
              } else {
                alert("Create an event first");
              }
            }}
            variant="primary"
            accentTone="amber"
          />
        }
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Create">
          <WorkspaceRibbonButton
            label="Manual Order"
            onClick={() => {
              if (events.length > 0) {
                setSelectedEventId(events[0].id);
                setShowNewOrderModal(true);
              } else {
                alert("Create an event first");
              }
            }}
            variant="primary"
            accentTone="amber"
          />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Status">
          <WorkspaceRibbonButton label="All" onClick={() => setStatusFilter("")} variant={!statusFilter ? "primary" : "secondary"} accentTone="amber" />
          <WorkspaceRibbonButton label="Pending" onClick={() => setStatusFilter("PENDING")} variant={statusFilter === "PENDING" ? "primary" : "secondary"} accentTone="amber" />
          <WorkspaceRibbonButton label="Confirmed" onClick={() => setStatusFilter("CONFIRMED")} variant={statusFilter === "CONFIRMED" ? "primary" : "secondary"} accentTone="amber" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Filter">
          <WorkspaceRibbonButton label="Clear" onClick={() => { setSearchQuery(""); setStatusFilter(""); }} disabled={!searchQuery && !statusFilter} accentTone="amber" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Confirmed Revenue</p>
          <p className="text-2xl font-bold text-green-600 mt-1">${metrics.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Pending Payment</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{metrics.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-medium">Confirmed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.confirmed}</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="Order number, name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          {!eventScoped ? (
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
          ) : (
            <div className="w-full md:w-48 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Event lock active
            </div>
          )}
          <div className="w-full md:w-40">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
          <button
            onClick={() => {
              if (events.length > 0) {
                setSelectedEventId(events[0].id);
                setShowNewOrderModal(true);
              } else {
                alert("Create an event first");
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 whitespace-nowrap"
          >
            + Manual Order
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No orders found. {searchQuery || statusFilter || selectedEventId ? "Try adjusting filters." : "Create your first order."}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Purchaser</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Guests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{order.event.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {order.constituent.firstName} {order.constituent.lastName}
                    </p>
                    {order.constituent.email && (
                      <p className="text-xs text-gray-500">{order.constituent.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">
                      {order.items.length} {order.items.length === 1 ? "item" : "items"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.items.map((i) => `${i.quantity}x ${i.ticketType.name}`).join(", ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">${Number(order.totalAmount).toFixed(2)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{order.paymentMethod || "—"}</p>
                    {order.paidAt && (
                      <p className="text-xs text-gray-500">Paid {new Date(order.paidAt).toLocaleDateString()}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{order._count.guests}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Order Modal */}
      {showNewOrderModal && selectedEventId && (
        <NewOrderModal
          eventId={selectedEventId}
          onClose={() => setShowNewOrderModal(false)}
          onCreated={() => {
            setShowNewOrderModal(false);
            // Reload data after creating order
            async function reload() {
              setLoading(true);
              try {
                const [ordersData, eventsData] = await Promise.all([
                  apiFetch("/api/events/orders"),
                  apiFetch("/api/events"),
                ]);
                setOrders(ordersData as Order[]);
                setEvents((eventsData as Event[]).filter((e) => e.active));
              } catch (err) {
                console.error("Failed to load orders:", err);
              } finally {
                setLoading(false);
              }
            }
            reload();
          }}
        />
      )}
    </div>
  );
}
