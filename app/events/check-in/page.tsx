/**
 * EventCheckInPage - EventSTUDIO Check-In Studio with scan/search/table/walk-in/replacement modes.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

type StudioTab = "search" | "scan" | "tables" | "walkin" | "replacement" | "exceptions";

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
  checkedInAt?: string | null;
  checkinCode?: string;
  source?: string;
  tableId?: string | null;
  table?: { id: string; name: string } | null;
  seat?: { id: string; seatNumber: number } | null;
}

interface EventTable {
  id: string;
  name: string;
  tableNumber?: number | null;
  capacity: number;
  _count?: { guests: number };
  guests?: Guest[];
}

interface CheckInLiveCounts {
  expected: number;
  checkedIn: number;
  walkIns: number;
  replacements: number;
  openExceptions: number;
  attendanceRate: number;
}

interface CheckInException {
  id: string;
  guestName?: string | null;
  claimedTable?: string | null;
  claimedEmail?: string | null;
  claimedPhone?: string | null;
  issueType: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  notes?: string | null;
  createdAt: string;
}

interface CheckInRecordResponse {
  id: string;
  status: "CHECKED_IN" | "DUPLICATE_ATTEMPT" | "REVERSED" | "NEEDS_REVIEW";
}

const DEFAULT_COUNTS: CheckInLiveCounts = {
  expected: 0,
  checkedIn: 0,
  walkIns: 0,
  replacements: 0,
  openExceptions: 0,
  attendanceRate: 0,
};

export default function EventCheckInPage() {
  const params = useParams<{ eventId?: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const workspaceEventId = params.eventId ?? searchParams.get("eventId") ?? "";
  const eventScoped = workspaceEventId.length > 0;

  useEffect(() => {
    if (!eventScoped) {
      router.replace("/events/events");
    }
  }, [eventScoped, router]);

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(workspaceEventId);
  const [activeTab, setActiveTab] = useState<StudioTab>("search");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchGuests, setSearchGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<EventTable[]>([]);
  const [liveCounts, setLiveCounts] = useState<CheckInLiveCounts>(DEFAULT_COUNTS);
  const [exceptions, setExceptions] = useState<CheckInException[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scanCode, setScanCode] = useState("");
  const [scanGuest, setScanGuest] = useState<Guest | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [walkInForm, setWalkInForm] = useState({ firstName: "", lastName: "", email: "", phone: "", tableId: "", notes: "" });
  const [replacementForm, setReplacementForm] = useState({ firstName: "", lastName: "", email: "", phone: "", tableId: "", notes: "" });
  const [exceptionForm, setExceptionForm] = useState({ guestName: "", issueType: "OTHER", claimedTable: "", claimedEmail: "", claimedPhone: "", notes: "" });

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workspaceEventId) setSelectedEventId(workspaceEventId);
  }, [workspaceEventId]);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await apiFetch<Event[]>("/api/events");
        const active = Array.isArray(data) ? data.filter((event) => event.active) : [];
        setEvents(active);
        if (!workspaceEventId && active.length > 0) {
          setSelectedEventId(active[0].id);
        }
      } catch (error) {
        console.error("Failed to load events:", error);
      }
    }
    void loadEvents();
  }, [workspaceEventId]);

  async function loadSearchGuests(query = searchQuery) {
    if (!selectedEventId) return;
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const data = await apiFetch<Guest[]>(`/api/events/${selectedEventId}/checkin/search${suffix}`);
    setSearchGuests(Array.isArray(data) ? data : []);
  }

  async function loadTables() {
    if (!selectedEventId) return;
    const data = await apiFetch<EventTable[]>(`/api/events/${selectedEventId}/tables`);
    setTables(Array.isArray(data) ? data : []);
  }

  async function loadLiveCounts() {
    if (!selectedEventId) return;
    const data = await apiFetch<CheckInLiveCounts>(`/api/events/${selectedEventId}/checkin/live-counts`);
    setLiveCounts(data ?? DEFAULT_COUNTS);
  }

  async function loadExceptions() {
    if (!selectedEventId) return;
    const data = await apiFetch<CheckInException[]>(`/api/events/${selectedEventId}/checkin/exceptions?status=OPEN`);
    setExceptions(Array.isArray(data) ? data : []);
  }

  async function refreshStudio() {
    if (!selectedEventId) return;
    setRefreshing(true);
    try {
      await Promise.all([loadSearchGuests(), loadTables(), loadLiveCounts(), loadExceptions()]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refreshStudio();
  }, [selectedEventId]);

  useEffect(() => {
    if (!autoRefresh || !selectedEventId) return;
    const timer = setInterval(() => {
      void Promise.all([loadLiveCounts(), loadExceptions()]);
    }, 12000);
    return () => clearInterval(timer);
  }, [autoRefresh, selectedEventId]);

  async function checkInGuest(guest: Guest, method: "NAME_SEARCH" | "TABLE_SEARCH" | "QR_SCAN" | "MANUAL") {
    if (!selectedEventId) return;
    setWarning(null);
    try {
      const record = await apiFetch<CheckInRecordResponse>(`/api/events/${selectedEventId}/checkin/guest/${guest.id}`, {
        method: "POST",
        body: JSON.stringify({ method }),
      });

      if (record.status === "DUPLICATE_ATTEMPT") {
        setWarning("Duplicate check-in attempt detected. This guest appears to already be checked in.");
      } else {
        setToast("Guest checked in.");
      }

      setSearchGuests((previous) =>
        previous.map((item) => (item.id === guest.id ? { ...item, checkedIn: true, checkedInAt: new Date().toISOString() } : item)),
      );
      if (scanGuest?.id === guest.id) {
        setScanGuest({ ...scanGuest, checkedIn: true, checkedInAt: new Date().toISOString() });
      }
      await Promise.all([loadLiveCounts(), loadTables()]);
    } catch (error) {
      console.error("Failed to check in guest:", error);
      setWarning("Unable to check in guest.");
    }
  }

  async function reverseGuestCheckIn(guest: Guest) {
    if (!selectedEventId) return;
    setWarning(null);
    try {
      await apiFetch(`/api/events/${selectedEventId}/checkin/guest/${guest.id}/reverse`, {
        method: "POST",
      });
      setToast("Check-in reversed.");
      setSearchGuests((previous) =>
        previous.map((item) => (item.id === guest.id ? { ...item, checkedIn: false, checkedInAt: null } : item)),
      );
      if (scanGuest?.id === guest.id) {
        setScanGuest({ ...scanGuest, checkedIn: false, checkedInAt: null });
      }
      await Promise.all([loadLiveCounts(), loadTables()]);
    } catch (error) {
      console.error("Failed to reverse check-in:", error);
      setWarning("Unable to reverse check-in for this guest.");
    }
  }

  async function verifyScanCode() {
    if (!selectedEventId || !scanCode.trim()) return;
    setScanLoading(true);
    setWarning(null);
    setToast(null);
    try {
      const guest = await apiFetch<Guest>(`/api/events/${selectedEventId}/checkin/verify-token`, {
        method: "POST",
        body: JSON.stringify({ code: scanCode.trim() }),
      });
      setScanGuest(guest);
    } catch {
      setScanGuest(null);
      setWarning("No guest found for that check-in code.");
    } finally {
      setScanLoading(false);
    }
  }

  async function bulkCheckInTable(table: EventTable) {
    if (!selectedEventId) return;
    setWarning(null);
    const candidateGuestIds = (table.guests ?? []).filter((guest) => !guest.checkedIn).map((guest) => guest.id);
    if (candidateGuestIds.length === 0) {
      setToast("No unchecked guests at this table.");
      return;
    }

    try {
      const response = await apiFetch<{ results: Array<{ guestId: string; status: string }> }>(
        `/api/events/${selectedEventId}/checkin/table/${table.id}/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ guestIds: candidateGuestIds }),
        },
      );
      const duplicateCount = response.results.filter((result) => result.status === "DUPLICATE_ATTEMPT").length;
      const checkedInCount = response.results.filter((result) => result.status === "CHECKED_IN").length;
      if (duplicateCount > 0) {
        setWarning(`${checkedInCount} checked in. ${duplicateCount} duplicate attempts were ignored.`);
      } else {
        setToast(`${checkedInCount} guests checked in from table ${table.name}.`);
      }
      await refreshStudio();
    } catch (error) {
      console.error("Failed bulk table check-in:", error);
      setWarning("Bulk check-in failed.");
    }
  }

  async function submitWalkIn() {
    if (!selectedEventId || !walkInForm.firstName.trim() || !walkInForm.lastName.trim()) {
      setWarning("Walk-in requires first and last name.");
      return;
    }
    try {
      await apiFetch(`/api/events/${selectedEventId}/checkin/walk-in`, {
        method: "POST",
        body: JSON.stringify({
          firstName: walkInForm.firstName.trim(),
          lastName: walkInForm.lastName.trim(),
          email: walkInForm.email.trim() || undefined,
          phone: walkInForm.phone.trim() || undefined,
          tableId: walkInForm.tableId || undefined,
          notes: walkInForm.notes.trim() || undefined,
        }),
      });
      setToast("Walk-in guest created and checked in.");
      setWalkInForm({ firstName: "", lastName: "", email: "", phone: "", tableId: "", notes: "" });
      await refreshStudio();
    } catch (error) {
      console.error("Failed to create walk-in:", error);
      setWarning("Unable to complete walk-in check-in.");
    }
  }

  async function submitReplacement() {
    if (!selectedEventId || !replacementForm.firstName.trim() || !replacementForm.lastName.trim()) {
      setWarning("Replacement guest requires first and last name.");
      return;
    }
    try {
      await apiFetch(`/api/events/${selectedEventId}/checkin/replacement`, {
        method: "POST",
        body: JSON.stringify({
          firstName: replacementForm.firstName.trim(),
          lastName: replacementForm.lastName.trim(),
          email: replacementForm.email.trim() || undefined,
          phone: replacementForm.phone.trim() || undefined,
          tableId: replacementForm.tableId || undefined,
          notes: replacementForm.notes.trim() || undefined,
        }),
      });
      setToast("Replacement guest created and checked in.");
      setReplacementForm({ firstName: "", lastName: "", email: "", phone: "", tableId: "", notes: "" });
      await refreshStudio();
    } catch (error) {
      console.error("Failed to create replacement guest:", error);
      setWarning("Unable to complete replacement guest check-in.");
    }
  }

  async function createException() {
    if (!selectedEventId || !exceptionForm.guestName.trim()) {
      setWarning("Exception entry requires a guest name.");
      return;
    }
    try {
      await apiFetch(`/api/events/${selectedEventId}/checkin/exceptions`, {
        method: "POST",
        body: JSON.stringify({
          guestName: exceptionForm.guestName.trim(),
          issueType: exceptionForm.issueType,
          claimedTable: exceptionForm.claimedTable.trim() || undefined,
          claimedEmail: exceptionForm.claimedEmail.trim() || undefined,
          claimedPhone: exceptionForm.claimedPhone.trim() || undefined,
          notes: exceptionForm.notes.trim() || undefined,
        }),
      });
      setToast("Exception queued for staff follow-up.");
      setExceptionForm({ guestName: "", issueType: "OTHER", claimedTable: "", claimedEmail: "", claimedPhone: "", notes: "" });
      await Promise.all([loadExceptions(), loadLiveCounts()]);
    } catch (error) {
      console.error("Failed to create exception:", error);
      setWarning("Unable to create exception.");
    }
  }

  async function resolveException(exceptionId: string) {
    if (!selectedEventId) return;
    await apiFetch(`/api/events/${selectedEventId}/checkin/exceptions/${exceptionId}/resolve`, { method: "POST" });
    await Promise.all([loadExceptions(), loadLiveCounts()]);
  }

  async function dismissException(exceptionId: string) {
    if (!selectedEventId) return;
    await apiFetch(`/api/events/${selectedEventId}/checkin/exceptions/${exceptionId}/dismiss`, { method: "POST" });
    await Promise.all([loadExceptions(), loadLiveCounts()]);
  }

  const sortedTables = useMemo(() => {
    return [...tables].sort((left, right) => {
      const leftNumber = left.tableNumber ?? Number.MAX_SAFE_INTEGER;
      const rightNumber = right.tableNumber ?? Number.MAX_SAFE_INTEGER;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
      return left.name.localeCompare(right.name);
    });
  }, [tables]);

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="Check-In Studio" />;
  }

  return (
    <div className="space-y-5 p-5 text-slate-100 sm:p-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: "Check-In Studio" },
        ]}
        statusLabel="Event Scoped"
        metadata={`${liveCounts.checkedIn}/${liveCounts.expected} checked in · ${liveCounts.openExceptions} open exceptions`}
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Modes">
          <WorkspaceRibbonButton label="Search" onClick={() => setActiveTab("search")} variant={activeTab === "search" ? "primary" : "secondary"} accentTone="purple" />
          <WorkspaceRibbonButton label="Scan" onClick={() => { setActiveTab("scan"); setTimeout(() => scanInputRef.current?.focus(), 40); }} variant={activeTab === "scan" ? "primary" : "secondary"} accentTone="purple" />
          <WorkspaceRibbonButton label="Tables" onClick={() => setActiveTab("tables")} variant={activeTab === "tables" ? "primary" : "secondary"} accentTone="purple" />
          <WorkspaceRibbonButton label="Walk-In" onClick={() => setActiveTab("walkin")} variant={activeTab === "walkin" ? "primary" : "secondary"} accentTone="purple" />
          <WorkspaceRibbonButton label="Replacement" onClick={() => setActiveTab("replacement")} variant={activeTab === "replacement" ? "primary" : "secondary"} accentTone="purple" />
          <WorkspaceRibbonButton label="Exceptions" onClick={() => setActiveTab("exceptions")} variant={activeTab === "exceptions" ? "primary" : "secondary"} accentTone="purple" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label={refreshing ? "Refreshing..." : "Refresh"} onClick={() => void refreshStudio()} accentTone="purple" />
          <WorkspaceRibbonButton label={autoRefresh ? "Auto On" : "Auto Off"} onClick={() => setAutoRefresh((previous) => !previous)} variant={autoRefresh ? "primary" : "secondary"} accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <div className="rounded-lg border border-violet-300/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
        Event lock is active for this route. Switch events from <Link href="/events/events" className="font-semibold underline">Event Registry</Link>.
      </div>

      {toast ? <div className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{toast}</div> : null}
      {warning ? <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{warning}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <MetricCard label="Expected" value={liveCounts.expected} color="text-slate-100" />
        <MetricCard label="Checked In" value={liveCounts.checkedIn} color="text-emerald-300" />
        <MetricCard label="Rate" value={`${liveCounts.attendanceRate}%`} color="text-violet-300" />
        <MetricCard label="Walk-Ins" value={liveCounts.walkIns} color="text-cyan-300" />
        <MetricCard label="Replacements" value={liveCounts.replacements} color="text-fuchsia-300" />
        <MetricCard label="Exceptions" value={liveCounts.openExceptions} color="text-amber-300" />
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-8 text-center text-slate-300">Loading Check-In Studio...</div>
      ) : activeTab === "search" ? (
        <section className="space-y-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">Fast search</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Name, email, phone, table, check-in code"
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <button
                onClick={() => void loadSearchGuests(searchQuery)}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Search
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {searchGuests.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-6 text-center text-slate-300">No guests found for this event/query.</div>
            ) : (
              searchGuests.map((guest) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  onCheckIn={() => void checkInGuest(guest, "NAME_SEARCH")}
                  onReverse={() => void reverseGuestCheckIn(guest)}
                />
              ))
            )}
          </div>
        </section>
      ) : activeTab === "scan" ? (
        <section className="max-w-2xl space-y-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">QR / code scan</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={scanInputRef}
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                placeholder="Scan or enter check-in code"
                className="w-full rounded-lg border-2 border-slate-600 bg-slate-950 px-3 py-2 font-mono text-lg tracking-wider text-slate-100"
              />
              <button
                onClick={() => void verifyScanCode()}
                disabled={scanLoading || !scanCode.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {scanLoading ? "Looking up..." : "Verify"}
              </button>
            </div>
          </div>

          {scanGuest ? (
            <GuestCard
              guest={scanGuest}
              onCheckIn={() => void checkInGuest(scanGuest, "QR_SCAN")}
              onReverse={() => void reverseGuestCheckIn(scanGuest)}
            />
          ) : null}
        </section>
      ) : activeTab === "tables" ? (
        <section className="space-y-3">
          {sortedTables.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-6 text-center text-slate-300">No tables found for this event.</div>
          ) : (
            sortedTables.map((table) => {
              const guestsAtTable = table.guests ?? [];
              const checkedIn = guestsAtTable.filter((guest) => guest.checkedIn).length;
              return (
                <div key={table.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{table.tableNumber != null ? `#${table.tableNumber} ` : ""}{table.name}</p>
                      <p className="text-xs text-slate-400">{checkedIn}/{guestsAtTable.length || table._count?.guests || 0} checked in</p>
                    </div>
                    <button
                      onClick={() => void bulkCheckInTable(table)}
                      className="rounded-lg border border-violet-400/50 px-3 py-1 text-xs font-semibold text-violet-200 hover:bg-violet-500/10"
                    >
                      Bulk Check-In
                    </button>
                  </div>
                  <div className="space-y-2">
                    {guestsAtTable.length === 0 ? (
                      <p className="text-xs text-slate-400">No guests assigned to this table yet.</p>
                    ) : (
                      guestsAtTable.map((guest) => (
                        <GuestCard
                          key={guest.id}
                          guest={guest}
                          compact
                          onCheckIn={() => void checkInGuest(guest, "TABLE_SEARCH")}
                          onReverse={() => void reverseGuestCheckIn(guest)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      ) : activeTab === "walkin" ? (
        <EntryForm
          title="Walk-In"
          description="Register and check in an unplanned attendee at the door."
          form={walkInForm}
          onChange={setWalkInForm}
          tables={sortedTables}
          actionLabel="Create Walk-In"
          onSubmit={() => void submitWalkIn()}
        />
      ) : activeTab === "replacement" ? (
        <EntryForm
          title="Replacement Guest"
          description="Replace an original attendee with a new guest and check them in immediately."
          form={replacementForm}
          onChange={setReplacementForm}
          tables={sortedTables}
          actionLabel="Create Replacement"
          onSubmit={() => void submitReplacement()}
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Create Exception</h2>
            <p className="mt-1 text-xs text-slate-400">Queue issues that need manager review during event-night operations.</p>
            <div className="mt-3 grid gap-2">
              <input value={exceptionForm.guestName} onChange={(event) => setExceptionForm((previous) => ({ ...previous, guestName: event.target.value }))} placeholder="Guest name" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
              <select value={exceptionForm.issueType} onChange={(event) => setExceptionForm((previous) => ({ ...previous, issueType: event.target.value }))} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm">
                <option value="NOT_FOUND">Not Found</option>
                <option value="DUPLICATE">Duplicate</option>
                <option value="WRONG_TABLE">Wrong Table</option>
                <option value="REPLACEMENT">Replacement</option>
                <option value="UNCONFIRMED">Unconfirmed</option>
                <option value="NO_TICKET">No Ticket</option>
                <option value="OTHER">Other</option>
              </select>
              <input value={exceptionForm.claimedTable} onChange={(event) => setExceptionForm((previous) => ({ ...previous, claimedTable: event.target.value }))} placeholder="Claimed table" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
              <input value={exceptionForm.claimedEmail} onChange={(event) => setExceptionForm((previous) => ({ ...previous, claimedEmail: event.target.value }))} placeholder="Claimed email" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
              <input value={exceptionForm.claimedPhone} onChange={(event) => setExceptionForm((previous) => ({ ...previous, claimedPhone: event.target.value }))} placeholder="Claimed phone" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
              <textarea value={exceptionForm.notes} onChange={(event) => setExceptionForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Notes" rows={3} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
              <button onClick={() => void createException()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">Queue Exception</button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Open Exceptions</h2>
            <div className="mt-3 space-y-2">
              {exceptions.length === 0 ? (
                <p className="text-sm text-slate-400">No open exceptions.</p>
              ) : (
                exceptions.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-600 bg-slate-900/60 p-3">
                    <p className="text-sm font-semibold text-slate-100">{item.guestName || "Unknown guest"}</p>
                    <p className="text-xs text-slate-400">{item.issueType} · {new Date(item.createdAt).toLocaleTimeString()}</p>
                    {item.notes ? <p className="mt-1 text-xs text-slate-300">{item.notes}</p> : null}
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => void resolveException(item.id)} className="rounded border border-emerald-400/50 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10">Resolve</button>
                      <button onClick={() => void dismissException(item.id)} className="rounded border border-slate-500 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700/50">Dismiss</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {!eventScoped ? (
        <div className="hidden">
          <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
            <option value="">Select event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function GuestCard({
  guest,
  onCheckIn,
  onReverse,
  compact = false,
}: {
  guest: Guest;
  onCheckIn: () => void;
  onReverse: () => void;
  compact?: boolean;
}) {
  const name = `${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim() || "Unnamed guest";
  return (
    <div className={`rounded-lg border p-3 ${guest.checkedIn ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-700 bg-slate-900/70"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`font-semibold text-slate-100 ${compact ? "text-sm" : "text-base"}`}>{name}</p>
          <p className="text-xs text-slate-400">
            {guest.email || guest.phone || "No contact"}
            {guest.table ? ` · ${guest.table.name}` : ""}
            {guest.seat ? ` · Seat ${guest.seat.seatNumber}` : ""}
          </p>
          {guest.checkinCode ? <p className="text-[11px] text-slate-500">Code: {guest.checkinCode}</p> : null}
        </div>
        <div className="flex gap-2">
          {guest.checkedIn ? (
            <button onClick={onReverse} className="rounded border border-slate-500 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700">Reverse</button>
          ) : (
            <button onClick={onCheckIn} className="rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700">Check In</button>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryForm({
  title,
  description,
  form,
  onChange,
  tables,
  actionLabel,
  onSubmit,
}: {
  title: string;
  description: string;
  form: { firstName: string; lastName: string; email: string; phone: string; tableId: string; notes: string };
  onChange: (next: { firstName: string; lastName: string; email: string; phone: string; tableId: string; notes: string }) => void;
  tables: EventTable[];
  actionLabel: string;
  onSubmit: () => void;
}) {
  return (
    <section className="max-w-3xl rounded-lg border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input value={form.firstName} onChange={(event) => onChange({ ...form, firstName: event.target.value })} placeholder="First name" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={form.lastName} onChange={(event) => onChange({ ...form, lastName: event.target.value })} placeholder="Last name" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} placeholder="Email" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <input value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} placeholder="Phone" className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm" />
        <select value={form.tableId} onChange={(event) => onChange({ ...form, tableId: event.target.value })} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm sm:col-span-2">
          <option value="">No table assignment</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>{table.tableNumber != null ? `#${table.tableNumber} ` : ""}{table.name}</option>
          ))}
        </select>
        <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} placeholder="Notes" rows={3} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm sm:col-span-2" />
      </div>
      <button onClick={onSubmit} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">{actionLabel}</button>
    </section>
  );
}
