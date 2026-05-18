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
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
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
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

type WorkspaceView = "calendar" | "list" | "split";
type SortBy = "startTime" | "client" | "appointmentType" | "status" | "staff" | "location";
type SortDirection = "asc" | "desc";

/** Returns YYYY-MM-DD in local-friendly format for date filter inputs. */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

  const [filters, setFilters] = useState<AppointmentFilters>(() => {
    const today = new Date();
    const nextThirtyDays = new Date(today);
    nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);

    return {
      search: "",
      status: "",
      appointmentType: "",
      assignedStaffId: "",
      dateFrom: toDateInputValue(today),
      dateTo: toDateInputValue(nextThirtyDays),
      location: "",
    };
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
  const [pendingCalendarAction, setPendingCalendarAction] = useState<{
    title: string;
    description: string;
    apply: () => Promise<void>;
    revert: () => void;
  } | null>(null);
  const [applyingCalendarAction, setApplyingCalendarAction] = useState(false);

  const isPopoutTab = searchParams.get("popout") === "1";

  /** Loads static selection sources (clients + staff) once for editor/filter controls. */
  const loadSelectionSources = useCallback(async () => {
    try {
      const [clients, staff] = await Promise.all([
        apiFetch<ClientOption[]>("/api/compassion/clients?limit=2500"),
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
        limit: "1200",
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

  const hasActiveFilters = Boolean(
    filters.search
    || filters.status
    || filters.appointmentType
    || filters.assignedStaffId
    || filters.dateFrom
    || filters.dateTo
    || filters.location,
  );

  /** Applies common date ranges quickly so staff can triage calendar load in one click. */
  function applyDateRangePreset(preset: "today" | "next7" | "next30") {
    const now = new Date();
    const today = toDateInputValue(now);

    if (preset === "today") {
      setFilters((current) => ({ ...current, dateFrom: today, dateTo: today }));
      return;
    }

    const end = new Date(now);
    end.setDate(end.getDate() + (preset === "next7" ? 7 : 30));
    const endString = toDateInputValue(end);

    setFilters((current) => ({ ...current, dateFrom: today, dateTo: endString }));
  }

  /** Resets all filters while keeping current sort and workspace view settings. */
  function clearFilters() {
    setFilters({
      search: "",
      status: "",
      appointmentType: "",
      assignedStaffId: "",
      dateFrom: "",
      dateTo: "",
      location: "",
    });
  }

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
  function onEventDrop(info: EventDropArg) {
    setPendingCalendarAction({
      title: "Confirm Reschedule",
      description: "Reschedule this appointment to the new date/time?",
      apply: async () => {
        await saveMovedAppointment({
          appointmentId: info.event.id,
          startIso: info.event.start?.toISOString() ?? "",
          endIso: info.event.end?.toISOString() ?? null,
        });
      },
      revert: info.revert,
    });
  }

  /** Handles calendar resize operations for duration changes. */
  function onEventResize(info: EventResizeDoneArg) {
    setPendingCalendarAction({
      title: "Confirm Duration Update",
      description: "Update appointment duration to match this resize?",
      apply: async () => {
        await saveMovedAppointment({
          appointmentId: info.event.id,
          startIso: info.event.start?.toISOString() ?? "",
          endIso: info.event.end?.toISOString() ?? null,
        });
      },
      revert: info.revert,
    });
  }

  /** Applies one pending calendar move/resize action after modal confirmation. */
  async function confirmCalendarAction() {
    if (!pendingCalendarAction) return;
    setApplyingCalendarAction(true);
    try {
      await pendingCalendarAction.apply();
      setPendingCalendarAction(null);
    } catch (requestError) {
      pendingCalendarAction.revert();
      setError(requestError instanceof Error ? requestError.message : "Could not update appointment timing.");
    } finally {
      setApplyingCalendarAction(false);
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
    <div className="space-y-4">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Compassion CRM", href: "/compassion/dashboard" },
          { label: "Appointments" },
        ]}
        statusLabel={loading ? "Loading" : "Working"}
        metadata={`${selectedCounts.total.toLocaleString()} visible appointments`}
        accentTone="blue"
        primaryAction={<WorkspaceRibbonButton label="Schedule Appointment" onClick={() => openCreateModal()} variant="primary" accentTone="blue" />}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="View">
          <WorkspaceRibbonButton label="Calendar" onClick={() => setView("calendar")} active={view === "calendar"} accentTone="blue" />
          <WorkspaceRibbonButton label="List" onClick={() => setView("list")} active={view === "list"} accentTone="blue" />
          <WorkspaceRibbonButton label="Split" onClick={() => setView("split")} active={view === "split"} accentTone="blue" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Calendar">
          <WorkspaceRibbonButton label="Full Screen" onClick={() => setFullscreenCalendar(true)} accentTone="blue" />
          <WorkspaceRibbonButton label="Popout" onClick={openCalendarPopoutTab} accentTone="blue" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Range">
          <WorkspaceRibbonButton label="Today" onClick={() => applyDateRangePreset("today")} accentTone="blue" />
          <WorkspaceRibbonButton label="Next 7" onClick={() => applyDateRangePreset("next7")} accentTone="blue" />
          <WorkspaceRibbonButton label="Next 30" onClick={() => applyDateRangePreset("next30")} accentTone="blue" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadAppointments()} accentTone="blue" />
          <WorkspaceRibbonButton label="Help" href="/help?scope=compassion&scopePath=/compassion/appointments" accentTone="blue" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

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

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Scheduling Workspace</h1>
            <p className="text-sm leading-6 text-gray-500">Calendar and spreadsheet list share the same live appointment filters.</p>
          </div>
          {refreshing && <span className="text-xs font-medium text-gray-500">Refreshing...</span>}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Clear Filters
          </button>
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
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
                <h2 className="text-base font-semibold text-gray-900">Appointment List</h2>
                <p className="text-xs text-gray-500">Spreadsheet-style review and quick status updates</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
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
                      <tr key={appointment.id} className="hover:bg-blue-50/60 align-top">
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
      {pendingCalendarAction && (
        <WorkspaceSetupModal
          title={pendingCalendarAction.title}
          subtitle="Calendar drag/resize actions require explicit confirmation before saving."
          onClose={() => {
            pendingCalendarAction.revert();
            setPendingCalendarAction(null);
          }}
          maxWidthClassName="max-w-lg"
        >
          <div className="px-6 pb-6 pt-14 space-y-5">
            <p className="text-sm text-gray-700">{pendingCalendarAction.description}</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  pendingCalendarAction.revert();
                  setPendingCalendarAction(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmCalendarAction()}
                disabled={applyingCalendarAction}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {applyingCalendarAction ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}
