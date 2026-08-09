/**
 * EventTablesPage - manage table seating, capacity, and guest assignments.
 */
"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
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
  constituent?: { id: string; firstName: string; lastName: string; email?: string };
  ticketType?: { id: string; name: string };
  order?: { id: string; orderNumber: string; status: string };
}

interface Table {
  id: string;
  name: string;
  capacity: number;
  notes?: string;
  tableNumber?: number;
  tableUid?: string;
  publicCode?: string;
  status?: "DRAFT" | "OPEN" | "SUBMITTED" | "LOCKED" | "EVENT_DAY" | "ARCHIVED";
  isSponsored: boolean;
  sponsorName?: string;
  hostName?: string;
  hostEmail?: string;
  hostPhone?: string;
  shape: string;
  xPosition: number;
  yPosition: number;
  guests: Guest[];
  _count: { guests: number };
}

interface EventTableSeat {
  id: string;
  seatNumber: number;
  status: "EMPTY" | "RESERVED" | "INVITED" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED";
  notes?: string;
  guest?: Guest;
}

interface EventGuestInvite {
  id: string;
  seatId?: string | null;
  inviteEmail?: string | null;
  invitePhone?: string | null;
  status: "CREATED" | "QUEUED" | "SENT" | "OPENED" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  createdAt: string;
  expiresAt?: string | null;
}

interface TableLinkDetail extends Table {
  seats: EventTableSeat[];
  guestInvites: EventGuestInvite[];
}

interface EventEmailLog {
  id: string;
  tableId?: string | null;
  type: string;
  recipientEmail: string;
  status: "QUEUED" | "SENT" | "FAILED" | "OPENED";
  subject?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

/**
 * EventTablesPage provides operational table and seating management for Events CRM.
 */
export default function EventTablesPage() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceEventId = params.eventId ?? searchParams.get("eventId") ?? "";
  const eventScoped = workspaceEventId.length > 0;

  // Legacy global /events/tables route redirects to the event selector when no event is selected.
  useEffect(() => {
    if (!eventScoped) {
      router.replace("/events/events");
    }
  }, [eventScoped, router]);

  const [tables, setTables] = useState<Table[]>([]);
  const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [showNewTableModal, setShowNewTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [seatingView, setSeatingView] = useState<"floor" | "list" | "placement">("floor");
  const [detailTable, setDetailTable] = useState<Table | null>(null);
  const [tableDetail, setTableDetail] = useState<TableLinkDetail | null>(null);
  const [tableEmailLogs, setTableEmailLogs] = useState<EventEmailLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailBusyAction, setDetailBusyAction] = useState<string | null>(null);
  const [hostAccessEmail, setHostAccessEmail] = useState("");
  const [hostAccessToken, setHostAccessToken] = useState<{ token: string; expiresAt: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSeatId, setInviteSeatId] = useState("");
  const [seatAssignmentMap, setSeatAssignmentMap] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDeleteTable, setPendingDeleteTable] = useState<Table | null>(null);
  const [deletingTable, setDeletingTable] = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  useEffect(() => {
    if (workspaceEventId) {
      setSelectedEventId(workspaceEventId);
    }
  }, [workspaceEventId]);

  /** Load tables and unassigned guests for selected event */
  async function loadData() {
    if (!selectedEventId) {
      setTables([]);
      setUnassignedGuests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setActionError(null);
    try {
      const [tablesData, guestsData] = await Promise.all([
        apiFetch(`/api/events/${selectedEventId}/tables`),
        apiFetch(`/api/events/${selectedEventId}/guests`),
      ]);
      setTables(tablesData as Table[]);
      interface GuestWithTable extends Guest {
        table?: { id: string; name: string };
      }
      setUnassignedGuests((guestsData as GuestWithTable[]).filter((g) => !g.table));
    } catch (err) {
      console.error("Failed to load table data:", err);
      setActionError(err instanceof Error ? err.message : "Tables could not be loaded.");
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
        setTables([]);
        setUnassignedGuests([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [tablesData, guestsData] = await Promise.all([
          apiFetch(`/api/events/${selectedEventId}/tables`),
          apiFetch(`/api/events/${selectedEventId}/guests`),
        ]);
        setTables(tablesData as Table[]);
        interface GuestWithTable extends Guest {
          table?: { id: string; name: string };
        }
        setUnassignedGuests((guestsData as GuestWithTable[]).filter((g) => !g.table));
      } catch (err) {
        console.error("Failed to load table data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedEventId]);

  /** Metrics calculation */
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const totalAssigned = tables.reduce((sum, t) => sum + t._count.guests, 0);
  const openSeats = Math.max(0, totalCapacity - totalAssigned);
  const overCapacityTables = tables.filter((t) => t._count.guests > t.capacity).length;
  const visibleTables = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return tables;
    return tables.filter((table) => {
      const guestNames = table.guests.map((guest) => (
        `${guest.firstName ?? guest.constituent?.firstName ?? ""} ${guest.lastName ?? guest.constituent?.lastName ?? ""}`
      )).join(" ");
      return [
        table.name,
        table.tableNumber != null ? String(table.tableNumber) : "",
        table.hostName ?? "",
        table.sponsorName ?? "",
        guestNames,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [tableSearch, tables]);

  /** Assign guest to table */
  async function assignGuestToTable(guestId: string, tableId: string | null) {
    try {
      setActionError(null);
      await apiFetch(`/api/events/guests/${guestId}/assign-table`, {
        method: "PATCH",
        body: JSON.stringify({ tableId }),
      });
      await loadData();
    } catch (err) {
      console.error("Failed to assign guest:", err);
      setActionError(err instanceof Error ? err.message : "The guest could not be moved.");
    }
  }

  /** Create new table */
  async function createTable(
    name: string,
    capacity: number,
    notes?: string,
    tableNumber?: number,
    isSponsored?: boolean,
    hostName?: string,
    shape?: string,
  ) {
    if (!selectedEventId) return;
    try {
      setActionError(null);
      await apiFetch(`/api/events/${selectedEventId}/tables`, {
        method: "POST",
        body: JSON.stringify({ name, capacity, notes, tableNumber, isSponsored, hostName, shape }),
      });
      setShowNewTableModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to create table:", err);
      setActionError(err instanceof Error ? err.message : "The table could not be created.");
    }
  }

  /** Update table */
  async function updateTable(
    tableId: string,
    name: string,
    capacity: number,
    notes?: string,
    tableNumber?: number,
    isSponsored?: boolean,
    hostName?: string,
    shape?: string,
  ) {
    try {
      setActionError(null);
      await apiFetch(`/api/events/tables/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, capacity, notes, tableNumber, isSponsored, hostName, shape }),
      });
      setEditingTable(null);
      loadData();
    } catch (err) {
      console.error("Failed to update table:", err);
      setActionError(err instanceof Error ? err.message : "The table could not be updated.");
    }
  }

  /** Delete table */
  async function deleteTable() {
    if (!pendingDeleteTable) return;
    setDeletingTable(true);
    try {
      setActionError(null);
      await apiFetch(`/api/events/tables/${pendingDeleteTable.id}`, { method: "DELETE" });
      setPendingDeleteTable(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete table:", err);
      setActionError(err instanceof Error ? err.message : "The table could not be deleted.");
    } finally {
      setDeletingTable(false);
    }
  }

  async function saveFloorPositions(positions: Array<{ id: string; xPosition: number; yPosition: number }>) {
    if (!positions.length) return;
    const previous = tables;
    const positionMap = new Map(positions.map((position) => [position.id, position]));
    setTables((current) => current.map((table) => {
      const position = positionMap.get(table.id);
      return position ? { ...table, xPosition: position.xPosition, yPosition: position.yPosition } : table;
    }));
    try {
      setActionError(null);
      await Promise.all(positions.map((position) => apiFetch(`/api/events/tables/${position.id}`, {
        method: "PATCH",
        body: JSON.stringify({ xPosition: position.xPosition, yPosition: position.yPosition }),
      })));
    } catch (error) {
      setTables(previous);
      setActionError(error instanceof Error ? error.message : "The floor-plan positions could not be saved.");
    }
  }

  async function openTableDetail(table: Table) {
    if (!selectedEventId || !table.tableUid) {
      setDetailError("This table is missing a table UID. Save the table and try again.");
      setDetailTable(table);
      return;
    }

    setDetailTable(table);
    setHostAccessEmail((table.hostEmail ?? "").trim());
    setHostAccessToken(null);
    setInviteEmail("");
    setInvitePhone("");
    setInviteSeatId("");
    setSeatAssignmentMap({});
    await refreshTableDetail(table.tableUid, table.id);
  }

  async function refreshTableDetail(tableUid: string, tableId: string) {
    if (!selectedEventId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [detail, logs] = await Promise.all([
        apiFetch(`/api/events/${selectedEventId}/tablelink/${tableUid}`),
        apiFetch(`/api/events/${selectedEventId}/emails/logs`),
      ]);
      setTableDetail(detail as TableLinkDetail);
      const filteredLogs = Array.isArray(logs)
        ? (logs as EventEmailLog[]).filter((log) => log.tableId === tableId)
        : [];
      setTableEmailLogs(filteredLogs);
    } catch (error) {
      console.error("Failed to load table detail:", error);
      setDetailError("Unable to load table details. Try again.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function runDetailAction(action: string, callback: () => Promise<void>) {
    setDetailBusyAction(action);
    setDetailError(null);
    try {
      await callback();
    } catch (error) {
      console.error("Detail action failed:", error);
      setDetailError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setDetailBusyAction(null);
    }
  }

  async function toggleTableLock() {
    if (!selectedEventId || !tableDetail?.tableUid) return;
    const nextStatus = tableDetail.status === "LOCKED" ? "OPEN" : "LOCKED";
    await runDetailAction("toggle-lock", async () => {
      await apiFetch(`/api/events/${selectedEventId}/tablelink/${tableDetail.tableUid}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await refreshTableDetail(tableDetail.tableUid as string, tableDetail.id);
      await loadData();
    });
  }

  async function requestHostAccessToken() {
    if (!selectedEventId || !tableDetail?.tableUid) return;
    const email = hostAccessEmail.trim().toLowerCase();
    if (!email) {
      setDetailError("Enter host email to issue an access token.");
      return;
    }

    await runDetailAction("host-access", async () => {
      const response = await apiFetch(`/api/events/${selectedEventId}/tablelink/request-access`, {
        method: "POST",
        body: JSON.stringify({
          tableKey: tableDetail.publicCode ?? tableDetail.tableUid,
          email,
        }),
      });
      const tokenResponse = response as { token?: string; expiresAt?: string };
      if (tokenResponse.token && tokenResponse.expiresAt) {
        setHostAccessToken({ token: tokenResponse.token, expiresAt: tokenResponse.expiresAt });
      }
    });
  }

  async function revokeHostAccessTokens() {
    if (!selectedEventId || !tableDetail?.tableUid) return;
    await runDetailAction("revoke-access", async () => {
      await apiFetch(`/api/events/${selectedEventId}/tablelink/${tableDetail.tableUid}/revoke-access`, {
        method: "POST",
      });
    });
  }

  async function syncTableSeats() {
    if (!selectedEventId || !tableDetail?.id || !tableDetail?.tableUid) return;
    await runDetailAction("sync-seats", async () => {
      await apiFetch(`/api/events/${selectedEventId}/tables/${tableDetail.id}/seats/sync`, {
        method: "POST",
      });
      await refreshTableDetail(tableDetail.tableUid as string, tableDetail.id);
      await loadData();
    });
  }

  async function assignSeatGuest(seatId: string) {
    if (!selectedEventId || !tableDetail?.tableUid) return;
    const guestId = seatAssignmentMap[seatId];
    if (!guestId) {
      setDetailError("Select a guest to assign.");
      return;
    }

    await runDetailAction(`assign-seat-${seatId}`, async () => {
      await apiFetch(`/api/events/${selectedEventId}/seats/${seatId}/assign-guest`, {
        method: "POST",
        body: JSON.stringify({ guestId }),
      });
      setSeatAssignmentMap((previous) => ({ ...previous, [seatId]: "" }));
      await refreshTableDetail(tableDetail.tableUid as string, tableDetail.id);
      await loadData();
    });
  }

  async function clearSeatGuest(seatId: string) {
    if (!selectedEventId || !tableDetail?.tableUid) return;
    await runDetailAction(`clear-seat-${seatId}`, async () => {
      await apiFetch(`/api/events/${selectedEventId}/seats/${seatId}/clear`, {
        method: "POST",
      });
      await refreshTableDetail(tableDetail.tableUid as string, tableDetail.id);
      await loadData();
    });
  }

  async function createGuestInvite() {
    if (!selectedEventId || !tableDetail?.tableUid) return;
    if (!inviteEmail.trim() && !invitePhone.trim()) {
      setDetailError("Invite requires an email or phone value.");
      return;
    }

    await runDetailAction("create-invite", async () => {
      await apiFetch(`/api/events/${selectedEventId}/tablelink/${tableDetail.tableUid}/invite-guest`, {
        method: "POST",
        body: JSON.stringify({
          seatId: inviteSeatId || undefined,
          inviteEmail: inviteEmail.trim() || undefined,
          invitePhone: invitePhone.trim() || undefined,
          invitedByHostEmail: (tableDetail.hostEmail ?? hostAccessEmail).trim() || undefined,
        }),
      });
      setInviteEmail("");
      setInvitePhone("");
      setInviteSeatId("");
      await refreshTableDetail(tableDetail.tableUid as string, tableDetail.id);
    });
  }

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="the seating workspace" />;
  }

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Tables" },
        ]}
        statusLabel={eventScoped ? "Event Scoped" : "All Events"}
        metadata={`${tables.length.toLocaleString()} tables · ${openSeats.toLocaleString()} open seats · ${overCapacityTables.toLocaleString()} over capacity`}
        accentTone="purple"
        primaryAction={selectedEventId ? <WorkspaceRibbonButton label="Create Table" onClick={() => setShowNewTableModal(true)} variant="primary" accentTone="purple" /> : undefined}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="View">
          <WorkspaceRibbonButton label="Floor Plan" onClick={() => setSeatingView("floor")} variant={seatingView === "floor" ? "primary" : "secondary"} accentTone="purple" />
          <WorkspaceRibbonButton label="Table List" onClick={() => setSeatingView("list")} variant={seatingView === "list" ? "primary" : "secondary"} accentTone="purple" />
          <WorkspaceRibbonButton label="Guest Placement" onClick={() => setSeatingView("placement")} variant={seatingView === "placement" ? "primary" : "secondary"} accentTone="purple" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Create">
          <WorkspaceRibbonButton label="Create Table" onClick={() => setShowNewTableModal(true)} variant="primary" disabled={!selectedEventId} accentTone="purple" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadData()} disabled={!selectedEventId} accentTone="purple" />
          <WorkspaceRibbonButton label="Seating Help" href="/help?scope=events&scopePath=/events/tables" accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      {actionError ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
          {actionError}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Find a table, host, or guest
          <input
            type="search"
            value={tableSearch}
            onChange={(event) => setTableSearch(event.target.value)}
            placeholder="Search table number, name, host, sponsor, or guest"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        </label>
        <p className="text-xs font-medium text-slate-500">
          Showing {visibleTables.length} of {tables.length} table{tables.length === 1 ? "" : "s"}
        </p>
      </section>

      {/* Event Selector */}
      {!eventScoped ? (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          >
            <option value="">Select an event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} - {new Date(e.startDate).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
          Event lock is active. Use All Events to change events.
        </div>
      )}

      {!selectedEventId ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Select an event to manage tables
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Tables</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{tables.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Total Capacity</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">{totalCapacity}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Open Seats</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{openSeats}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-medium">Over Capacity</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{overCapacityTables}</p>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              Loading tables...
            </div>
          ) : tables.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              No tables configured yet.
            </div>
          ) : visibleTables.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
              <p className="font-semibold text-slate-900">No tables match this search.</p>
              <button type="button" onClick={() => setTableSearch("")} className="mt-2 text-sm font-semibold text-violet-700 hover:text-violet-900">
                Clear search
              </button>
            </div>
          ) : seatingView === "floor" ? (
            <div className="space-y-4">
              <FloorPlanBoard
                tables={visibleTables}
                onSavePositions={saveFloorPositions}
                onOpenTable={(table) => void openTableDetail(table)}
              />
              {unassignedGuests.length > 0 ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
                  {unassignedGuests.length} guests are still unassigned. Switch to Guest Placement view to place them quickly.
                </div>
              ) : null}
            </div>
          ) : seatingView === "list" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {visibleTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onEdit={() => setEditingTable(table)}
                  onOpenDetails={() => void openTableDetail(table)}
                  onDelete={() => setPendingDeleteTable(table)}
                  onUnassignGuest={(guestId) => assignGuestToTable(guestId, null)}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Guest Placement View</h2>
                <p className="text-xs text-gray-500">Assign unseated guests to available tables with live capacity context.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleTables.map((table) => (
                    <div key={table.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <p className="font-semibold text-slate-900">{table.name}</p>
                      <p className="text-slate-600">{table._count.guests}/{table.capacity} seated</p>
                      {table.hostName ? <p className="text-slate-500">Host: {table.hostName}</p> : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Unassigned Guests */}
              {unassignedGuests.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">
                    Unassigned Guests ({unassignedGuests.length})
                  </h2>
                  <div className="space-y-2">
                    {unassignedGuests.map((guest) => (
                      <UnassignedGuestRow
                        key={guest.id}
                        guest={guest}
                        tables={tables}
                        onAssign={(tableId) => assignGuestToTable(guest.id, tableId)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  All guests are currently assigned to tables.
                </div>
              )}
            </>
          )}
        </>
      )}

      {detailTable && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-0 sm:items-stretch">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-300 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">TableLink Studio</p>
                <h2 className="text-xl font-bold text-slate-900">
                  {detailTable.tableNumber != null ? `#${detailTable.tableNumber} ` : ""}
                  {detailTable.name}
                </h2>
                <p className="text-xs text-slate-500">
                  UID: {detailTable.tableUid ?? "Unavailable"} · Public Code: {detailTable.publicCode ?? "Unavailable"}
                </p>
              </div>
              <button
                onClick={() => {
                  setDetailTable(null);
                  setTableDetail(null);
                  setTableEmailLogs([]);
                  setDetailError(null);
                }}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {detailError ? (
              <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{detailError}</div>
            ) : null}

            {detailLoading || !tableDetail ? (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">Loading table details...</div>
            ) : (
              <div className="space-y-4">
                <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Table status</p>
                      <p className="text-sm font-semibold text-slate-900">{tableDetail.status ?? "DRAFT"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void toggleTableLock()}
                        disabled={detailBusyAction !== null}
                        className="rounded border border-violet-300 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                      >
                        {tableDetail.status === "LOCKED" ? "Unlock Table" : "Lock Table"}
                      </button>
                      <button
                        onClick={() => void syncTableSeats()}
                        disabled={detailBusyAction !== null}
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                      >
                        Sync Seats
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Host Access</h3>
                  <p className="mt-1 text-xs text-slate-500">Issue or revoke host access tokens for this table.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      type="email"
                      value={hostAccessEmail}
                      onChange={(event) => setHostAccessEmail(event.target.value)}
                      placeholder="host@example.org"
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => void requestHostAccessToken()}
                      disabled={detailBusyAction !== null}
                      className="rounded bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      Issue Token
                    </button>
                    <button
                      onClick={() => void revokeHostAccessTokens()}
                      disabled={detailBusyAction !== null}
                      className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Revoke Active
                    </button>
                  </div>
                  {hostAccessToken ? (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Token: {hostAccessToken.token}
                      <br />
                      Expires: {new Date(hostAccessToken.expiresAt).toLocaleString()}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-lg border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Guest Invites</h3>
                  <p className="mt-1 text-xs text-slate-500">Create invite links and monitor invite lifecycle.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="guest@example.org"
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={invitePhone}
                      onChange={(event) => setInvitePhone(event.target.value)}
                      placeholder="Guest phone"
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={inviteSeatId}
                      onChange={(event) => setInviteSeatId(event.target.value)}
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">No seat preference</option>
                      {tableDetail.seats.map((seat) => (
                        <option key={seat.id} value={seat.id}>
                          Seat {seat.seatNumber} ({seat.status})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void createGuestInvite()}
                      disabled={detailBusyAction !== null}
                      className="rounded bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      Create Invite
                    </button>
                  </div>
                  <div className="mt-3 max-h-36 overflow-auto rounded border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-2 py-1 text-left">Created</th>
                          <th className="px-2 py-1 text-left">Contact</th>
                          <th className="px-2 py-1 text-left">Seat</th>
                          <th className="px-2 py-1 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableDetail.guestInvites.length === 0 ? (
                          <tr>
                            <td className="px-2 py-2 text-slate-500" colSpan={4}>No invites yet.</td>
                          </tr>
                        ) : (
                          tableDetail.guestInvites.map((invite) => (
                            <tr key={invite.id}>
                              <td className="px-2 py-1 text-slate-700">{new Date(invite.createdAt).toLocaleString()}</td>
                              <td className="px-2 py-1 text-slate-700">{invite.inviteEmail ?? invite.invitePhone ?? "-"}</td>
                              <td className="px-2 py-1 text-slate-700">{invite.seatId ? "Assigned" : "Any"}</td>
                              <td className="px-2 py-1 font-semibold text-slate-800">{invite.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Seat Roster Controls</h3>
                  <p className="mt-1 text-xs text-slate-500">Assign and clear seats from a single table workflow.</p>
                  <div className="mt-3 max-h-72 overflow-auto rounded border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-2 py-1 text-left">Seat</th>
                          <th className="px-2 py-1 text-left">Status</th>
                          <th className="px-2 py-1 text-left">Guest</th>
                          <th className="px-2 py-1 text-left">Assign</th>
                          <th className="px-2 py-1 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableDetail.seats.map((seat) => {
                          const selectedGuestId = seatAssignmentMap[seat.id] ?? "";
                          const guestName = seat.guest
                            ? `${seat.guest.firstName ?? seat.guest.constituent?.firstName ?? ""} ${seat.guest.lastName ?? seat.guest.constituent?.lastName ?? ""}`.trim() || "Assigned"
                            : "Open";
                          return (
                            <tr key={seat.id}>
                              <td className="px-2 py-1 text-slate-700">Seat {seat.seatNumber}</td>
                              <td className="px-2 py-1 font-semibold text-slate-800">{seat.status}</td>
                              <td className="px-2 py-1 text-slate-700">{guestName}</td>
                              <td className="px-2 py-1">
                                <select
                                  value={selectedGuestId}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setSeatAssignmentMap((previous) => ({ ...previous, [seat.id]: value }));
                                  }}
                                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                                >
                                  <option value="">Select unassigned guest</option>
                                  {unassignedGuests.map((guest) => (
                                    <option key={guest.id} value={guest.id}>
                                      {(guest.firstName ?? guest.constituent?.firstName ?? "").trim()} {(guest.lastName ?? guest.constituent?.lastName ?? "").trim()}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-1">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => void assignSeatGuest(seat.id)}
                                    disabled={!selectedGuestId || detailBusyAction !== null}
                                    className="rounded bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                                  >
                                    Assign
                                  </button>
                                  <button
                                    onClick={() => void clearSeatGuest(seat.id)}
                                    disabled={!seat.guest || detailBusyAction !== null}
                                    className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Email Status</h3>
                  <p className="mt-1 text-xs text-slate-500">Delivery log entries related to this table.</p>
                  <div className="mt-3 max-h-48 overflow-auto rounded border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-2 py-1 text-left">Time</th>
                          <th className="px-2 py-1 text-left">Type</th>
                          <th className="px-2 py-1 text-left">Recipient</th>
                          <th className="px-2 py-1 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableEmailLogs.length === 0 ? (
                          <tr>
                            <td className="px-2 py-2 text-slate-500" colSpan={4}>No email log entries yet.</td>
                          </tr>
                        ) : (
                          tableEmailLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="px-2 py-1 text-slate-700">{new Date(log.createdAt).toLocaleString()}</td>
                              <td className="px-2 py-1 text-slate-700">{log.type}</td>
                              <td className="px-2 py-1 text-slate-700">{log.recipientEmail}</td>
                              <td className="px-2 py-1 font-semibold text-slate-800">{log.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Table Modal */}
      {showNewTableModal && (
        <NewTableModal
          onClose={() => setShowNewTableModal(false)}
          onCreate={createTable}
        />
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <EditTableModal
          table={editingTable}
          onClose={() => setEditingTable(null)}
          onUpdate={updateTable}
        />
      )}

      {pendingDeleteTable && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-table-title">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Permanent table removal</p>
            <h2 id="delete-table-title" className="mt-1 text-xl font-bold text-slate-950">
              Delete {pendingDeleteTable.tableNumber != null ? `Table ${pendingDeleteTable.tableNumber}` : pendingDeleteTable.name}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The table and its seat layout will be removed. Its {pendingDeleteTable._count.guests} assigned guest{pendingDeleteTable._count.guests === 1 ? "" : "s"} will stay on the event roster and become unassigned.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteTable(null)}
                disabled={deletingTable}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Keep table
              </button>
              <button
                type="button"
                onClick={() => void deleteTable()}
                disabled={deletingTable}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {deletingTable ? "Deleting…" : "Delete and unassign guests"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FLOOR_WIDTH = 1040;
const FLOOR_HEIGHT = 650;
const FLOOR_TABLE_WIDTH = 138;
const FLOOR_TABLE_HEIGHT = 112;
const FLOOR_GRID = 20;

function suggestedFloorPosition(index: number) {
  const columns = 6;
  return {
    xPosition: 30 + (index % columns) * 165,
    yPosition: 105 + Math.floor(index / columns) * 145,
  };
}

function clampFloorPosition(value: number, maximum: number): number {
  return Math.max(20, Math.min(maximum, Math.round(value / FLOOR_GRID) * FLOOR_GRID));
}

/** Interactive, persisted venue diagram for table placement and night-of orientation. */
function FloorPlanBoard({
  tables,
  onSavePositions,
  onOpenTable,
}: {
  tables: Table[];
  onSavePositions: (positions: Array<{ id: string; xPosition: number; yPosition: number }>) => Promise<void>;
  onOpenTable: (table: Table) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { xPosition: number; yPosition: number }>>({});
  const dragRef = useRef<{ id: string; startX: number; startY: number; xPosition: number; yPosition: number } | null>(null);
  const [movingTableId, setMovingTableId] = useState<string | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => {
    setPositions(Object.fromEntries(tables.map((table, index) => {
      const stored = table.xPosition || table.yPosition
        ? { xPosition: table.xPosition, yPosition: table.yPosition }
        : suggestedFloorPosition(index);
      return [table.id, stored];
    })));
  }, [tables]);

  function startMove(event: ReactPointerEvent<HTMLButtonElement>, table: Table) {
    if (event.button !== 0) return;
    const position = positions[table.id] ?? suggestedFloorPosition(tables.indexOf(table));
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: table.id, startX: event.clientX, startY: event.clientY, ...position };
    setMovingTableId(table.id);
  }

  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const xPosition = clampFloorPosition(drag.xPosition + event.clientX - drag.startX, FLOOR_WIDTH - FLOOR_TABLE_WIDTH - 20);
    const yPosition = clampFloorPosition(drag.yPosition + event.clientY - drag.startY, FLOOR_HEIGHT - FLOOR_TABLE_HEIGHT - 20);
    setPositions((current) => ({ ...current, [drag.id]: { xPosition, yPosition } }));
  }

  async function finishMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const position = {
      xPosition: clampFloorPosition(drag.xPosition + event.clientX - drag.startX, FLOOR_WIDTH - FLOOR_TABLE_WIDTH - 20),
      yPosition: clampFloorPosition(drag.yPosition + event.clientY - drag.startY, FLOOR_HEIGHT - FLOOR_TABLE_HEIGHT - 20),
    };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setMovingTableId(null);
    setPositions((current) => ({ ...current, [drag.id]: position }));
    await onSavePositions([{ id: drag.id, ...position }]);
  }

  async function autoArrange() {
    const next = tables.map((table, index) => ({ id: table.id, ...suggestedFloorPosition(index) }));
    setPositions(Object.fromEntries(next.map(({ id, ...position }) => [id, position])));
    setSavingLayout(true);
    await onSavePositions(next);
    setSavingLayout(false);
  }

  const assigned = tables.reduce((sum, table) => sum + table._count.guests, 0);
  const capacity = tables.reduce((sum, table) => sum + table.capacity, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-bold text-slate-900">Venue floor plan</h2><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Saved layout</span></div>
          <p className="mt-1 text-xs text-slate-500">Drag tables onto the room grid. Positions snap to 20 pixels and save when released.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{tables.length} tables · {assigned}/{capacity} seats</span>
          <button type="button" disabled={savingLayout} onClick={() => void autoArrange()} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50">{savingLayout ? "Arranging…" : "Auto-arrange"}</button>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Print plan</button>
        </div>
      </header>

      <div className="overflow-x-auto bg-slate-100 p-3 sm:p-4">
        <div ref={canvasRef} className="relative mx-auto overflow-hidden border border-slate-300 bg-white shadow-inner" style={{ width: FLOOR_WIDTH, height: FLOOR_HEIGHT, backgroundImage: "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)", backgroundSize: `${FLOOR_GRID}px ${FLOOR_GRID}px` }}>
          <div className="absolute left-5 right-5 top-5 flex h-14 items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Stage / presentation wall</div>
          <div className="absolute bottom-4 left-4 rounded border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Main entrance</div>
          {tables.map((table, index) => {
            const position = positions[table.id] ?? suggestedFloorPosition(index);
            const usedSeats = table._count.guests;
            const overCapacity = usedSeats > table.capacity;
            const openSeats = Math.max(0, table.capacity - usedSeats);
            return (
              <button
                key={table.id}
                type="button"
                onPointerDown={(event) => startMove(event, table)}
                onPointerMove={move}
                onPointerUp={(event) => void finishMove(event)}
                onPointerCancel={(event) => void finishMove(event)}
                onDoubleClick={() => onOpenTable(table)}
                className={`absolute touch-none select-none p-2 text-left shadow-md outline-none transition-shadow focus:ring-2 focus:ring-violet-500 ${table.shape === "round" ? "rounded-[32px]" : table.shape === "square" ? "rounded-md" : "rounded-xl"} ${movingTableId === table.id ? "z-20 cursor-grabbing shadow-xl ring-2 ring-violet-500" : "z-10 cursor-grab hover:shadow-lg"} ${overCapacity ? "border-2 border-rose-500 bg-rose-50" : table.isSponsored ? "border-2 border-violet-400 bg-violet-50" : "border border-slate-300 bg-white"}`}
                style={{ left: position.xPosition, top: position.yPosition, width: FLOOR_TABLE_WIDTH, height: FLOOR_TABLE_HEIGHT }}
                aria-label={`${table.name}, ${usedSeats} of ${table.capacity} seats. Drag to move; double click for TableLink.`}
              >
                <span className="block truncate text-center text-[10px] font-bold uppercase tracking-wide text-violet-700">{table.tableNumber != null ? `Table ${table.tableNumber}` : "Table"}</span>
                <strong className="mt-1 block truncate text-center text-sm text-slate-950">{table.name}</strong>
                <span className={`mt-1 block text-center text-[11px] font-semibold ${overCapacity ? "text-rose-700" : openSeats === 0 ? "text-slate-600" : "text-emerald-700"}`}>{usedSeats}/{table.capacity} seated{openSeats ? ` · ${openSeats} open` : ""}</span>
                <span className="mt-1 block truncate text-center text-[10px] text-slate-500">{table.hostName ? `Host: ${table.hostName}` : "Host needed"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500"><span>Tip: double-click a table for seats, host access, invitations, and email history.</span><span>Round, square, and rectangular table shapes are preserved.</span></footer>
    </section>
  );
}

/** TableCard component - displays a single table with guest list */
function TableCard({
  table,
  onEdit,
  onOpenDetails,
  onDelete,
  onUnassignGuest,
}: {
  table: Table;
  onEdit: () => void;
  onOpenDetails: () => void;
  onDelete: () => void;
  onUnassignGuest: (guestId: string) => void;
}) {
  const isOverCapacity = table._count.guests > table.capacity;
  const hasOpenSeats = table._count.guests < table.capacity;

  return (
    <div className={`bg-white rounded-lg border p-4 ${table.isSponsored ? "border-violet-300 ring-1 ring-violet-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {table.tableNumber != null && (
              <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">#{table.tableNumber}</span>
            )}
            <h3 className="text-base font-bold text-gray-900">{table.name}</h3>
            {table.isSponsored && (
              <span className="text-xs font-semibold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">Sponsored</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {table._count.guests} / {table.capacity} seats
            {table.shape !== "round" && <> · <span className="capitalize">{table.shape}</span></>}
          </p>
          {table.hostName && (
            <p className="text-xs text-gray-400 mt-0.5">Host: {table.hostName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenDetails}
            className="text-xs text-slate-600 hover:text-slate-800 font-medium"
          >
            TableLink
          </button>
          <button
            onClick={onEdit}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-600 hover:text-red-700 font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      {isOverCapacity && (
        <div className="bg-red-50 border border-red-200 rounded px-2 py-1 mb-2">
          <p className="text-xs text-red-700 font-medium">⚠️ Over capacity</p>
        </div>
      )}

      {hasOpenSeats && (
        <div className="bg-green-50 border border-green-200 rounded px-2 py-1 mb-2">
          <p className="text-xs text-green-700 font-medium">
            ✓ {table.capacity - table._count.guests} open seat{table.capacity - table._count.guests !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {table.notes && (
        <div className="bg-gray-50 rounded px-2 py-1 mb-3">
          <p className="text-xs text-gray-600">{table.notes}</p>
        </div>
      )}

      {/* Guest List */}
      <div className="space-y-1">
        {table.guests.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No guests assigned</p>
        ) : (
          table.guests.map((guest) => (
            <div
              key={guest.id}
              className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">
                  {guest.firstName || guest.constituent?.firstName || "—"}{" "}
                  {guest.lastName || guest.constituent?.lastName || ""}
                </p>
                {guest.checkedIn && (
                  <span className="text-xs text-green-600">✓ Checked in</span>
                )}
              </div>
              <button
                onClick={() => onUnassignGuest(guest.id)}
                className="text-xs text-gray-400 hover:text-red-600 ml-2"
                title="Unassign from table"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** UnassignedGuestRow - row for assigning a guest to a table */
function UnassignedGuestRow({
  guest,
  tables,
  onAssign,
}: {
  guest: Guest;
  tables: Table[];
  onAssign: (tableId: string) => void;
}) {
  const [selectedTableId, setSelectedTableId] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded bg-gray-50 px-3 py-2 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {guest.firstName || guest.constituent?.firstName || "—"}{" "}
          {guest.lastName || guest.constituent?.lastName || ""}
        </p>
        {guest.email && <p className="text-xs text-gray-500 truncate">{guest.email}</p>}
      </div>
      <select
        value={selectedTableId}
        onChange={(e) => setSelectedTableId(e.target.value)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm sm:w-auto sm:min-w-64 sm:py-1"
      >
        <option value="">Assign to table...</option>
        {tables.map((t) => {
          const isFull = t._count.guests >= t.capacity;
          return (
          <option key={t.id} value={t.id} disabled={isFull}>
            {t.tableNumber != null ? `#${t.tableNumber} · ` : ""}{t.name} ({t._count.guests}/{t.capacity}){isFull ? " — Full" : ""}
          </option>
          );
        })}
      </select>
      <button
        onClick={() => {
          if (selectedTableId) {
            onAssign(selectedTableId);
            setSelectedTableId("");
          }
        }}
        disabled={!selectedTableId}
        className="w-full rounded bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-1"
      >
        Assign
      </button>
    </div>
  );
}

/** NewTableModal - create a new table */
function NewTableModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, capacity: number, notes?: string, tableNumber?: number, isSponsored?: boolean, hostName?: string, shape?: string) => void;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(10);
  const [notes, setNotes] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [isSponsored, setIsSponsored] = useState(false);
  const [hostName, setHostName] = useState("");
  const [shape, setShape] = useState("round");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Table</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Table Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Table 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Table # (auto if blank)
              </label>
              <input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min="1"
                max="9999"
                placeholder="e.g. 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Capacity *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                min="1"
                max="500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Shape</label>
              <select
                value={shape}
                onChange={(e) => setShape(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                <option value="round">Round</option>
                <option value="rectangular">Rectangular</option>
                <option value="square">Square</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Host Name (optional)
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Primary host or donor name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VIP table, sponsor table, etc."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isSponsored"
              type="checkbox"
              checked={isSponsored}
              onChange={(e) => setIsSponsored(e.target.checked)}
              className="w-4 h-4 text-violet-600 border-gray-300 rounded"
            />
            <label htmlFor="isSponsored" className="text-sm font-semibold text-gray-700 cursor-pointer">
              Sponsored Table
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                onCreate(
                  name.trim(),
                  capacity,
                  notes.trim() || undefined,
                  tableNumber ? Number(tableNumber) : undefined,
                  isSponsored,
                  hostName.trim() || undefined,
                  shape,
                );
              }
            }}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            Create Table
          </button>
        </div>
      </div>
    </div>
  );
}

/** EditTableModal - edit existing table */
function EditTableModal({
  table,
  onClose,
  onUpdate,
}: {
  table: Table;
  onClose: () => void;
  onUpdate: (tableId: string, name: string, capacity: number, notes?: string, tableNumber?: number, isSponsored?: boolean, hostName?: string, shape?: string) => void;
}) {
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(table.capacity);
  const [notes, setNotes] = useState(table.notes || "");
  const [tableNumber, setTableNumber] = useState(table.tableNumber ? String(table.tableNumber) : "");
  const [isSponsored, setIsSponsored] = useState(table.isSponsored);
  const [hostName, setHostName] = useState(table.hostName || "");
  const [shape, setShape] = useState(table.shape || "round");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Table</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Table Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Table # *
              </label>
              <input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min="1"
                max="9999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Capacity *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                min="1"
                max="500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Shape</label>
              <select
                value={shape}
                onChange={(e) => setShape(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              >
                <option value="round">Round</option>
                <option value="rectangular">Rectangular</option>
                <option value="square">Square</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Host Name (optional)
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="editIsSponsored"
              type="checkbox"
              checked={isSponsored}
              onChange={(e) => setIsSponsored(e.target.checked)}
              className="w-4 h-4 text-violet-600 border-gray-300 rounded"
            />
            <label htmlFor="editIsSponsored" className="text-sm font-semibold text-gray-700 cursor-pointer">
              Sponsored Table
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                onUpdate(
                  table.id,
                  name.trim(),
                  capacity,
                  notes.trim() || undefined,
                  tableNumber ? Number(tableNumber) : undefined,
                  isSponsored,
                  hostName.trim() || undefined,
                  shape,
                );
              }
            }}
            disabled={!name.trim() || !tableNumber || Number(tableNumber) < 1 || Number(tableNumber) > 9999}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            Update Table
          </button>
        </div>
      </div>
    </div>
  );
}

