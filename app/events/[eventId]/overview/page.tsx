/**
 * Event Overview page — /events/[eventId]/overview
 *
 * Polished event-scoped command center with nonprofit fundraising operations focus.
 * Shows KPI cards, fundraising progress, check-in progress, and an action queue.
 *
 * TODO: Wire the "Need Attention" action queue to a real API endpoint.
 *       Currently the attention items (Payment Issues, Guest Placement, Pending RSVPs)
 *       are derived from local data computations. They should come from
 *       GET /api/events/[id]/action-queue which can apply org-specific thresholds and priorities.
 *
 * TODO: Add a "Check-In Volunteer Mode" quick-launch button on this page that opens
 *       /events/[id]/check-in?mode=volunteer — a stripped-down check-in view with no CRM nav.
 *       This is referenced in events-workspace-config.ts notes for the check-in tool.
 *
 * TODO: Replace the "Check-In Readiness" percentage with a real readiness checklist API.
 *       Currently it counts readiness items on the frontend. Move the checklist logic server-side
 *       and return a structured { passed: number, total: number, items: [...] } response.
 *
 * TODO: The Milestones section at the bottom shows Registration Deadline, Event Start, Event End.
 *       Add a "Days Until Event" countdown badge that becomes a "Days Since" badge after the event.
 *       Also add a "Copy public event URL" button next to the event page milestone.
 *
 * TODO: The 8 KPI cards in "Event At A Glance" are rendered in a horizontal scroll on small
 *       laptop screens. Wrap to 2 rows at < 1280px width instead of allowing overflow.
 *       Use a responsive grid: grid-cols-4 xl:grid-cols-8 or similar.
 *
 * TODO: Add real-time refresh using polling or SSE for the Check-In progress card
 *       during live events. Staff use this page on a secondary monitor during events.
 *       Suggested: auto-refresh every 60s when the event's check-in is active.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

interface EventDetail {
  id: string;
  name: string;
  description?: string | null;
  type?: string;
  status?: string;
  startDate: string;
  endDate?: string | null;
  registrationDeadline?: string | null;
  location?: string | null;
  capacity?: number | null;
  registrationGoal?: number | null;
  revenueGoal?: number | string | null;
  active?: boolean;
  ticketTypes?: Array<{ id: string }>;
  _count?: {
    guests?: number;
    sponsors?: number;
    tables?: number;
    orders?: number;
  };
}

interface GuestSummary {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  checkedIn: boolean;
  checkedInAt?: string | null;
  paymentStatus?: string | null;
  rsvpStatus?: string | null;
  createdAt?: string;
  table?: { id: string; name: string } | null;
}

interface EventOrderSummary {
  id: string;
  status: string;
  totalAmount: number | string;
  createdAt?: string;
}

interface EventTableSummary {
  id: string;
  name: string;
  capacity: number;
  hostName?: string | null;
  isSponsored: boolean;
  tableNumber?: number | null;
  _count?: { guests: number };
}

interface EventSponsorSummary {
  id: string;
  amount?: number | string | null;
}

interface EventReportSummary {
  attendance?: {
    noShows?: number;
    attendanceRate?: number;
  };
  revenue?: {
    total?: number;
    fromDonations?: number;
    goal?: number;
  };
  donorInsights?: {
    needsFollowUp?: number;
  };
}

type MetricTone = "default" | "purple" | "green" | "amber" | "red";

function formatDateTime(value?: string | null): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function normalizeAmount(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toDisplayStatus(raw?: string | null): string {
  if (!raw) return "Active";
  return raw.toLowerCase().replace(/_/g, " ");
}

function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.ceil((parsed.getTime() - Date.now()) / oneDay);
}

function toneClass(tone: MetricTone): string {
  if (tone === "purple") return "text-violet-700";
  if (tone === "green") return "text-emerald-700";
  if (tone === "amber") return "text-amber-700";
  if (tone === "red") return "text-red-700";
  return "text-slate-900";
}

function progressBarClass(percent: number): string {
  if (percent >= 85) return "bg-emerald-500";
  if (percent >= 55) return "bg-violet-500";
  if (percent >= 25) return "bg-amber-500";
  return "bg-slate-400";
}

function guestName(guest: GuestSummary): string {
  const value = `${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim();
  if (value.length > 0) return value;
  return guest.email?.trim() || "Guest";
}

function OverviewMetricCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: MetricTone;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass(tone)}`}>{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </article>
  );
}

/** EventOverviewPage renders the polished event-scoped fundraising command center. */
export default function EventOverviewPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [orders, setOrders] = useState<EventOrderSummary[]>([]);
  const [tables, setTables] = useState<EventTableSummary[]>([]);
  const [sponsors, setSponsors] = useState<EventSponsorSummary[]>([]);
  const [report, setReport] = useState<EventReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const [eventData, guestsData, ordersData, tablesData, sponsorsData, reportData] = await Promise.all([
        apiFetch<EventDetail>(`/api/events/${eventId}`),
        apiFetch<GuestSummary[]>(`/api/events/${eventId}/guests`),
        apiFetch<EventOrderSummary[]>(`/api/events/${eventId}/orders`),
        apiFetch<EventTableSummary[]>(`/api/events/${eventId}/tables`),
        apiFetch<EventSponsorSummary[]>(`/api/events/${eventId}/sponsors`),
        apiFetch<EventReportSummary>(`/api/events/${eventId}/report`).catch(() => null),
      ]);

      setEvent(eventData);
      setGuests(Array.isArray(guestsData) ? guestsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setSponsors(Array.isArray(sponsorsData) ? sponsorsData : []);
      setReport(reportData);
      setLastRefreshedAt(new Date());
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to load event overview.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const {
    totalGuests,
    checkedInGuests,
    checkedInRate,
    confirmedRsvp,
    pendingRsvp,
    paymentIssues,
    noShows,
    unassignedGuests,
    tableCount,
    tablesSold,
    tableHosts,
    missingHostCoverage,
    sponsorCount,
    sponsorshipRevenue,
    totalRevenue,
    donationGoal,
    donationProgress,
    checkInReadiness,
    readinessComplete,
    readinessPercent,
    attentionItems,
    topHosts,
    recentOrders,
    recentCheckIns,
    eventInitials,
  } = useMemo(() => {
    const guestsCount = guests.length;
    const checkedIn = guests.filter((guest) => guest.checkedIn).length;
    const checkInRate = guestsCount > 0 ? Math.round((checkedIn / guestsCount) * 100) : 0;
    const confirmed = guests.filter((guest) => guest.rsvpStatus === "CONFIRMED").length;
    const pending = guests.filter((guest) => guest.rsvpStatus === "PENDING").length;
    const paymentIssueCount = guests.filter((guest) => guest.paymentStatus === "DUE" || guest.paymentStatus === "PENDING_CHECK").length;
    const noShowCount = report?.attendance?.noShows ?? Math.max(confirmed - checkedIn, 0);
    const withoutTable = guests.filter((guest) => !guest.table?.id).length;

    const eventTables = tables.length > 0 ? tables : [];
    const soldTables = eventTables.filter((table) => (table._count?.guests ?? 0) > 0).length;
    const hostCount = eventTables.filter((table) => Boolean((table.hostName ?? "").trim())).length;
    const missingHosts = eventTables.filter((table) => table.isSponsored && !(table.hostName ?? "").trim()).length;

    const confirmedRevenue = orders
      .filter((order) => order.status === "CONFIRMED")
      .reduce((sum, order) => sum + normalizeAmount(order.totalAmount), 0);
    const computedTotalRevenue = normalizeAmount(report?.revenue?.total) || confirmedRevenue;
    const sponsorRevenue = sponsors.reduce((sum, sponsor) => sum + normalizeAmount(sponsor.amount), 0);

    const rawGoal = normalizeAmount(event?.revenueGoal ?? report?.revenue?.goal ?? 0);
    const goalProgress = rawGoal > 0 ? Math.round((computedTotalRevenue / rawGoal) * 100) : 0;

    const readinessItems = [
      { label: "Guest list loaded", done: guestsCount > 0 },
      { label: "RSVP confirmations started", done: confirmed > 0 },
      { label: "Tables and seating configured", done: eventTables.length > 0 },
      { label: "Table host coverage assigned", done: hostCount > 0 && missingHosts === 0 },
      { label: "Sponsor records configured", done: sponsors.length > 0 || (event?._count?.sponsors ?? 0) > 0 },
      { label: "Payment issues triaged", done: paymentIssueCount === 0 && orders.length > 0 },
      { label: "Door workflow tested", done: checkedIn > 0 },
    ];

    const readinessDone = readinessItems.filter((item) => item.done).length;
    const readinessPct = readinessItems.length > 0 ? Math.round((readinessDone / readinessItems.length) * 100) : 0;

    const nextAttentionItems = [] as Array<{ id: string; title: string; detail: string; href: string; tone: MetricTone }>;
    if (paymentIssueCount > 0) {
      nextAttentionItems.push({
        id: "payment-issues",
        title: "Payment Issues",
        detail: `${paymentIssueCount} registrant records still show payment due or pending check status.`,
        href: `/events/${eventId}/donations`,
        tone: "red",
      });
    }
    if (missingHosts > 0) {
      nextAttentionItems.push({
        id: "host-coverage",
        title: "Table Host Coverage",
        detail: `${missingHosts} sponsored tables still need an assigned host owner.`,
        href: `/events/${eventId}/hosts`,
        tone: "amber",
      });
    }
    if (withoutTable > 0) {
      nextAttentionItems.push({
        id: "guest-placement",
        title: "Guest Placement",
        detail: `${withoutTable} guests are unassigned to tables and should be seated before event night.`,
        href: `/events/${eventId}/tables`,
        tone: "purple",
      });
    }
    if (pending > 0) {
      nextAttentionItems.push({
        id: "rsvp-pending",
        title: "Pending RSVPs",
        detail: `${pending} guest records are still pending RSVP confirmation.`,
        href: `/events/${eventId}/emails`,
        tone: "purple",
      });
    }

    const rankedHosts = eventTables
      .filter((table) => Boolean((table.hostName ?? "").trim()))
      .map((table) => {
        const seated = table._count?.guests ?? 0;
        const capacity = Math.max(table.capacity, 1);
        return {
          id: table.id,
          hostName: table.hostName?.trim() || "Host",
          tableLabel: `${table.tableNumber != null ? `#${table.tableNumber} ` : ""}${table.name}`.trim(),
          seated,
          capacity,
          fillRate: Math.round((seated / capacity) * 100),
        };
      })
      .sort((a, b) => b.seated - a.seated || b.fillRate - a.fillRate)
      .slice(0, 6);

    const latestOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 5);

    const latestCheckIns = [...guests]
      .filter((guest) => guest.checkedIn)
      .sort((a, b) => new Date(b.checkedInAt ?? b.createdAt ?? 0).getTime() - new Date(a.checkedInAt ?? a.createdAt ?? 0).getTime())
      .slice(0, 5);

    const initials = (event?.name ?? "EV")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    return {
      totalGuests: guestsCount,
      checkedInGuests: checkedIn,
      checkedInRate: checkInRate,
      confirmedRsvp: confirmed,
      pendingRsvp: pending,
      paymentIssues: paymentIssueCount,
      noShows: noShowCount,
      unassignedGuests: withoutTable,
      tableCount: eventTables.length || (event?._count?.tables ?? 0),
      tablesSold: soldTables,
      tableHosts: hostCount,
      missingHostCoverage: missingHosts,
      sponsorCount: sponsors.length || (event?._count?.sponsors ?? 0),
      sponsorshipRevenue: sponsorRevenue,
      totalRevenue: computedTotalRevenue,
      donationGoal: rawGoal,
      donationProgress: Math.max(0, goalProgress),
      checkInReadiness: readinessItems,
      readinessComplete: readinessDone,
      readinessPercent: readinessPct,
      attentionItems: nextAttentionItems,
      topHosts: rankedHosts,
      recentOrders: latestOrders,
      recentCheckIns: latestCheckIns,
      eventInitials: initials || "EV",
    };
  }, [event?._count?.sponsors, event?._count?.tables, event?.name, event?.revenueGoal, eventId, guests, orders, report?.attendance?.noShows, report?.revenue?.goal, report?.revenue?.total, sponsors, tables]);

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-5 lg:p-6">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex h-9 items-center rounded-md border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Retry loading overview
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Event not found.
      </div>
    );
  }

  const checkInStatusLabel = checkedInGuests > 0 ? "Live" : "Not Started";
  const pageBuilderStatusLabel = "Working";
  const eventStatus = event.status ? toDisplayStatus(event.status) : event.active ? "active" : "inactive";
  const registrationGoal = event.registrationGoal ?? event.capacity ?? null;
  const registrationProgress = registrationGoal && registrationGoal > 0
    ? Math.round((totalGuests / registrationGoal) * 100)
    : null;

  const milestoneRows = [
    {
      id: "registration-deadline",
      label: "Registration Deadline",
      value: event.registrationDeadline,
      href: `/events/${eventId}/tickets`,
    },
    {
      id: "event-start",
      label: "Event Start",
      value: event.startDate,
      href: `/events/${eventId}/overview`,
    },
    {
      id: "event-end",
      label: "Event End",
      value: event.endDate ?? null,
      href: `/events/${eventId}/overview`,
    },
    {
      id: "follow-up-window",
      label: "Follow-Up Window",
      value: event.startDate ? new Date(new Date(event.startDate).getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
      href: `/events/${eventId}/follow-up`,
    },
  ].filter((item) => Boolean(item.value));

  return (
    <div className="space-y-5 p-4 sm:p-5 lg:p-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Events CRM", href: "/events/events" },
          { label: event.name, href: `/events/${eventId}/overview` },
          { label: "Overview" },
        ]}
        statusLabel="Working"
        metadata={`${checkedInGuests.toLocaleString()} checked in · ${totalGuests.toLocaleString()} registrants · ${formatCurrency(totalRevenue)} raised`}
        accentTone="purple"
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Event Workspace">
          <WorkspaceRibbonButton label="Guests" href={`/events/${eventId}/guests`} accentTone="purple" />
          <WorkspaceRibbonButton label="Tables" href={`/events/${eventId}/tables`} accentTone="purple" />
          <WorkspaceRibbonButton label="Check-In" href={`/events/${eventId}/check-in`} accentTone="purple" />
          <WorkspaceRibbonButton label="Reports" href={`/events/${eventId}/reports`} accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Build">
          <WorkspaceRibbonButton label="Event Page" href={`/events/${eventId}/event-page`} accentTone="purple" />
          <WorkspaceRibbonButton label="Emails" href={`/events/${eventId}/emails`} accentTone="purple" />
          <WorkspaceRibbonButton label="Follow-Up" href={`/events/${eventId}/follow-up`} accentTone="purple" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Actions">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadData()} accentTone="purple" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-r from-white via-violet-50 to-violet-100/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-violet-300 bg-violet-100 text-lg font-bold text-violet-700">
              {eventInitials}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">Selected Event</p>
              <h1 className="truncate text-2xl font-semibold text-slate-900">{event.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {formatDateTime(event.startDate)}{event.location ? ` | ${event.location}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">{eventStatus}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">Check-In {checkInStatusLabel}</span>
                <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 font-semibold text-violet-700">Event Page {pageBuilderStatusLabel}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">Goal {donationGoal > 0 ? formatCurrency(donationGoal) : "Not Set"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/events/${eventId}/guests`}
              className="inline-flex h-9 items-center rounded-md border border-violet-300 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              Add / Manage Guests
            </Link>
            <Link
              href={`/events/${eventId}/check-in`}
              className="inline-flex h-9 items-center rounded-md border border-violet-300 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              Open Live Check-In
            </Link>
            <Link
              href={`/events/${eventId}/event-page`}
              className="inline-flex h-9 items-center rounded-md bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800"
            >
              Open Event Page Builder
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Event At A Glance</h2>
          <p className="text-xs text-slate-500">Fundraising operations snapshot</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <OverviewMetricCard label="Registrants" value={totalGuests.toLocaleString()} helper={`${confirmedRsvp.toLocaleString()} confirmed RSVPs`} />
          <OverviewMetricCard label="Checked In" value={`${checkedInGuests.toLocaleString()} (${checkedInRate}%)`} helper={`${noShows.toLocaleString()} no-shows`} tone={checkedInRate >= 70 ? "green" : "purple"} />
          <OverviewMetricCard label="Tables Sold" value={tablesSold.toLocaleString()} helper={`${tableCount.toLocaleString()} tables configured`} tone="purple" />
          <OverviewMetricCard label="Table Hosts" value={tableHosts.toLocaleString()} helper={`${missingHostCoverage.toLocaleString()} sponsored tables missing host`} tone={missingHostCoverage > 0 ? "amber" : "green"} />
          <OverviewMetricCard label="Revenue" value={formatCurrency(totalRevenue)} helper={`${orders.length.toLocaleString()} orders processed`} tone="purple" />
          <OverviewMetricCard label="Sponsorships" value={sponsorCount.toLocaleString()} helper={sponsorshipRevenue > 0 ? formatCurrency(sponsorshipRevenue) : "Revenue not linked yet"} tone="purple" />
          <OverviewMetricCard label="Donation Goal" value={donationGoal > 0 ? formatCurrency(donationGoal) : "Not Set"} helper={donationGoal > 0 ? `${donationProgress}% progress` : "Set event goal in settings"} tone={donationGoal > 0 && donationProgress >= 90 ? "green" : "purple"} />
          <OverviewMetricCard label="Check-In Readiness" value={`${readinessPercent}%`} helper={`${readinessComplete}/${checkInReadiness.length} readiness checks complete`} tone={readinessPercent >= 85 ? "green" : readinessPercent >= 55 ? "purple" : "amber"} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Event Status</h3>
            <Link href={`/events/${eventId}/settings`} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Edit event details</Link>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fundraising Goal</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{donationGoal > 0 ? `${donationProgress}%` : "Goal pending"}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${progressBarClass(Math.min(donationProgress, 100))}`} style={{ width: `${Math.min(donationProgress, 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatCurrency(totalRevenue)} raised</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check-In Progress</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{checkedInRate}%</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${progressBarClass(checkedInRate)}`} style={{ width: `${checkedInRate}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{checkedInGuests.toLocaleString()} checked in of {totalGuests.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planning Status</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{eventStatus}</p>
              <p className="mt-1 text-xs text-slate-500">Registration goal: {registrationGoal ? registrationGoal.toLocaleString() : "Not set"}</p>
              <p className="text-xs text-slate-500">{registrationProgress != null ? `${registrationProgress}% registration progress` : "Set goal to track progress"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-Up Pipeline</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{report?.donorInsights?.needsFollowUp ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">Estimated records needing post-event follow-up</p>
              <Link href={`/events/${eventId}/follow-up`} className="mt-1 inline-flex text-xs font-semibold text-violet-700 hover:text-violet-900">Open follow-up queue</Link>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Need Attention</h3>
            <span className="text-xs text-slate-500">Action queue</span>
          </div>
          {attentionItems.length === 0 ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              No urgent blockers detected. Keep monitoring readiness before event night.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {attentionItems.map((item) => (
                <Link key={item.id} href={item.href} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-violet-300 hover:bg-violet-50">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${toneClass(item.tone)}`}>{item.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Upcoming Milestones</h3>
            <Link href={`/events/${eventId}/settings`} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Open timeline settings</Link>
          </div>
          <div className="mt-3 space-y-2">
            {milestoneRows.length === 0 ? (
              <p className="text-xs text-slate-500">No milestone dates configured yet.</p>
            ) : (
              milestoneRows.map((milestone) => {
                const offset = daysUntil(milestone.value ?? null);
                const dueLabel = offset == null
                  ? "Date not set"
                  : offset < 0
                    ? `${Math.abs(offset)} day(s) ago`
                    : offset === 0
                      ? "Today"
                      : `In ${offset} day(s)`;

                return (
                  <Link key={milestone.id} href={milestone.href} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:border-violet-300 hover:bg-violet-50">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{milestone.label}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(milestone.value)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${offset != null && offset <= 2 && offset >= 0 ? "bg-amber-100 text-amber-800" : offset != null && offset < 0 ? "bg-slate-200 text-slate-700" : "bg-violet-100 text-violet-700"}`}>
                      {dueLabel}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Check-In Readiness</h3>
            <Link href={`/events/${eventId}/check-in`} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Open live mode</Link>
          </div>
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
            {readinessComplete}/{checkInReadiness.length} readiness checks complete ({readinessPercent}%).
          </div>
          <ul className="mt-3 space-y-2">
            {checkInReadiness.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-700">{item.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                  {item.done ? "Ready" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Top Table Hosts</h3>
            <Link href={`/events/${eventId}/hosts`} className="text-xs font-semibold text-violet-700 hover:text-violet-900">Open host manager</Link>
          </div>
          {topHosts.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">No host assignments yet. Assign hosts in the tables workspace.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {topHosts.map((host) => (
                <div key={host.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{host.hostName}</p>
                      <p className="text-xs text-slate-500">{host.tableLabel}</p>
                    </div>
                    <span className="text-xs font-semibold text-violet-700">{host.seated}/{host.capacity}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-violet-500" style={{ width: `${Math.min(host.fillRate, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
            <Link href={`/events/${eventId}/reports`} className="text-xs font-semibold text-violet-700 hover:text-violet-900">View full reports</Link>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent Orders</p>
            {recentOrders.length === 0 ? (
              <p className="text-xs text-slate-500">No order activity yet.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">Order {order.id.slice(0, 8)}</p>
                    <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600">{order.status.toLowerCase()} | {formatCurrency(normalizeAmount(order.totalAmount))}</p>
                </div>
              ))
            )}

            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent Check-Ins</p>
            {recentCheckIns.length === 0 ? (
              <p className="text-xs text-slate-500">No check-in activity yet.</p>
            ) : (
              recentCheckIns.map((guest) => (
                <div key={guest.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">{guestName(guest)}</p>
                    <span className="text-xs text-slate-500">{formatDateTime(guest.checkedInAt ?? guest.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600">{guest.table?.name ? `Table ${guest.table.name}` : "No table assignment"}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        <span>
          Last refreshed: {lastRefreshedAt ? lastRefreshedAt.toLocaleTimeString() : "Not yet refreshed"}
        </span>
        <button
          type="button"
          onClick={() => void loadData()}
          className="font-semibold text-violet-700 hover:text-violet-900"
        >
          Refresh now
        </button>
      </div>
    </div>
  );
}

