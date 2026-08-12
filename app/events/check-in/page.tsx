/**
 * EventCheckInPage - EventSTUDIO Check-In Studio with scan/search/table/walk-in/replacement modes.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RequireEventSelectionNotice from "@/app/components/events/RequireEventSelectionNotice";
import { apiFetch } from "@/app/lib/auth-client";

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
  paymentStatus?: "PAID" | "DUE" | "PENDING_CHECK" | "COMP" | "SPONSORED";
  rsvpStatus?: "PENDING" | "CONFIRMED" | "DECLINED" | "WAITLISTED" | "CANCELLED";
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
  const volunteerMode = searchParams.get("mode") === "volunteer";

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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      } else if (guest.paymentStatus === "DUE" || guest.paymentStatus === "PENDING_CHECK") {
        setWarning("Guest checked in. Payment is still marked due; route the order to the payment desk for follow-up.");
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
    const unpaidCount = (table.guests ?? []).filter((guest) => !guest.checkedIn && (guest.paymentStatus === "DUE" || guest.paymentStatus === "PENDING_CHECK")).length;
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
      if (unpaidCount > 0) {
        setWarning(`${checkedInCount} guests checked in. ${unpaidCount} ${unpaidCount === 1 ? "guest is" : "guests are"} still marked payment due.`);
      } else if (duplicateCount > 0) {
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

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const tabs: Array<{ id: StudioTab; label: string; secondary?: boolean }> = [
    { id: "search", label: "Guest search" },
    { id: "scan", label: "Scan code" },
    { id: "tables", label: "Tables" },
    { id: "walkin", label: "Walk-in", secondary: true },
    { id: "replacement", label: "Replacement", secondary: true },
    { id: "exceptions", label: `Exceptions${liveCounts.openExceptions ? ` (${liveCounts.openExceptions})` : ""}`, secondary: true },
  ];

  if (!eventScoped) {
    return <RequireEventSelectionNotice tool="Check-In Studio" />;
  }

  return (
    <main className="min-h-full bg-[#f5f5f5] p-4 text-[#242424] sm:p-6">
      <header className="border border-[#d1d1d1] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#616161]"><Link href="/events/events" className="font-semibold text-[#0f6cbd] hover:underline">Events</Link><span aria-hidden="true">/</span><span>Check-in</span>{volunteerMode ? <span className="bg-[#f2f7fc] px-2 py-0.5 font-semibold text-[#0f6cbd]">Volunteer mode</span> : null}</div>
            <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">{selectedEvent?.name ?? "Event check-in"}</h1>
            <p className="mt-1 text-sm text-[#616161]">{selectedEvent ? new Date(selectedEvent.startDate).toLocaleString() : "Loading event details…"} · This workspace is locked to one event.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAutoRefresh((value) => !value)} aria-pressed={autoRefresh} className="min-h-10 border border-[#d1d1d1] bg-white px-3 text-sm font-semibold hover:bg-[#f5f5f5]">Live updates {autoRefresh ? "on" : "off"}</button>
            <button type="button" onClick={() => void refreshStudio()} disabled={refreshing} className="min-h-10 border border-[#d1d1d1] bg-white px-3 text-sm font-semibold hover:bg-[#f5f5f5] disabled:text-[#a19f9d]">{refreshing ? "Refreshing…" : "Refresh"}</button>
            <Link href={volunteerMode ? `/events/${selectedEventId}/check-in` : `/events/${selectedEventId}/check-in?mode=volunteer`} className="inline-flex min-h-10 items-center bg-[#0f6cbd] px-4 text-sm font-semibold text-white hover:bg-[#115ea3]">{volunteerMode ? "Exit volunteer mode" : "Volunteer mode"}</Link>
          </div>
        </div>
      </header>

      <nav className="mt-4 overflow-x-auto border-b border-[#d1d1d1]" aria-label="Check-in modes"><div className="flex min-w-max" role="tablist">{tabs.filter((tab) => !volunteerMode || !tab.secondary).map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "scan") setTimeout(() => scanInputRef.current?.focus(), 40); }} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${activeTab === tab.id ? "border-[#0f6cbd] bg-white text-[#0f6cbd]" : "border-transparent text-[#424242] hover:bg-white"}`}>{tab.label}</button>)}</div></nav>

      <div aria-live="polite" className="mt-4 space-y-2">
        {toast ? <div className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{toast}</div> : null}
        {warning ? <div className="border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-950">{warning}</div> : null}
      </div>

      <div className={`mt-4 grid grid-cols-2 border border-[#d1d1d1] bg-white ${volunteerMode ? "sm:grid-cols-3" : "sm:grid-cols-3 xl:grid-cols-6"}`}>
        <MetricCard label="Expected" value={liveCounts.expected} />
        <MetricCard label="Checked in" value={liveCounts.checkedIn} accent />
        <MetricCard label="Arrival rate" value={`${liveCounts.attendanceRate}%`} accent />
        {!volunteerMode ? <MetricCard label="Walk-ins" value={liveCounts.walkIns} /> : null}
        {!volunteerMode ? <MetricCard label="Replacements" value={liveCounts.replacements} /> : null}
        {!volunteerMode ? <MetricCard label="Exceptions" value={liveCounts.openExceptions} warning={liveCounts.openExceptions > 0} /> : null}
      </div>

      {loading ? (
        <div className="mt-4 border border-[#d1d1d1] bg-white p-10 text-center text-sm text-[#616161]">Loading check-in operations…</div>
      ) : activeTab === "search" ? (
        <section className="mt-4 space-y-3">
          <div className="border border-[#d1d1d1] bg-white p-4">
            <label htmlFor="guest-search" className="mb-2 block text-sm font-semibold">Find a guest</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="guest-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void loadSearchGuests(searchQuery); }}
                placeholder="Name, email, phone, table, check-in code"
                className="min-h-11 w-full border border-[#8a8886] bg-white px-3 text-sm outline-none focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd]"
              />
              <button
                type="button"
                onClick={() => void loadSearchGuests(searchQuery)}
                className="min-h-11 bg-[#0f6cbd] px-5 text-sm font-semibold text-white hover:bg-[#115ea3]"
              >
                Search
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {searchGuests.length === 0 ? (
              <div className="border border-dashed border-[#c8c6c4] bg-white p-8 text-center text-sm text-[#616161]">No guests found. Search by name, email, phone, table, or code.</div>
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
        <section className="mt-4 max-w-3xl space-y-3">
          <div className="border border-[#d1d1d1] bg-white p-5">
            <label htmlFor="checkin-code" className="mb-1 block text-sm font-semibold">Scan or enter a check-in code</label>
            <p className="mb-3 text-sm text-[#616161]">USB and Bluetooth scanners can submit with Enter.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="checkin-code"
                ref={scanInputRef}
                value={scanCode}
                onChange={(event) => setScanCode(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void verifyScanCode(); }}
                placeholder="Scan or enter check-in code"
                className="min-h-12 w-full border-2 border-[#8a8886] bg-white px-3 font-mono text-lg tracking-wider outline-none focus:border-[#0f6cbd]"
              />
              <button
                onClick={() => void verifyScanCode()}
                disabled={scanLoading || !scanCode.trim()}
                className="min-h-12 bg-[#0f6cbd] px-5 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:bg-[#c8c6c4]"
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
        <section className="mt-4 space-y-3">
          {sortedTables.length === 0 ? (
            <div className="border border-dashed border-[#c8c6c4] bg-white p-8 text-center text-sm text-[#616161]">No tables found for this event.</div>
          ) : (
            sortedTables.map((table) => {
              const guestsAtTable = table.guests ?? [];
              const checkedIn = guestsAtTable.filter((guest) => guest.checkedIn).length;
              return (
                <article key={table.id} className="border border-[#d1d1d1] bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{table.tableNumber != null ? `Table ${table.tableNumber} · ` : ""}{table.name}</p>
                      <p className="text-xs text-[#616161]">{checkedIn}/{guestsAtTable.length || table._count?.guests || 0} checked in</p>
                    </div>
                    <button
                      onClick={() => void bulkCheckInTable(table)}
                      className="min-h-10 border border-[#0f6cbd] px-3 text-xs font-semibold text-[#0f6cbd] hover:bg-[#f2f7fc]"
                    >
                      Bulk Check-In
                    </button>
                  </div>
                  <div className="space-y-2">
                    {guestsAtTable.length === 0 ? (
                      <p className="text-xs text-[#616161]">No guests assigned to this table yet.</p>
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
                </article>
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
        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="border border-[#d1d1d1] bg-white p-5">
            <h2 className="text-lg font-semibold">Create exception</h2>
            <p className="mt-1 text-sm text-[#616161]">Queue issues that need manager review without blocking the door line.</p>
            <div className="mt-4 grid gap-3">
              <Field label="Guest name" required><input value={exceptionForm.guestName} onChange={(event) => setExceptionForm((previous) => ({ ...previous, guestName: event.target.value }))} className={inputClass} /></Field>
              <Field label="Issue type"><select value={exceptionForm.issueType} onChange={(event) => setExceptionForm((previous) => ({ ...previous, issueType: event.target.value }))} className={inputClass}>
                <option value="NOT_FOUND">Not Found</option>
                <option value="DUPLICATE">Duplicate</option>
                <option value="WRONG_TABLE">Wrong Table</option>
                <option value="REPLACEMENT">Replacement</option>
                <option value="UNCONFIRMED">Unconfirmed</option>
                <option value="NO_TICKET">No Ticket</option>
                <option value="OTHER">Other</option>
              </select></Field>
              <Field label="Claimed table"><input value={exceptionForm.claimedTable} onChange={(event) => setExceptionForm((previous) => ({ ...previous, claimedTable: event.target.value }))} className={inputClass} /></Field>
              <Field label="Claimed email"><input type="email" value={exceptionForm.claimedEmail} onChange={(event) => setExceptionForm((previous) => ({ ...previous, claimedEmail: event.target.value }))} className={inputClass} /></Field>
              <Field label="Claimed phone"><input value={exceptionForm.claimedPhone} onChange={(event) => setExceptionForm((previous) => ({ ...previous, claimedPhone: event.target.value }))} className={inputClass} /></Field>
              <Field label="Notes"><textarea value={exceptionForm.notes} onChange={(event) => setExceptionForm((previous) => ({ ...previous, notes: event.target.value }))} rows={3} className={`${inputClass} py-2`} /></Field>
              <button type="button" onClick={() => void createException()} className="min-h-11 bg-[#0f6cbd] px-4 text-sm font-semibold text-white hover:bg-[#115ea3]">Queue exception</button>
            </div>
          </div>

          <div className="border border-[#d1d1d1] bg-white p-5">
            <h2 className="text-lg font-semibold">Open exceptions</h2>
            <div className="mt-3 space-y-2">
              {exceptions.length === 0 ? (
                <p className="text-sm text-[#616161]">No open exceptions.</p>
              ) : (
                exceptions.map((item) => (
                  <div key={item.id} className="border border-[#d1d1d1] bg-[#faf9f8] p-3">
                    <p className="text-sm font-semibold">{item.guestName || "Unknown guest"}</p>
                    <p className="text-xs text-[#616161]">{item.issueType} · {new Date(item.createdAt).toLocaleTimeString()}</p>
                    {item.notes ? <p className="mt-1 text-xs text-[#424242]">{item.notes}</p> : null}
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void resolveException(item.id)} className="min-h-9 border border-emerald-700 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">Resolve</button>
                      <button type="button" onClick={() => void dismissException(item.id)} className="min-h-9 border border-[#8a8886] px-3 text-xs font-semibold hover:bg-white">Dismiss</button>
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
    </main>
  );
}

function MetricCard({ label, value, accent = false, warning = false }: { label: string; value: string | number; accent?: boolean; warning?: boolean }) {
  return (
    <div className="min-w-0 border-b border-r border-[#edebe9] p-4 last:border-r-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#616161]">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${warning ? "text-[#8a4b08]" : accent ? "text-[#0f6cbd]" : "text-[#242424]"}`}>{value}</p>
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
  const paymentDue = guest.paymentStatus === "DUE" || guest.paymentStatus === "PENDING_CHECK";
  return (
    <article className={`border bg-white p-3 ${guest.checkedIn ? "border-emerald-500 border-l-4" : paymentDue ? "border-amber-400 border-l-4" : "border-[#d1d1d1]"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className={`font-semibold text-[#242424] ${compact ? "text-sm" : "text-base"}`}>{name}</p>{guest.checkedIn ? <StatusBadge tone="success">Checked in</StatusBadge> : null}{guest.paymentStatus ? <StatusBadge tone={paymentDue ? "warning" : "neutral"}>{formatPaymentStatus(guest.paymentStatus)}</StatusBadge> : null}{guest.rsvpStatus && guest.rsvpStatus !== "CONFIRMED" ? <StatusBadge tone="warning">{guest.rsvpStatus.toLowerCase()}</StatusBadge> : null}</div>
          <p className="mt-1 break-words text-xs text-[#616161]">
            {guest.email || guest.phone || "No contact"}
            {guest.table ? ` · ${guest.table.name}` : ""}
            {guest.seat ? ` · Seat ${guest.seat.seatNumber}` : ""}
          </p>
          {guest.checkinCode ? <p className="mt-1 font-mono text-[11px] text-[#616161]">Code: {guest.checkinCode}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {guest.checkedIn ? (
            <button type="button" onClick={onReverse} className="min-h-10 border border-[#8a8886] bg-white px-3 text-xs font-semibold hover:bg-[#f5f5f5]">Reverse</button>
          ) : (
            <button type="button" onClick={onCheckIn} className="min-h-10 bg-[#0f6cbd] px-4 text-xs font-semibold text-white hover:bg-[#115ea3]">Check in</button>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "neutral" }) {
  const styles = tone === "success" ? "bg-emerald-50 text-emerald-800" : tone === "warning" ? "bg-amber-50 text-amber-900" : "bg-[#f2f7fc] text-[#0f6cbd]";
  return <span className={`px-2 py-0.5 text-[11px] font-semibold ${styles}`}>{children}</span>;
}

function formatPaymentStatus(value: NonNullable<Guest["paymentStatus"]>) {
  if (value === "PENDING_CHECK") return "Check pending";
  if (value === "COMP") return "Complimentary";
  return value.charAt(0) + value.slice(1).toLowerCase();
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
    <section className="max-w-3xl border border-[#d1d1d1] bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[#616161]">{description}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="First name" required><input value={form.firstName} onChange={(event) => onChange({ ...form, firstName: event.target.value })} className={inputClass} /></Field>
        <Field label="Last name" required><input value={form.lastName} onChange={(event) => onChange({ ...form, lastName: event.target.value })} className={inputClass} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} className={inputClass} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} className={inputClass} /></Field>
        <Field label="Table assignment" className="sm:col-span-2"><select value={form.tableId} onChange={(event) => onChange({ ...form, tableId: event.target.value })} className={inputClass}>
          <option value="">No table assignment</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>{table.tableNumber != null ? `#${table.tableNumber} ` : ""}{table.name}</option>
          ))}
        </select></Field>
        <Field label="Operations notes" className="sm:col-span-2"><textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} rows={3} className={`${inputClass} py-2`} /></Field>
      </div>
      <button type="button" onClick={onSubmit} className="mt-4 min-h-11 bg-[#0f6cbd] px-5 text-sm font-semibold text-white hover:bg-[#115ea3]">{actionLabel}</button>
    </section>
  );
}

const inputClass = "min-h-11 w-full border border-[#8a8886] bg-white px-3 text-sm outline-none focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd]";
function Field({ label, required = false, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) { return <label className={`block text-sm font-semibold text-[#424242] ${className}`}>{label}{required ? <span className="ml-1 text-red-700" aria-hidden="true">*</span> : null}<span className="mt-1 block">{children}</span></label>; }
