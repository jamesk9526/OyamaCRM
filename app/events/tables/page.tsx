/**
 * EventTablesPage - manage table seating, capacity, and guest assignments.
 */
"use client";

import { useState, useEffect } from "react";
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
  isSponsored: boolean;
  hostName?: string;
  shape: string;
  guests: Guest[];
  _count: { guests: number };
}

/**
 * EventTablesPage provides operational table and seating management for Events CRM.
 */
export default function EventTablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [showNewTableModal, setShowNewTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  /** Load tables and unassigned guests for selected event */
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
  const openSeats = totalCapacity - totalAssigned;
  const overCapacityTables = tables.filter((t) => t._count.guests > t.capacity).length;

  /** Assign guest to table */
  async function assignGuestToTable(guestId: string, tableId: string | null) {
    try {
      await apiFetch(`/api/events/guests/${guestId}/assign-table`, {
        method: "PATCH",
        body: JSON.stringify({ tableId }),
      });
      loadData();
    } catch (err) {
      console.error("Failed to assign guest:", err);
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
      await apiFetch(`/api/events/${selectedEventId}/tables`, {
        method: "POST",
        body: JSON.stringify({ name, capacity, notes, tableNumber, isSponsored, hostName, shape }),
      });
      setShowNewTableModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to create table:", err);
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
      await apiFetch(`/api/events/tables/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, capacity, notes, tableNumber, isSponsored, hostName, shape }),
      });
      setEditingTable(null);
      loadData();
    } catch (err) {
      console.error("Failed to update table:", err);
    }
  }

  /** Delete table */
  async function deleteTable(tableId: string) {
    if (!confirm("Delete this table? Guests will be unassigned.")) return;
    try {
      await apiFetch(`/api/events/tables/${tableId}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Failed to delete table:", err);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tables & Seating</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage table assignments, capacity, and guest seating for events
        </p>
      </div>

      {/* Event Selector */}
      <div className="mb-6">
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
              <p className="text-2xl font-bold text-amber-600 mt-1">{totalCapacity}</p>
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

          {/* Actions */}
          <div className="mb-6">
            <button
              onClick={() => setShowNewTableModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
            >
              + Create Table
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              Loading tables...
            </div>
          ) : (
            <>
              {/* Tables Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {tables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    onEdit={() => setEditingTable(table)}
                    onDelete={() => deleteTable(table.id)}
                    onUnassignGuest={(guestId) => assignGuestToTable(guestId, null)}
                  />
                ))}
              </div>

              {/* Unassigned Guests */}
              {unassignedGuests.length > 0 && (
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
              )}
            </>
          )}
        </>
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
    </div>
  );
}

/** TableCard component - displays a single table with guest list */
function TableCard({
  table,
  onEdit,
  onDelete,
  onUnassignGuest,
}: {
  table: Table;
  onEdit: () => void;
  onDelete: () => void;
  onUnassignGuest: (guestId: string) => void;
}) {
  const isOverCapacity = table._count.guests > table.capacity;
  const hasOpenSeats = table._count.guests < table.capacity;

  return (
    <div className={`bg-white rounded-lg border p-4 ${table.isSponsored ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {table.tableNumber != null && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">#{table.tableNumber}</span>
            )}
            <h3 className="text-base font-bold text-gray-900">{table.name}</h3>
            {table.isSponsored && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Sponsored</span>
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
            onClick={onEdit}
            className="text-xs text-amber-600 hover:text-amber-700 font-medium"
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
    <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded">
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
        className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
      >
        <option value="">Assign to table...</option>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t._count.guests}/{t.capacity})
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (selectedTableId) {
            onAssign(selectedTableId);
            setSelectedTableId("");
          }
        }}
        disabled={!selectedTableId}
        className="px-3 py-1 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="grid grid-cols-2 gap-3">
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
                Table # (optional)
              </label>
              <input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min="1"
                placeholder="e.g. 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Capacity *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                min="1"
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
              className="w-4 h-4 text-amber-600 border-gray-300 rounded"
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
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
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
          <div className="grid grid-cols-2 gap-3">
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
                Table # (optional)
              </label>
              <input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Capacity *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                min="1"
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
              className="w-4 h-4 text-amber-600 border-gray-300 rounded"
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
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            Update Table
          </button>
        </div>
      </div>
    </div>
  );
}
