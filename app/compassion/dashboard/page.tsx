// Compassion CRM dashboard — shows caseload overview, schedule, tasks, alerts, and quick actions.
// Fetches live data from /api/compassion/dashboard-summary on mount.
"use client";

import { type ReactNode, useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";

/** Returns "Good morning/afternoon/evening" based on the current hour */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Formats a Date as "h:mm AM/PM" */
function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Shape of a chart segment from the API */
interface ChartSegment { label: string; value: number; color: string; }

/** Activity item from the API */
interface ActivityItem {
  id: string;
  activityType: string;
  description: string;
  createdAt: string;
  client?: { firstName: string; lastName: string };
  performedBy?: { firstName: string; lastName: string };
}

/** Appointment item from the API */
interface AppointmentItem {
  id: string;
  appointmentType: string;
  startTime: string;
  location?: string;
  client?: { firstName: string; lastName: string };
  assignedStaff?: { firstName: string; lastName: string };
}

/** Follow-up item from the API */
interface FollowUpItem {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  priority: string;
  client?: { firstName: string; lastName: string };
}

/** Full dashboard summary response */
interface DashboardData {
  totalClients: number;
  activeClients: number;
  activeCases: number;
  appointmentsToday: number;
  tasksDue: number;
  overdueFollowUps: number;
  followUpsThisWeek: number;
  caseloadByStatus: ChartSegment[];
  casesByStatus: ChartSegment[];
  recentActivity: ActivityItem[];
  todaysAppointments: AppointmentItem[];
  upcomingFollowUps: FollowUpItem[];
}

/** Type for each stat card */
type StatCardData = {
  title: string;
  value: number;
  sub: string;
  subRed?: boolean;
  link: string;
  href: string;
  iconColor: string;
  icon: ReactNode;
};

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

/**
 * DonutChart: renders a pure-SVG donut chart with a centered label.
 * Uses stroke-dasharray/stroke-dashoffset technique — no external libraries.
 */
function DonutChart({ segments, total, centerLabel }: {
  segments: ChartSegment[];
  total: number;
  centerLabel: string;
}) {
  const r = 52;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;
  const gap = 2;

  const computed = segments.reduce<{ rotate: number; arcLen: number; offset: number; seg: ChartSegment }[]>(
    (acc, seg) => {
      const prevAngle = acc.length > 0
        ? acc[acc.length - 1].rotate + (acc[acc.length - 1].arcLen / circumference) * 360
        : -90;
      const fraction = total > 0 ? seg.value / total : 0;
      const arcLen = circumference * fraction - gap;
      const offset = circumference - arcLen;
      return [...acc, { rotate: prevAngle, arcLen, offset, seg }];
    },
    [],
  );

  // Show empty ring when no data
  if (total === 0) {
    return (
      <svg viewBox="0 0 140 140" className="w-36 h-36">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={16} />
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="11" fill="#9ca3af">No data</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36">
      {computed.map(({ rotate, arcLen, offset, seg }, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={16}
          strokeDasharray={`${arcLen} ${circumference - arcLen}`}
          strokeDashoffset={offset}
          transform={`rotate(${rotate} ${cx} ${cy})`}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e3a5f">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b7280">{centerLabel}</text>
    </svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Renders a single metric tile with icon, value, subtitle, and link. */
function StatCard({ card }: { card: StatCardData }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconColor}`}>
          {card.icon}
        </span>
        <span className="text-xl font-bold text-gray-900">{card.value}</span>
      </div>
      <p className="text-sm font-medium text-gray-700">{card.title}</p>
      <p className={`text-xs ${card.subRed ? "text-red-500 font-medium" : "text-gray-400"}`}>{card.sub}</p>
      <a href={card.href} className="text-xs text-blue-600 hover:underline mt-auto">{card.link}</a>
    </div>
  );
}

/** Today's appointments with time, title, and person. */
function ScheduleCard({ appointments }: { appointments: AppointmentItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">My Schedule</h3>
        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Today</span>
      </div>
      {appointments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No appointments today.</p>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div key={appt.id} className="flex items-start gap-3">
              <span className="text-xs font-mono text-gray-400 w-16 shrink-0 pt-0.5">
                {formatTime(new Date(appt.startTime))}
              </span>
              <div className="w-0.5 bg-blue-200 self-stretch rounded-full shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {appt.appointmentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="text-xs text-gray-400">
                  {appt.client ? `${appt.client.firstName} ${appt.client.lastName}` : "Unknown client"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <a href="/compassion/appointments" className="block text-xs text-blue-600 hover:underline mt-4">
        View full calendar →
      </a>
    </div>
  );
}

/** Recent activity feed with icon, description, and timestamp. */
function ActivityCard({ activities }: { activities: ActivityItem[] }) {
  /** Maps activity type to a compact semantic icon */
  const iconFor = (type: string) => {
    if (type.includes("CLIENT")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M17 20h5v-2a3 3 0 00-5.4-1.8M17 20H7m10 0v-2a5 5 0 00-10 0v2m10 0H7m5-9a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      );
    }
    if (type.includes("CASE")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M9 5a2 2 0 002 2h2a2 2 0 002-2" />
        </svg>
      );
    }
    if (type.includes("APPOINTMENT")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (type.includes("COMPLETED")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  };

  /** Formats a timestamp as "X min/hr ago" */
  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
      {activities.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No recent activity.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                {iconFor(item.activityType)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{item.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Upcoming follow-ups with color-coded due-status indicators. */
function TasksCard({ followUps, overdueCount }: { followUps: FollowUpItem[]; overdueCount: number }) {
  /** Maps follow-up due status to a badge style */
  const badgeFor = (dueDate: string, status: string) => {
    if (status === "OVERDUE") return "bg-red-100 text-red-600";
    const due = new Date(dueDate);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (due < now) return "bg-red-100 text-red-600";
    if (diff < 1) return "bg-amber-100 text-amber-700";
    if (diff < 2) return "bg-gray-100 text-gray-500";
    return "bg-blue-50 text-blue-500";
  };

  /** Returns a human-readable due label */
  const dueLabel = (dueDate: string, status: string) => {
    if (status === "OVERDUE") return "Overdue";
    const due = new Date(dueDate);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (due < now) return "Overdue";
    if (diff < 1) return "Due today";
    if (diff < 2) return "Due tomorrow";
    return `Due in ${Math.ceil(diff)} days`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Tasks</h3>
        {overdueCount > 0 && (
          <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
            {overdueCount} overdue
          </span>
        )}
      </div>
      {followUps.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No upcoming tasks.</p>
      ) : (
        <div className="space-y-3">
          {followUps.map((fu) => (
            <div key={fu.id} className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">{fu.title}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badgeFor(fu.dueDate, fu.status)}`}>
                {dueLabel(fu.dueDate, fu.status)}
              </span>
            </div>
          ))}
        </div>
      )}
      <a href="/compassion/follow-ups" className="block text-xs text-blue-600 hover:underline mt-4">
        View all tasks →
      </a>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

/**
 * CompassionDashboardPage: main landing page for Compassion CRM.
 * Fetches live data from /api/compassion/dashboard-summary on mount.
 * Shows caseload metrics, chart overviews, schedule, activity, and tasks.
 */
export default function CompassionDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(() => formatTime(new Date()));

  /** Fetch dashboard summary from the API */
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await apiFetch<DashboardData>("/api/compassion/dashboard-summary");
      setData(result);
      setRefreshedAt(formatTime(new Date()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => { load(); }, [load]);

  // Build stat cards from live data
  const statCards: StatCardData[] = [
    {
      title: "Total Clients",
      value: data?.totalClients ?? 0,
      sub: `${data?.activeClients ?? 0} active`,
      link: "View all clients →",
      href: "/compassion/clients",
      iconColor: "bg-blue-100 text-blue-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: "Active Cases",
      value: data?.activeCases ?? 0,
      sub: "Open or in progress",
      link: "View all cases →",
      href: "/compassion/cases",
      iconColor: "bg-blue-100 text-blue-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      title: "Appointments Today",
      value: data?.appointmentsToday ?? 0,
      sub: "Scheduled for today",
      link: "View calendar →",
      href: "/compassion/appointments",
      iconColor: "bg-amber-100 text-amber-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Tasks Due",
      value: data?.tasksDue ?? 0,
      sub: data?.overdueFollowUps ? `${data.overdueFollowUps} overdue` : "No overdue",
      subRed: (data?.overdueFollowUps ?? 0) > 0,
      link: "View tasks →",
      href: "/compassion/follow-ups",
      iconColor: "bg-purple-100 text-purple-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: "Follow Ups",
      value: data?.followUpsThisWeek ?? 0,
      sub: "This week",
      link: "View follow ups →",
      href: "/compassion/follow-ups",
      iconColor: "bg-teal-100 text-teal-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      title: "Active Client Rate",
      value: data?.totalClients ? Math.round(((data.activeClients ?? 0) / data.totalClients) * 100) : 0,
      sub: "Percent currently active",
      link: "View client status mix →",
      href: "/compassion/clients",
      iconColor: "bg-indigo-100 text-indigo-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 17l6-6 4 4 8-8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21H3" />
        </svg>
      ),
    },
  ];

  const caseloadTotal = (data?.caseloadByStatus ?? []).reduce((s, seg) => s + seg.value, 0);
  const casesTotal    = (data?.casesByStatus ?? []).reduce((s, seg) => s + seg.value, 0);

  const userName = user ? `${user.firstName}` : "Case Worker";

  return (
    <div className="space-y-6 max-w-screen-2xl">

      {/* ── Greeting header ────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {getGreeting()}, {userName}!
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s what&apos;s happening with your caseload today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Updated {refreshedAt}</span>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-blue-50 text-blue-600 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Failed to load dashboard data. <button onClick={load} className="underline font-medium">Try again</button>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 h-24 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ── Stat cards row ─────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((card, i) => <StatCard key={i} card={card} />)}
        </div>
      )}

      {/* ── Middle row: donut charts ────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Caseload Overview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Caseload Overview</h3>
            <div className="flex items-center gap-6">
              <DonutChart
                segments={data?.caseloadByStatus ?? []}
                total={caseloadTotal}
                centerLabel="Clients"
              />
              <div className="flex flex-col gap-2 flex-1">
                {(data?.caseloadByStatus ?? []).map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: seg.color }} />
                    <span className="text-gray-600 flex-1">{seg.label}</span>
                    <span className="font-semibold text-gray-900">{seg.value}</span>
                  </div>
                ))}
                {(data?.caseloadByStatus ?? []).length === 0 && (
                  <p className="text-xs text-gray-400">No client data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Cases by Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Cases by Status</h3>
            <div className="flex items-center gap-6">
              <DonutChart
                segments={data?.casesByStatus ?? []}
                total={casesTotal}
                centerLabel="Cases"
              />
              <div className="flex flex-col gap-2 flex-1">
                {(data?.casesByStatus ?? []).map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: seg.color }} />
                    <span className="text-gray-600 flex-1">{seg.label}</span>
                    <span className="font-semibold text-gray-900">{seg.value}</span>
                  </div>
                ))}
                {(data?.casesByStatus ?? []).length === 0 && (
                  <p className="text-xs text-gray-400">No case data yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom row: schedule, activity, and tasks ─── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <ScheduleCard appointments={data?.todaysAppointments ?? []} />
          <ActivityCard activities={data?.recentActivity ?? []} />
          <TasksCard followUps={data?.upcomingFollowUps ?? []} overdueCount={data?.overdueFollowUps ?? 0} />
        </div>
      )}
    </div>
  );
}
