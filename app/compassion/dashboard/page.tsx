// Compassion CRM dashboard — shows caseload overview, schedule, tasks, alerts, and quick actions.
"use client";

import { useState } from "react";

// TODO: replace all static placeholder data with live API calls

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

// ─── Static placeholder data ──────────────────────────────────────────────────

/** Stat card config — each item renders a metric tile */
const STAT_CARDS = [
  {
    title: "Total Clients",
    value: 42,
    sub: "Active clients",
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
    value: 38,
    sub: "Open cases",
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
    value: 5,
    sub: "Scheduled",
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
    value: 7,
    sub: "2 overdue",
    subRed: true,
    link: "View tasks →",
    href: "/compassion/tasks",
    iconColor: "bg-purple-100 text-purple-600",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Follow Ups",
    value: 12,
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
] as const;

/** Caseload donut data */
const CASELOAD_SEGMENTS = [
  { label: "Active",    value: 28, color: "#2563eb" },   // blue-600
  { label: "Inactive",  value: 8,  color: "#93c5fd" },   // blue-300
  { label: "Graduated", value: 4,  color: "#6ee7b7" },   // emerald-300
  { label: "Archived",  value: 2,  color: "#e2e8f0" },   // gray-200
];

/** Cases donut data */
const CASES_SEGMENTS = [
  { label: "Open",        value: 20, color: "#2563eb" },
  { label: "In Progress", value: 10, color: "#7c3aed" }, // violet-600
  { label: "Pending",     value: 5,  color: "#f59e0b" }, // amber-500
  { label: "Closed",      value: 3,  color: "#e2e8f0" },
];

/** Today's schedule items */
const SCHEDULE_ITEMS = [
  { time: "9:00 AM",  title: "Client Appointment", who: "Maria Garcia",      type: "appointment" },
  { time: "11:00 AM", title: "Home Visit",          who: "Johnson Family",   type: "home-visit" },
  { time: "2:00 PM",  title: "Review Care Plans",   who: "Internal Meeting", type: "internal" },
];

/** Recent activity feed */
const RECENT_ACTIVITY = [
  { icon: "👤", text: "New client record created for James Wilson", time: "10 min ago" },
  { icon: "📋", text: "Care plan updated for Lisa Martinez",        time: "45 min ago" },
  { icon: "✅", text: "Assessment completed for Robert Chen",       time: "2 hrs ago" },
  { icon: "📅", text: "Appointment scheduled for Sarah Johnson",    time: "3 hrs ago" },
];

/** Upcoming tasks with due-status */
const UPCOMING_TASKS = [
  { title: "Follow up with Garcia family",      due: "Overdue",    status: "overdue" },
  { title: "Submit monthly caseload report",    due: "Due today",  status: "today" },
  { title: "Review Wilson assessment notes",    due: "Due tomorrow", status: "tomorrow" },
  { title: "Schedule quarterly review - Chen",  due: "Due in 3 days", status: "soon" },
];

/** Alert & reminder items */
const ALERTS = [
  { icon: "⚠️", text: "2 care plans expire this month — review required.", severity: "warning" },
  { icon: "🔔", text: "Mandatory supervision report due Friday.",           severity: "info" },
  { icon: "📣", text: "Team meeting rescheduled to Thursday 2 PM.",         severity: "info" },
];

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

interface DonutSegment { label: string; value: number; color: string; }

/**
 * DonutChart: renders a pure-SVG donut chart with a centered label.
 * No external libraries — uses stroke-dasharray/stroke-dashoffset technique.
 * Angles are pre-computed before JSX to avoid mutating variables during render.
 */
function DonutChart({ segments, total, centerLabel }: {
  segments: DonutSegment[];
  total: number;
  centerLabel: string;
}) {
  const r = 52;          // ring radius
  const cx = 70;         // center x
  const cy = 70;         // center y
  const circumference = 2 * Math.PI * r; // full ring length
  const gap = 2;         // pixel gap between segments

  /** Pre-compute each segment's rotation angle and arc lengths before rendering */
  const computed = segments.reduce<{ rotate: number; arcLen: number; offset: number; seg: DonutSegment }[]>(
    (acc, seg) => {
      const prevAngle = acc.length > 0 ? acc[acc.length - 1].rotate + (acc[acc.length - 1].arcLen / circumference) * 360 : -90;
      const fraction = seg.value / total;
      const arcLen = circumference * fraction - gap;
      const offset = circumference - arcLen;
      return [...acc, { rotate: prevAngle, arcLen, offset, seg }];
    },
    [],
  );

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36">
      {computed.map(({ rotate, arcLen, offset, seg }, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={16}
            strokeDasharray={`${arcLen} ${circumference - arcLen}`}
            strokeDashoffset={offset}
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />
      ))}
      {/* Center label */}
      <text x={cx} y={cy - 6} textAnchor="middle" className="text-lg font-bold" fontSize="16" fontWeight="700" fill="#1e3a5f">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b7280">
        {centerLabel}
      </text>
    </svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/**
 * StatCard: renders a single metric tile with icon, value, subtitle, and link.
 */
function StatCard({ card }: { card: typeof STAT_CARDS[number] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconColor}`}>
          {card.icon}
        </span>
        <span className="text-2xl font-bold text-gray-900">{card.value}</span>
      </div>
      <p className="text-sm font-medium text-gray-700">{card.title}</p>
      <p className={`text-xs ${card.subRed ? "text-red-500 font-medium" : "text-gray-400"}`}>{card.sub}</p>
      <a href={card.href} className="text-xs text-blue-600 hover:underline mt-auto">{card.link}</a>
    </div>
  );
}

/**
 * ScheduleCard: today's appointments with time, title, and person.
 */
function ScheduleCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">My Schedule</h3>
        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Today</span>
      </div>
      <div className="space-y-3">
        {SCHEDULE_ITEMS.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            {/* Time column */}
            <span className="text-xs font-mono text-gray-400 w-16 shrink-0 pt-0.5">{item.time}</span>
            {/* Vertical bar accent */}
            <div className="w-0.5 bg-blue-200 self-stretch rounded-full shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-400">{item.who}</p>
            </div>
          </div>
        ))}
      </div>
      <a href="/compassion/appointments" className="block text-xs text-blue-600 hover:underline mt-4">
        View full calendar →
      </a>
    </div>
  );
}

/**
 * ActivityCard: recent activity feed with icon, description, and timestamp.
 */
function ActivityCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {RECENT_ACTIVITY.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{item.text}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * TasksCard: upcoming tasks with color-coded due-status indicators.
 */
function TasksCard() {
  /** Maps task status to a badge style */
  const badgeFor = (status: string) => {
    if (status === "overdue")  return "bg-red-100 text-red-600";
    if (status === "today")    return "bg-amber-100 text-amber-700";
    if (status === "tomorrow") return "bg-gray-100 text-gray-500";
    return "bg-blue-50 text-blue-500";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Upcoming Tasks</h3>
      <div className="space-y-3">
        {UPCOMING_TASKS.map((task, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">{task.title}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badgeFor(task.status)}`}>
              {task.due}
            </span>
          </div>
        ))}
      </div>
      <a href="/compassion/tasks" className="block text-xs text-blue-600 hover:underline mt-4">
        View all tasks →
      </a>
    </div>
  );
}

/**
 * AlertsCard: alert/reminder items with severity icons.
 */
function AlertsCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Alerts &amp; Reminders</h3>
      <div className="space-y-3">
        {ALERTS.map((alert, i) => (
          <div key={i} className={`flex items-start gap-3 rounded-lg p-2.5 ${alert.severity === "warning" ? "bg-amber-50 border border-amber-100" : "bg-blue-50 border border-blue-100"}`}>
            <span className="text-base leading-none mt-0.5">{alert.icon}</span>
            <p className="text-xs text-gray-700">{alert.text}</p>
          </div>
        ))}
      </div>
      <a href="/compassion/tasks" className="block text-xs text-blue-600 hover:underline mt-4">
        View all alerts →
      </a>
    </div>
  );
}

/**
 * QuickActionsCard: four shortcut buttons for common Compassion CRM actions.
 */
function QuickActionsCard() {
  const actions = [
    { label: "Add New Client",       href: "/compassion/clients",      icon: "👤" },
    { label: "Schedule Appointment", href: "/compassion/appointments",  icon: "📅" },
    { label: "Create Case Note",     href: "/compassion/cases",         icon: "📝" },
    { label: "Log Activity",         href: "/compassion/activities",    icon: "⚡" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a, i) => (
          <a
            key={i}
            href={a.href}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
          >
            <span className="text-base">{a.icon}</span>
            <span>{a.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

/**
 * CompassionDashboardPage: main landing page for Compassion CRM.
 * Shows caseload metrics, chart overviews, schedule, tasks, alerts, and quick actions.
 * All data is static placeholder — TODO: wire to live API.
 */
export default function CompassionDashboardPage() {
  const [refreshedAt] = useState(() => formatTime(new Date()));

  const caseloadTotal = CASELOAD_SEGMENTS.reduce((s, seg) => s + seg.value, 0);
  const casesTotal    = CASES_SEGMENTS.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className="space-y-6 max-w-screen-2xl">

      {/* ── Greeting header ────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {getGreeting()}, Case Worker!
          </h1>
          {/* TODO: replace "Case Worker" with live user name from useAuth() */}
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s what&apos;s happening with your caseload today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Updated {refreshedAt}</span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-blue-50 text-blue-600 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat cards row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAT_CARDS.map((card, i) => (
          <StatCard key={i} card={card} />
        ))}
      </div>

      {/* ── Middle row: donut charts ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Caseload Overview */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Caseload Overview</h3>
          {/* TODO: fetch from /api/compassion/clients/summary */}
          <div className="flex items-center gap-6">
            <DonutChart segments={CASELOAD_SEGMENTS} total={caseloadTotal} centerLabel="Total Clients" />
            <div className="flex flex-col gap-2 flex-1">
              {CASELOAD_SEGMENTS.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="text-gray-600 flex-1">{seg.label}</span>
                  <span className="font-semibold text-gray-900">{seg.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cases by Status */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Cases by Status</h3>
          {/* TODO: fetch from /api/compassion/cases/summary */}
          <div className="flex items-center gap-6">
            <DonutChart segments={CASES_SEGMENTS} total={casesTotal} centerLabel="Total Cases" />
            <div className="flex flex-col gap-2 flex-1">
              {CASES_SEGMENTS.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="text-gray-600 flex-1">{seg.label}</span>
                  <span className="font-semibold text-gray-900">{seg.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: schedule, activity, tasks, alerts, quick actions ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ScheduleCard />
        <ActivityCard />
        <TasksCard />
        <AlertsCard />
        <QuickActionsCard />
      </div>
    </div>
  );
}
