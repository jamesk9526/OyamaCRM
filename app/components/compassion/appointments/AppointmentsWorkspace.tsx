// Compassion scheduling workspace with shared source-of-truth calendar and list views.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
  EventResizeDoneArg,
} from "@fullcalendar/core";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import AppointmentEditorModal from "./AppointmentEditorModal";
import {
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
  type AppointmentFilters,
  type ClientOption,
  type CompassionAppointmentRecord,
  type StaffOption,
} from "./types";
import {
  filterAppointments,
  formatDateTime,
  humanizeEnum,
  mapAppointmentsToEvents,
  sortAppointments,
} from "./appointmentUtils";

type WorkspaceView = "calendar" | "list" | "split";
type SortBy = "startTime" | "client" | "appointmentType" | "status" | "staff" | "location";
type SortDirection = "asc" | "desc";

/** Returns badge classes for appointment statuses used in list/calendar cards. */
function statusBadge(status: string): string {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  if (status === "CANCELLED") return "bg-red-100 text-red-700";
  if (status === "NO_SHOW") return "bg-amber-100 text-amber-700";
  if (status === "RESCHEDULED") return "bg-sky-100 text-sky-700";
  return "bg-blue-100 text-blue-700";
}

/** Renders compact flag pills for staff visibility of booking risk/context. */
function AppointmentFlags({ appointment }: { appointment: CompassionAppointmentRecord }) {
  const flags = appointment.flags;
  if (!flags) return null;

  const chips: string[] = [];
  if (flags.firstVisit) chips.push("First Visit");
  if (flags.followUpNeeded) chips.push("Follow-up Needed");
  if (flags.noShowRisk) chips.push(`No-Show Risk (${flags.noShowCount})`);
  if (flags.incompleteIntake) chips.push("Incomplete Intake");
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {chips.map((chip) => (
        <span key={chip} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
          {chip}
        </span>
      ))}
    </div>
  );
}

/** AppointmentsWorkspace provides full scheduling operations for office staff. */
export default function AppointmentsWorkspace() {
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<CompassionAppointmentRecord[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<WorkspaceView>("split");
  const [fullscreenCalendar, setFullscreenCalendar] = useState(false);

  const [filters, setFilters] = useState<AppointmentFilters>({
    search: "",
    status: "",
    appointmentType: "",
    assignedStaffId: "",
    dateFrom: "",
    dateTo: "",
    location: "",
  });

  const [sortBy, setSortBy] = useState<SortBy>("startTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    appointment: CompassionAppointmentRecord | null;
    initialStartTime: string | null;
  }>({
    open: false,
    mode: "create",
    appointment: null,
    initialStartTime: null,
  });

  const isPopoutTab = searchParams.get("popout") === "1";

  /** Loads static selection sources (clients + staff) once for editor/filter controls. */
  const loadSelectionSources = useCallback(async () => {
    try {
      const [clients, staff] = await Promise.all([
        apiFetch<ClientOption[]>("/api/compassion/clients?limit=500"),
        apiFetch<StaffOption[]>("/api/compassion/staff?active=true&limit=250"),
      ]);
      setClientOptions(Array.isArray(clients) ? clients : []);
      setStaffOptions(Array.isArray(staff) ? staff : []);
    } catch {
      setClientOptions([]);
      setStaffOptions([]);
    }
  }, []);

  /** Loads appointments using API filters so calendar/list stay on one source of truth. */
  const loadAppointments = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        limit: "600",
        sortBy,
        sortOrder: sortDirection,
      });

      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.appointmentType) params.set("appointmentType", filters.appointmentType);
      if (filters.assignedStaffId) params.set("assignedStaffId", filters.assignedStaffId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.location) params.set("location", filters.location);

      const next = await apiFetch<CompassionAppointmentRecord[]>(`/api/compassion/appointments?${params.toString()}`);
      setAppointments(Array.isArray(next) ? next : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, sortBy, sortDirection]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSelectionSources();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSelectionSources]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAppointments();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadAppointments]);

  useEffect(() => {
    if (searchParams.get("fullscreen") !== "1") return;
    setView("calendar");
    setFullscreenCalendar(true);
  }, [searchParams]);

  const filteredAppointments = useMemo(() => filterAppointments(appointments, filters), [appointments, filters]);
  const sortedAppointments = useMemo(
    () => sortAppointments(filteredAppointments, sortBy, sortDirection),
    [filteredAppointments, sortBy, sortDirection],
  );
  const calendarEvents = useMemo(() => mapAppointmentsToEvents(sortedAppointments), [sortedAppointments]);

  const selectedCounts = useMemo(() => {
    return {
      total: sortedAppointments.length,
      scheduled: sortedAppointments.filter((appointment) => appointment.status === "SCHEDULED").length,
      completed: sortedAppointments.filter((appointment) => appointment.status === "COMPLETED").length,
      noShow: sortedAppointments.filter((appointment) => appointment.status === "NO_SHOW").length,
    };
  }, [sortedAppointments]);

  /** Opens editor in create mode from toolbar or calendar slot selection. */
  function openCreateModal(initialStartTime?: string) {
    setEditorState({
      open: true,
      mode: "create",
      appointment: null,
      initialStartTime: initialStartTime ?? null,
    });
  }

  /** Opens editor in edit mode for one appointment. */
  function openEditModal(appointment: CompassionAppointmentRecord) {
    setEditorState({
      open: true,
      mode: "edit",
      appointment,
      initialStartTime: null,
    });
  }

  /** Finds one appointment from current state by identifier. */
  function getAppointmentById(appointmentId: string): CompassionAppointmentRecord | undefined {
    return appointments.find((appointment) => appointment.id === appointmentId);
  }

  /** Saves drag-drop or resize changes after confirmation and conflict validation. */
  async function saveMovedAppointment(args: {
    appointmentId: string;
    startIso: string;
    endIso: string | null;
  }) {
    const response = await apiFetchResponse(`/api/compassion/appointments/${args.appointmentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        startTime: args.startIso,
        endTime: args.endIso,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? `Failed to save change (${response.status})`);
    }

    await loadAppointments();
  }

  /** Handles calendar drag-drop move operations. */
  async function onEventDrop(info: EventDropArg) {
    const accepted = window.confirm("Reschedule this appointment to the new date/time?");
    if (!accepted) {
      info.revert();
      return;
    }

    try {
      await saveMovedAppointment({
        appointmentId: info.event.id,
        startIso: info.event.start?.toISOString() ?? "",
        endIso: info.event.end?.toISOString() ?? null,
      });
    } catch (requestError) {
      info.revert();
      setError(requestError instanceof Error ? requestError.message : "Could not reschedule appointment.");
    }
  }

  /** Handles calendar resize operations for duration changes. */
  async function onEventResize(info: EventResizeDoneArg) {
    const accepted = window.confirm("Update appointment duration to match this resize?");
    if (!accepted) {
      info.revert();
      return;
    }

    try {
      await saveMovedAppointment({
        appointmentId: info.event.id,
        startIso: info.event.start?.toISOString() ?? "",
        endIso: info.event.end?.toISOString() ?? null,
      });
    } catch (requestError) {
      info.revert();
      setError(requestError instanceof Error ? requestError.message : "Could not update appointment duration.");
    }
  }

  /** Opens editor when an appointment event is clicked. */
  function onEventClick(info: EventClickArg) {
    const appointment = getAppointmentById(info.event.id);
    if (!appointment) return;
    openEditModal(appointment);
  }

  /** Opens create editor when a date/time slot is selected in calendar views. */
  function onDateSelect(info: DateSelectArg) {
    openCreateModal(info.startStr);
  }

  /** Updates a list-row appointment status in one click. */
  async function quickStatusUpdate(appointmentId: string, status: string) {
    try {
      const response = await apiFetchResponse(`/api/compassion/appointments/${appointmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Failed to update status (${response.status})`);
      }
      await loadAppointments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update appointment status.");
    }
  }

  /** Renders event card content in calendar cells with status and staff context. */
  function renderEventContent(eventInfo: { event: { title: string; extendedProps: { appointment: CompassionAppointmentRecord } } }) {
    const appointment = eventInfo.event.extendedProps.appointment;
    return (
      <div className="text-[11px] leading-tight space-y-0.5">
        <div className="font-semibold truncate">{appointment.client.firstName} {appointment.client.lastName}</div>
        <div className="opacity-90 truncate">{humanizeEnum(appointment.appointmentType)}</div>
        <div className="opacity-80 truncate">{appointment.assignedStaff ? (appointment.assignedStaff.displayName ?? `${appointment.assignedStaff.firstName} ${appointment.assignedStaff.lastName}`.trim()) : "Unassigned"}</div>
      </div>
    );
  }

  /** Shared calendar renderer used for normal and fullscreen workspace modes. */
  function renderCalendar(events: EventInput[]) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
          }}
          buttonText={{
            today: "Today",
            timeGridDay: "Day",
            timeGridWeek: "Week",
            dayGridMonth: "Month",
            listWeek: "Agenda",
          }}
          nowIndicator
          allDaySlot={false}
          selectable
          editable
          eventResizableFromStart
          dayMaxEvents
          height={fullscreenCalendar ? "calc(100vh - 170px)" : 690}
          events={events}
          select={onDateSelect}
          eventClick={onEventClick}
          eventDrop={(info) => { void onEventDrop(info); }}
          eventResize={(info) => { void onEventResize(info); }}
          eventContent={renderEventContent}
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        />
      </div>
    );
  }

  /** Opens this scheduling workspace in a dedicated browser tab with calendar fullscreen enabled. */
  function openCalendarPopoutTab() {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("view", "calendar");
    nextUrl.searchParams.set("fullscreen", "1");
    nextUrl.searchParams.set("popout", "1");
    window.open(nextUrl.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Production scheduling workspace for staff calendar and appointment operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCalendarPopoutTab}
            className="px-3 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Open Calendar In New Tab
          </button>
          <button
            type="button"
            onClick={() => setFullscreenCalendar(true)}
            className="px-3 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Full Screen Calendar
          </button>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            + Schedule Appointment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500 font-medium">Visible Appointments</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">{selectedCounts.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500 font-medium">Scheduled</p>
          <p className="text-xl font-semibold text-blue-700 mt-1">{selectedCounts.scheduled}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500 font-medium">Completed</p>
          <p className="text-xl font-semibold text-emerald-700 mt-1">{selectedCounts.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500 font-medium">No-Show</p>
          <p className="text-xl font-semibold text-amber-700 mt-1">{selectedCounts.noShow}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setView("calendar")} className={`px-3 py-1.5 text-sm rounded ${view === "calendar" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>Calendar</button>
          <button type="button" onClick={() => setView("list")} className={`px-3 py-1.5 text-sm rounded ${view === "list" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>List</button>
          <button type="button" onClick={() => setView("split")} className={`px-3 py-1.5 text-sm rounded ${view === "split" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>Split</button>

          <div className="ml-auto flex items-center gap-2">
            {refreshing && <span className="text-xs text-gray-500">Refreshing…</span>}
            <button type="button" onClick={() => void loadAppointments()} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-700">Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search client, notes, staff, location"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />

          <select value={filters.appointmentType} onChange={(event) => setFilters((current) => ({ ...current, appointmentType: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All appointment types</option>
            {APPOINTMENT_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{humanizeEnum(type)}</option>)}
          </select>

          <select value={filters.assignedStaffId} onChange={(event) => setFilters((current) => ({ ...current, assignedStaffId: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All staff</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.fullName ?? staff.displayName ?? `${staff.firstName} ${staff.lastName}`}
              </option>
            ))}
          </select>

          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{humanizeEnum(status)}</option>)}
          </select>

          <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))} placeholder="Location / room" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />

          <div className="flex gap-2">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="startTime">Sort: Date/Time</option>
              <option value="client">Sort: Client</option>
              <option value="appointmentType">Sort: Type</option>
              <option value="status">Sort: Status</option>
              <option value="staff">Sort: Staff</option>
              <option value="location">Sort: Location</option>
            </select>
            <button type="button" onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">Loading appointments…</div>
      ) : sortedAppointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
          No appointments found for current filters.
        </div>
      ) : (
        <>
          {(view === "calendar" || view === "split") && renderCalendar(calendarEvents)}

          {(view === "list" || view === "split") && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date / Time</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Staff</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedAppointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(appointment.startTime)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{appointment.client.firstName} {appointment.client.lastName}</p>
                        <AppointmentFlags appointment={appointment} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{humanizeEnum(appointment.appointmentType)}</td>
                      <td className="px-4 py-3 text-gray-600">{appointment.assignedStaff ? (appointment.assignedStaff.displayName ?? `${appointment.assignedStaff.firstName} ${appointment.assignedStaff.lastName}`.trim()) : "Unassigned"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(appointment.status)}`}>
                          {humanizeEnum(appointment.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{appointment.location ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[260px]">
                        <div className="line-clamp-2">{appointment.notes ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => openEditModal(appointment)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-700">Edit</button>
                          <button type="button" onClick={() => void quickStatusUpdate(appointment.id, "COMPLETED")} className="text-xs px-2 py-1 border border-emerald-200 rounded hover:bg-emerald-50 text-emerald-700">Complete</button>
                          <button type="button" onClick={() => void quickStatusUpdate(appointment.id, "NO_SHOW")} className="text-xs px-2 py-1 border border-amber-200 rounded hover:bg-amber-50 text-amber-700">No-Show</button>
                          <button type="button" onClick={() => void quickStatusUpdate(appointment.id, "CANCELLED")} className="text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 text-red-700">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {fullscreenCalendar && (
        <div className="fixed inset-0 z-[75] bg-white p-4 sm:p-6 overflow-auto">
          <div className="max-w-[1800px] mx-auto space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Full Screen Scheduling Workspace</h2>
              <div className="flex items-center gap-2">
                {isPopoutTab && (
                  <button
                    type="button"
                    onClick={() => window.close()}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Close Tab
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFullscreenCalendar(false)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Exit Full Screen
                </button>
              </div>
            </div>
            {renderCalendar(calendarEvents)}
          </div>
        </div>
      )}

      <AppointmentEditorModal
        open={editorState.open}
        mode={editorState.mode}
        appointment={editorState.appointment}
        initialStartTime={editorState.initialStartTime}
        clientOptions={clientOptions}
        staffOptions={staffOptions}
        onClose={() => setEditorState({ open: false, mode: "create", appointment: null, initialStartTime: null })}
        onSaved={loadAppointments}
      />
    </div>
  );
}
