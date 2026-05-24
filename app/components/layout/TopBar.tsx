// TopBar: full-width global navigation header with logo, module switcher, search, and user controls.
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import AppsDrawer, { AppsGridIcon } from "@/app/components/layout/AppsDrawer";
import StewardAiRuntimePill from "@/app/components/layout/StewardAiRuntimePill";
import StewardDockPanel from "@/app/components/ai/StewardDockPanel";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { FeedbackModal } from "@/app/components/feedback/FeedbackModal";
import MessengerPanel from "@/app/components/messenger/MessengerPanel";
import { apiFetch } from "@/app/lib/auth-client";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  fetchWorkspaceSettings,
  getDonorAccentTheme,
  type WorkspaceSettings,
} from "@/app/lib/workspace-settings";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/app/lib/navigation-boundaries";
import {
  getFiscalYearEndMonth,
  getFiscalYearForDate,
  getStoredReportingYearMode,
  setStoredReportingYearMode,
  type ReportingYearMode,
} from "@/app/lib/fiscal-year";
import { buildHelpHref, mapModuleKeyToHelpScope } from "@/app/help-content";

interface SearchResult {
  id: string;
  type: "tool" | "constituent" | "donation" | "campaign" | "client" | "case" | "event" | "guest" | "site" | "page";
  label: string;
  sublabel?: string;
  href: string;
  group: "tools" | "records";
}

interface SearchResponse {
  module: "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "oshareview" | "hrm";
  query: string;
  results: SearchResult[];
}

interface FiscalSettings {
  fiscalYearStart: number;
  fiscalYearEnd: number;
}

interface TopBarNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
  status?: "unread" | "read" | "dismissed";
  module?: string;
  actionLabel?: string | null;
  snoozedUntil?: string | null;
}

interface StewardSignalsRebuildResult {
  rebuilt: boolean;
  reason: string;
  state: {
    fingerprint: string;
    lastIndexedAt: string;
    indexedConstituentCount: number;
    autoRebuildCount: number;
    manualRebuildCount: number;
    lastTrigger: "auto" | "manual";
  };
}

/** Returns true when a keyboard event originates from an editable control. */
function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest('[contenteditable="true"],[role="textbox"]'));
}

/** Generic help-circle icon used for help control in topbar controls. */
function HelpCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9a2.25 2.25 0 1 1 3.4 1.93c-.87.52-1.15.92-1.15 1.82" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
    </svg>
  );
}

/** Generic bell icon used for notifications control in topbar controls. */
function BellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.86 17H9.14a2.8 2.8 0 0 1-2.8-2.8v-2.47a5.66 5.66 0 0 1 11.32 0v2.47a2.8 2.8 0 0 1-2.8 2.8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17a2 2 0 1 0 4 0" />
    </svg>
  );
}

/** Workspace switcher icon set using inline SVG (no custom image assets). */
function WorkspaceSwitcherIcon({ moduleKey, className = "w-4 h-4" }: { moduleKey: TopBarModuleKey; className?: string }) {
  if (moduleKey === "compassion") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 18.5a4.75 4.75 0 0 1 9.5 0M10.75 18.5a4.75 4.75 0 0 1 9.5 0" />
      </svg>
    );
  }
  if (moduleKey === "events") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.5v4M16 3.5v4M4.5 10.5h15" />
      </svg>
    );
  }
  if (moduleKey === "watchdog") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5l7 2.8v5.6c0 4.2-3 7.7-7 8.8-4-1.1-7-4.6-7-8.8V6.3L12 3.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5l1.7 1.7 3.3-3.4" />
      </svg>
    );
  }
  if (moduleKey === "webmaster") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5h17M8.5 4.5v4" />
      </svg>
    );
  }
  if (moduleKey === "hrm") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19.25a7 7 0 0 1 14 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.75h3M16 7.75h3" />
      </svg>
    );
  }
  if (moduleKey === "oshareview") {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 18.5h14" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15.5v-4M12 15.5V8M16.5 15.5v-6" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5l2.2 4.5 4.9.7-3.5 3.4.8 4.9L12 15.9 7.6 18l.8-4.9-3.5-3.4 4.9-.7L12 4.5z" />
    </svg>
  );
}

function GlobalSearch({
  moduleKey,
  pathname,
  autoFocus = false,
  onNavigate,
  wide = false,
}: {
  moduleKey: TopBarModuleKey;
  pathname: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  wide?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [resultGroupFilter, setResultGroupFilter] = useState<"all" | "tools" | "records">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map());
  const lastRequestIdRef = useRef(0);

  const storageKey = `oyama:topbar-search:recent:${moduleKey}`;

  const quickActions: SearchResult[] = useMemo(() => moduleKey === "compassion"
    ? [
      { id: "quick-compassion-dashboard", type: "tool", label: "Open Compassion Dashboard", sublabel: "Workspace home", href: "/compassion/dashboard", group: "tools" },
      { id: "quick-compassion-clients", type: "tool", label: "Open Clients", sublabel: "Client records and profiles", href: "/compassion/clients", group: "tools" },
      { id: "quick-compassion-appointments", type: "tool", label: "Open Appointments", sublabel: "Calendar and scheduling", href: "/compassion/appointments", group: "tools" },
      { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=compassion&scopePath=${encodeURIComponent(pathname || "/compassion/dashboard")}`, group: "tools" },
    ]
    : moduleKey === "events"
      ? [
        { id: "quick-events-workspace", type: "tool", label: "Open EventSTUDIO Home", sublabel: "Fundraising event command center home", href: "/events", group: "tools" },
        { id: "quick-events-registry", type: "tool", label: "Open All Events", sublabel: "Create or select an event workspace", href: "/events/events", group: "tools" },
        { id: "quick-events-checkin", type: "tool", label: "Open Event Check-In", sublabel: "Use All Events to select event first", href: "/events/events", group: "tools" },
        { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=events&scopePath=${encodeURIComponent(pathname || "/events")}`, group: "tools" },
      ]
      : moduleKey === "watchdog"
        ? [
          { id: "quick-watchdog-home", type: "tool", label: "Open Watchdog Home", sublabel: "Security workspace", href: "/watchdog", group: "tools" },
          { id: "quick-watchdog-feedback", type: "tool", label: "Open Feedback Ticketing", sublabel: "Cross-CRM triage queue", href: "/watchdog/feedback-tickets", group: "tools" },
          { id: "quick-watchdog-alerts", type: "tool", label: "Open Alerts", sublabel: "Threat and anomaly activity", href: "/watchdog/alerts", group: "tools" },
          { id: "quick-watchdog-audit", type: "tool", label: "Open Audit Logs", sublabel: "Security event trail", href: "/watchdog/audit", group: "tools" },
          { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=global&scopePath=${encodeURIComponent(pathname || "/watchdog")}`, group: "tools" },
        ]
        : moduleKey === "webmaster"
          ? [
            { id: "quick-webmaster-home", type: "tool", label: "Open Webmaster Home", sublabel: "Website operations", href: "/webmaster", group: "tools" },
            { id: "quick-webmaster-sites", type: "tool", label: "Open Sites", sublabel: "Manage web properties", href: "/webmaster/sites", group: "tools" },
            { id: "quick-webmaster-pages", type: "tool", label: "Open Pages", sublabel: "Content and structure", href: "/webmaster/pages", group: "tools" },
            { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=global&scopePath=${encodeURIComponent(pathname || "/webmaster")}`, group: "tools" },
          ]
          : moduleKey === "hrm"
            ? [
              { id: "quick-hrm-home", type: "tool", label: "Open HRM Dashboard", sublabel: "Internal operations home", href: "/hrm", group: "tools" },
              { id: "quick-hrm-people", type: "tool", label: "Open People", sublabel: "Staff and board records", href: "/hrm/people", group: "tools" },
              { id: "quick-hrm-scheduling", type: "tool", label: "Open Scheduling", sublabel: "Availability and schedule rules", href: "/hrm/scheduling", group: "tools" },
              { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=global&scopePath=${encodeURIComponent(pathname || "/hrm")}`, group: "tools" },
            ]
          : moduleKey === "oshareview"
            ? [
              { id: "quick-oshareview-home", type: "tool", label: "Open Reports Hub", sublabel: "Reporting workspace", href: "/reports", group: "tools" },
              { id: "quick-oshareview-builder", type: "tool", label: "Open Report Builder", sublabel: "Create custom reports", href: "/reports/builder", group: "tools" },
              { id: "quick-oshareview-segments", type: "tool", label: "Open Segments", sublabel: "Audience and cohort sets", href: "/reports/segments", group: "tools" },
              { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=donor&scopePath=${encodeURIComponent(pathname || "/reports")}`, group: "tools" },
            ]
            : [
              { id: "quick-donor-home", type: "tool", label: "Open Donor Dashboard", sublabel: "Fundraising home", href: "/", group: "tools" },
              { id: "quick-donor-constituents", type: "tool", label: "Open Constituents", sublabel: "Profiles and stewardship", href: "/constituents", group: "tools" },
              { id: "quick-donor-donations", type: "tool", label: "Open Donations", sublabel: "Gift records", href: "/donations", group: "tools" },
              { id: "quick-donor-campaigns", type: "tool", label: "Open Campaigns", sublabel: "Fundraising initiatives", href: "/campaigns", group: "tools" },
              { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=donor&scopePath=${encodeURIComponent(pathname || "/")}`, group: "tools" },
            ], [moduleKey, pathname]);

  const resultLimit = wide ? 24 : 12;
  const filteredResults = useMemo(() => (resultGroupFilter === "all"
    ? results
    : results.filter((result) => result.group === resultGroupFilter)
  ).slice(0, resultLimit), [resultGroupFilter, resultLimit, results]);

  const quickActionMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return quickActions.slice(0, 5);
    return quickActions
      .filter((action) =>
        action.label.toLowerCase().includes(normalized)
        || (action.sublabel ?? "").toLowerCase().includes(normalized)
      )
      .slice(0, 4);
  }, [query, quickActions]);

  const combinedNavigableResults = useMemo(() => query.trim()
    ? [...filteredResults, ...quickActionMatches.filter((action) => !filteredResults.some((result) => result.href === action.href))]
    : quickActions.slice(0, 5), [filteredResults, query, quickActionMatches, quickActions]);

  function storeRecentQuery(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    const next = [normalized, ...recentQueries.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 6);
    setRecentQueries(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable in constrained browser contexts.
    }
  }

  function openHelpSearch() {
    const normalized = query.trim();
    if (!normalized) return;
    storeRecentQuery(normalized);
    const params = new URLSearchParams();
    params.set("scope", mapModuleKeyToHelpScope(moduleKey));
    params.set("scopePath", pathname || "/");
    params.set("q", normalized);
    setOpen(false);
    setQuery("");
    onNavigate?.();
    router.push(`/help?${params.toString()}`);
  }

  // ⌘K / Ctrl+K focus shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
      setOpen(true);
    }, 50);
    return () => window.clearTimeout(timeout);
  }, [autoFocus]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setRecentQueries([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setRecentQueries([]);
        return;
      }
      setRecentQueries(parsed.filter((entry): entry is string => typeof entry === "string").slice(0, 6));
    } catch {
      setRecentQueries([]);
    }
  }, [storageKey]);

  const search = useCallback(async (q: string) => {
    const normalized = q.trim();
    if (!normalized) {
      setResults([]);
      setLoading(false);
      return;
    }

    const cached = searchCacheRef.current.get(normalized.toLowerCase());
    if (cached) {
      setResults(cached);
      setOpen(true);
      setSelected(0);
      return;
    }

    const requestId = ++lastRequestIdRef.current;
    setLoading(true);
    try {
      const searchModule = moduleKey === "oshareview" || moduleKey === "hrm" ? "donor" : moduleKey;
      const params = new URLSearchParams({
        module: searchModule,
        q: normalized,
        limit: "12",
      });
      const data = await apiFetch<SearchResponse>(`/api/search?${params.toString()}`);

      // Ignore stale responses when users type quickly and previous requests finish late.
      if (requestId !== lastRequestIdRef.current) return;

      const normalizedQuery = normalized.toLowerCase();
      const rankedResults = [...data.results].sort((left, right) => {
        const leftLabel = left.label.toLowerCase();
        const rightLabel = right.label.toLowerCase();
        const leftSub = (left.sublabel ?? "").toLowerCase();
        const rightSub = (right.sublabel ?? "").toLowerCase();

        const leftScore = (leftLabel.startsWith(normalizedQuery) ? 12 : leftLabel.includes(normalizedQuery) ? 8 : 0)
          + (leftSub.includes(normalizedQuery) ? 3 : 0)
          + (left.group === "tools" ? 1 : 0);
        const rightScore = (rightLabel.startsWith(normalizedQuery) ? 12 : rightLabel.includes(normalizedQuery) ? 8 : 0)
          + (rightSub.includes(normalizedQuery) ? 3 : 0)
          + (right.group === "tools" ? 1 : 0);

        if (rightScore !== leftScore) return rightScore - leftScore;
        return left.label.localeCompare(right.label);
      });

      setResults(rankedResults);
      setOpen(true);
      setSelected(0);

      searchCacheRef.current.set(normalized.toLowerCase(), rankedResults);
      if (searchCacheRef.current.size > 25) {
        const oldest = searchCacheRef.current.keys().next().value;
        if (oldest) searchCacheRef.current.delete(oldest);
      }
    } catch {
      if (requestId !== lastRequestIdRef.current) return;
      setResults([]);
      setOpen(true);
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [moduleKey]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 180);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    setSelected(0);
  }, [query, resultGroupFilter]);

  useEffect(() => {
    if (selected <= combinedNavigableResults.length - 1) return;
    setSelected(Math.max(combinedNavigableResults.length - 1, 0));
  }, [combinedNavigableResults, selected]);

  function navigate(href: string, recentValue?: string) {
    if (recentValue?.trim()) {
      storeRecentQuery(recentValue);
    }
    setOpen(false);
    setQuery("");
    onNavigate?.();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab" && open && combinedNavigableResults[selected]) {
      e.preventDefault();
      setQuery(combinedNavigableResults[selected].label);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(combinedNavigableResults.length - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    }
    if (e.key === "Enter") {
      if (e.shiftKey) {
        e.preventDefault();
        openHelpSearch();
        return;
      }
      const active = combinedNavigableResults[selected];
      if (active) {
        e.preventDefault();
        navigate(active.href, query.trim() || active.label);
      } else if (query.trim()) {
        e.preventDefault();
        openHelpSearch();
      }
    }
  }

  function renderHighlightedText(value: string) {
    const normalized = query.trim();
    if (!normalized) return value;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(${escaped})`, "ig");
    const parts = value.split(pattern);
    return (
      <>
        {parts.map((part, index) => (
          part.toLowerCase() === normalized.toLowerCase()
            ? <mark key={`${part}-${index}`} className="bg-yellow-100 text-gray-900 px-0.5 rounded">{part}</mark>
            : <span key={`${part}-${index}`}>{part}</span>
        ))}
      </>
    );
  }

  const typeLabel: Record<string, string> = {
    tool: "Tool",
    constituent: "Constituent",
    campaign: "Campaign",
    donation: "Donation",
    client: "Client",
    case: "Case",
    event: "Event",
    guest: "Guest",
    site: "Site",
    page: "Page",
  };

  function TypeIcon({ type }: { type: string }) {
    if (type === "tool") {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7z" />
        </svg>
      );
    }
    if (type === "event") {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path strokeLinecap="round" d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    }
    if (type === "guest" || type === "client" || type === "constituent") {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
          <circle cx="9.5" cy="7" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 19v-1a4 4 0 0 0-3-3.87" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 4.13a3 3 0 0 1 0 5.74" />
        </svg>
      );
    }
    if (type === "case") {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      );
    }
    if (type === "campaign") {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    }
    if (type === "site") {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    }
    if (type === "page") {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path strokeLinecap="round" d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }

  const focusRing = moduleKey === "compassion"
    ? "focus:ring-blue-400/60"
    : moduleKey === "events"
      ? "focus:ring-violet-400/60"
      : moduleKey === "watchdog"
        ? "focus:ring-red-400/60"
        : moduleKey === "webmaster"
          ? "focus:ring-indigo-400/60"
          : moduleKey === "hrm"
            ? "focus:ring-teal-400/60"
          : moduleKey === "oshareview"
              ? "focus:ring-cyan-400/60"
          : "focus:ring-green-400/60";
  const activeResultBg = moduleKey === "compassion"
    ? "bg-blue-50"
    : moduleKey === "events"
      ? "bg-violet-50"
      : moduleKey === "watchdog"
        ? "bg-red-50"
        : moduleKey === "webmaster"
          ? "bg-indigo-50"
          : moduleKey === "hrm"
            ? "bg-teal-50"
          : moduleKey === "oshareview"
              ? "bg-cyan-50"
          : "bg-green-50";
  const spinnerColor = moduleKey === "compassion"
    ? "border-blue-400"
    : moduleKey === "events"
      ? "border-violet-400"
      : moduleKey === "watchdog"
        ? "border-red-400"
        : moduleKey === "webmaster"
          ? "border-indigo-400"
          : moduleKey === "hrm"
            ? "border-teal-500"
          : moduleKey === "oshareview"
              ? "border-cyan-500"
          : "border-green-400";
  const placeholder = moduleKey === "compassion"
    ? "Search clients, cases, tools..."
    : moduleKey === "events"
      ? "Search events, guests, tools..."
      : moduleKey === "watchdog"
        ? "Search alerts, vault, security tools..."
        : moduleKey === "webmaster"
          ? "Search sites, pages, publish tools..."
          : moduleKey === "hrm"
            ? "Search staff, schedules, locations..."
          : moduleKey === "oshareview"
              ? "Search reports, segments, analytics..."
          : "Search constituents, campaigns, tools...";

  return (
    <div className={`relative w-full min-w-0 ${wide ? "max-w-none" : "max-w-xl"}`}>
      <div className="group/search relative transition-colors duration-200 ease-out">
        <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 pointer-events-none transition-colors duration-200 ease-out group-focus-within/search:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 bg-white pl-8 pr-12 text-slate-900 placeholder:text-slate-500 shadow-sm transition-colors duration-200 ease-out focus:border-emerald-200 focus:bg-white focus:outline-none focus:ring-1 ${focusRing} ${wide ? "h-12 text-sm" : "py-2 text-xs"}`}
        />
        <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 transition-colors duration-200 ease-out group-focus-within/search:bg-white group-focus-within/search:text-slate-700 min-[1120px]:block">
          Ctrl+K
        </kbd>
        {loading && (
          <div className={`absolute right-9 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 ${spinnerColor} border-t-transparent`} />
        )}
      </div>

      {open && (
        <div className={`${wide ? "relative mt-3 max-h-[calc(100dvh-15rem)] min-h-[22rem]" : "absolute top-full mt-2 left-0 right-0 max-h-[min(30rem,calc(100dvh-9rem))]"} overflow-y-auto bg-white rounded-2xl border border-gray-200 shadow-2xl z-50`}>
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/80 flex flex-wrap items-center gap-1.5">
            <button
              onMouseDown={() => setResultGroupFilter("all")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${resultGroupFilter === "all" ? "bg-white text-gray-900 border-gray-300" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-white"}`}
            >
              All ({results.length})
            </button>
            <button
              onMouseDown={() => setResultGroupFilter("tools")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${resultGroupFilter === "tools" ? "bg-white text-gray-900 border-gray-300" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-white"}`}
            >
              Tools ({results.filter((item) => item.group === "tools").length})
            </button>
            <button
              onMouseDown={() => setResultGroupFilter("records")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${resultGroupFilter === "records" ? "bg-white text-gray-900 border-gray-300" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-white"}`}
            >
              Records ({results.filter((item) => item.group === "records").length})
            </button>
            {query.trim() ? (
              <button
                onMouseDown={() => openHelpSearch()}
                className="ml-auto px-2 py-1 rounded-md text-[11px] font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
              >
                Search Help For "{query.trim()}"
              </button>
            ) : null}
          </div>

          {!query.trim() ? (
            <div className="py-2">
              {recentQueries.length > 0 ? (
                <div className="px-4 pb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recent searches</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {recentQueries.map((recentQuery) => (
                      <button
                        key={recentQuery}
                        onMouseDown={() => {
                          setQuery(recentQuery);
                          setOpen(true);
                        }}
                        className="px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-[11px] text-gray-700 hover:bg-gray-100"
                      >
                        {recentQuery}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Quick actions</p>
              <ul className="py-1">
                {quickActions.slice(0, 5).map((action, index) => (
                  <li key={action.id}>
                    <button
                      onMouseDown={() => navigate(action.href, action.label)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${index === selected ? activeResultBg : "hover:bg-gray-50"}`}
                    >
                      <TypeIcon type={action.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{action.label}</p>
                        <p className="text-xs text-gray-400 truncate">{action.sublabel}</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded-full border text-slate-500 bg-slate-50 border-slate-200">Quick</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : combinedNavigableResults.length > 0 ? (
            <ul className="py-1">
              {combinedNavigableResults.map((r, i) => {
                const isQuick = r.id.startsWith("quick-");
                return (
                  <li key={`${r.id}-${r.href}`}>
                    <button
                      onMouseDown={() => navigate(r.href, query.trim() || r.label)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? activeResultBg : "hover:bg-gray-50"}`}
                    >
                      <TypeIcon type={r.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{renderHighlightedText(r.label)}</p>
                        <p className="text-xs text-gray-400 truncate">{r.sublabel ? renderHighlightedText(r.sublabel) : null}</p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded-full border ${isQuick ? "text-slate-500 bg-slate-50 border-slate-200" : r.group === "tools" ? "text-slate-500 bg-slate-50 border-slate-200" : "text-gray-400 bg-gray-50 border-gray-200"}`}>
                        {isQuick ? "Quick" : typeLabel[r.type]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-4 text-sm text-gray-500">
              <p>No direct matches in this CRM scope.</p>
              <button
                onMouseDown={() => openHelpSearch()}
                className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Search Help For "{query.trim()}"
              </button>
            </div>
          )}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 bg-gray-50">
            <span className="text-xs text-gray-400">↑↓ navigate</span>
            <span className="text-xs text-gray-400">↵ open</span>
            <span className="text-xs text-gray-400">Tab autocomplete</span>
            <span className="text-xs text-gray-400">Shift+↵ search help</span>
            <span className="text-xs text-gray-400">Esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface TopBarProps {
  scrolled?: boolean;
}

/** Full-width top navigation bar — spans the entire viewport width. */
export default function TopBar({ scrolled = false }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const moduleKey = resolveTopBarModuleKey(pathname);
  const showTopBarAppLauncher = true;
  const [appsOpen, setAppsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<TopBarNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [analyzingSignals, setAnalyzingSignals] = useState(false);
  const [signalsAnalyzeError, setSignalsAnalyzeError] = useState<string | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [fiscalSettings, setFiscalSettings] = useState<FiscalSettings>({ fiscalYearStart: 1, fiscalYearEnd: 12 });
  const [reportingYearMode, setReportingYearMode] = useState<ReportingYearMode>("calendar");
  const [topBarReactiveGlow, setTopBarReactiveGlow] = useState(false);
  const [mobileQuickOpen, setMobileQuickOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [compactActionsOpen, setCompactActionsOpen] = useState(false);
  const [messengerOpen, setMessengerOpen] = useState(false);
  const [messengerUnread, setMessengerUnread] = useState(0);
  const [incomingMsgToast, setIncomingMsgToast] = useState<{ senderName: string; senderInitials: string; colorClass: string; body: string; threadId: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reportingModeJustChanged, setReportingModeJustChanged] = useState(false);
  const reactiveGlowFrameRef = useRef<number | null>(null);
  const reactiveGlowTimeoutRef = useRef<number | null>(null);

  const reportingModeChangedTimeoutRef = useRef<number | null>(null);
  const desktopNotificationsRef = useRef<HTMLDivElement | null>(null);

  const isStewardSignalsWorkspace = moduleKey === "donor" && pathname.startsWith("/steward-signals");
  const donorAccentTheme = getDonorAccentTheme(workspaceSettings.donorAccentTone);
  const chromeButtonBase = "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white/95 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-px hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:translate-y-0 max-[380px]:h-9 max-[380px]:w-9";
  const darkIconButtonBase = "h-9 w-9 rounded-xl border border-transparent bg-transparent text-slate-500 flex items-center justify-center transition-all duration-200 hover:-translate-y-px hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 active:translate-y-0 active:scale-95";
  const mobileSheetBase = "fixed left-2 right-2 bottom-2 rounded-2xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.18)] z-50 overflow-hidden xl:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]";
  const shellMotionClass = "duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";
  const moduleAccentClass = moduleKey === "compassion"
    ? "bg-blue-600"
    : moduleKey === "events"
      ? "bg-violet-500"
      : moduleKey === "watchdog"
        ? "bg-red-600"
        : moduleKey === "webmaster"
          ? "bg-indigo-600"
          : moduleKey === "hrm"
            ? "bg-teal-600"
          : moduleKey === "oshareview"
            ? "bg-cyan-600"
            : donorAccentTheme.topBarAccentLine;
  const homeHref = moduleKey === "compassion"
    ? "/compassion/dashboard"
    : moduleKey === "events"
      ? "/events/events"
      : moduleKey === "watchdog"
        ? "/watchdog"
        : moduleKey === "webmaster"
          ? "/webmaster"
          : moduleKey === "hrm"
            ? "/hrm"
          : moduleKey === "oshareview"
            ? "/reports"
            : "/";
  const helpHref = buildHelpHref({
    scope: mapModuleKeyToHelpScope(moduleKey),
    scopePath: pathname,
  });
  const currentFiscalYear = getFiscalYearForDate(new Date(), fiscalSettings.fiscalYearStart);
  const donorReportingModeLabel = reportingYearMode === "fiscal" ? `FY ${currentFiscalYear}` : "Calendar Year";
  const donorReportingModeDescription = reportingYearMode === "fiscal"
    ? `Fiscal year mode is on. FY${currentFiscalYear} runs month ${fiscalSettings.fiscalYearStart}-${fiscalSettings.fiscalYearEnd}.`
    : "Calendar year mode is on. Click to use the fiscal year offset from Organization Settings.";
  const canRunAiConnectionTest = user?.role === "admin" || user?.role === "super_admin";

  /** Briefly pulses module accent glow to acknowledge meaningful workspace actions. */
  const triggerTopBarReactiveGlow = useCallback(() => {
    if (reactiveGlowFrameRef.current) {
      window.cancelAnimationFrame(reactiveGlowFrameRef.current);
    }
    if (reactiveGlowTimeoutRef.current) {
      window.clearTimeout(reactiveGlowTimeoutRef.current);
    }
    reactiveGlowFrameRef.current = window.requestAnimationFrame(() => {
      setTopBarReactiveGlow(true);
      reactiveGlowTimeoutRef.current = window.setTimeout(() => {
        setTopBarReactiveGlow(false);
      }, 900);
    });
  }, [setTopBarReactiveGlow]);

  useEffect(() => {
    let active = true;

    async function loadWorkspaceSettings() {
      const [settings, organizationSettings] = await Promise.all([
        fetchWorkspaceSettings(),
        apiFetch<Partial<FiscalSettings>>("/api/settings").catch(() => null),
      ]);
      if (!active) return;
      setWorkspaceSettings(settings);
      const fiscalYearStart = organizationSettings?.fiscalYearStart ?? 1;
      setFiscalSettings({
        fiscalYearStart,
        fiscalYearEnd: organizationSettings?.fiscalYearEnd ?? getFiscalYearEndMonth(fiscalYearStart),
      });
    }

    void loadWorkspaceSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setReportingYearMode(getStoredReportingYearMode());
  }, []);

  useEffect(() => {
    function openSearchFromKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (isEditableEventTarget(event.target)) return;
        event.preventDefault();
        setAppsOpen(false);
        setFeedbackOpen(false);
        setNotificationsOpen(false);
        setMobileQuickOpen(false);
        setCompactActionsOpen(false);
        setMessengerOpen(false);
        setMobileSearchOpen(true);
      }
    }

    window.addEventListener("keydown", openSearchFromKeyboard);
    return () => window.removeEventListener("keydown", openSearchFromKeyboard);
  }, []);

  useEffect(() => {
    const hasOpenPanel = appsOpen || feedbackOpen || notificationsOpen || mobileQuickOpen || mobileSearchOpen || compactActionsOpen || messengerOpen;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!hasOpenPanel) {
        return;
      }
      setAppsOpen(false);
      setFeedbackOpen(false);
      setNotificationsOpen(false);
      setMobileQuickOpen(false);
      setMobileSearchOpen(false);
      setCompactActionsOpen(false);
      setMessengerOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [appsOpen, compactActionsOpen, feedbackOpen, messengerOpen, mobileQuickOpen, mobileSearchOpen, notificationsOpen]);

  function toggleReportingYearMode() {
    const nextMode: ReportingYearMode = reportingYearMode === "fiscal" ? "calendar" : "fiscal";
    setReportingYearMode(nextMode);
    setStoredReportingYearMode(nextMode);
  }

  function handleReportingWindowToggle() {
    toggleReportingYearMode();
    setReportingModeJustChanged(true);
    if (reportingModeChangedTimeoutRef.current) {
      window.clearTimeout(reportingModeChangedTimeoutRef.current);
    }
    reportingModeChangedTimeoutRef.current = window.setTimeout(() => {
      setReportingModeJustChanged(false);
    }, 1400);
    triggerTopBarReactiveGlow();
  }

  async function handleMobileSignOut() {
    setMobileQuickOpen(false);
    await signOut();
    router.replace("/login");
  }

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const notificationModule = moduleKey === "oshareview" || moduleKey === "hrm" ? "donor" : moduleKey;
      const data = await apiFetch<{ items: TopBarNotification[]; unreadCount: number }>(
        `/api/notifications?module=${notificationModule}`
      );
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch (err) {
      setNotificationsError(err instanceof Error ? err.message : "Failed to load notifications");
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, [moduleKey, setNotificationsLoading, setNotificationsError, setNotifications, setUnreadCount]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const notificationModule = moduleKey === "oshareview" || moduleKey === "hrm" ? "donor" : moduleKey;
      const data = await apiFetch<{ unreadCount: number }>(`/api/notifications/unread-count?module=${notificationModule}`);
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // Keep existing badge state if lightweight polling fails.
    }
  }, [moduleKey, setUnreadCount]);

  const runNotificationAction = useCallback(async (
    id: string,
    action: "read" | "dismiss" | "snooze",
    options?: { until?: string }
  ) => {
    await apiFetch(`/api/notifications/${id}/${action}`, {
      method: "PATCH",
      body: JSON.stringify(options ?? {}),
    });
    await loadNotifications();
  }, [loadNotifications]);

  const openNotification = useCallback(async (item: TopBarNotification) => {
    try {
      if (item.status !== "read") {
        await apiFetch(`/api/notifications/${item.id}/read`, { method: "PATCH" });
      }
    } catch {
      // Navigation should continue even if the read receipt fails.
    }

    setNotificationsOpen(false);
    router.push(item.href);
  }, [router, setNotificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notificationsOpen, loadNotifications]);

  // Desktop notifications should close on outside click without using a full-screen overlay.
  useEffect(() => {
    if (!notificationsOpen) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const handlePointerDown = (event: PointerEvent) => {
      const container = desktopNotificationsRef.current;
      if (!container) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!container.contains(target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    void loadUnreadCount();
    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, 45000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${apiBase}/api/notifications/sse`, { withCredentials: true });
      const refresh = () => {
        void loadUnreadCount();
        if (notificationsOpen) void loadNotifications();
      };
      es.addEventListener("ready", refresh);
      es.addEventListener("changed", refresh);
    } catch {
      return;
    }

    return () => {
      es?.close();
    };
  }, [loadNotifications, loadUnreadCount, notificationsOpen]);

  // Poll messenger unread count every 30 seconds.
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const { count } = await apiFetch<{ count: number }>("/api/messenger/unread-count");
        if (active) setMessengerUnread(typeof count === "number" ? count : 0);
      } catch {
        // keep existing badge
      }
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Background SSE: fires live notifications when the messenger panel is closed.
  useEffect(() => {
    if (!user || messengerOpen) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    let es: EventSource;
    try {
      es = new EventSource(`${apiBase}/api/messenger/sse`, { withCredentials: true });
      es.addEventListener("message", (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data as string) as {
            threadId: string;
            message: { body: string; sender: { id: string; firstName: string; lastName: string } };
          };
          if (payload.message.sender.id === user.id) return;
          setMessengerUnread((prev) => prev + 1);
          const fn = payload.message.sender.firstName;
          const ln = payload.message.sender.lastName;
          const initials = `${fn[0] ?? ""}${ln[0] ?? ""}`.toUpperCase();
          const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-teal-500"];
          const colorClass = colors[(fn.charCodeAt(0) + ln.charCodeAt(0)) % colors.length] ?? "bg-violet-500";
          setIncomingMsgToast({ senderName: `${fn} ${ln}`, senderInitials: initials, colorClass, body: payload.message.body, threadId: payload.threadId });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setIncomingMsgToast(null), 5000);
        } catch { /* ignore malformed */ }
      });
    } catch { return; }
    return () => { es.close(); };
  }, [user, messengerOpen]);

  useEffect(() => {
    const refresh = () => {
      void loadUnreadCount();
      if (notificationsOpen) void loadNotifications();
    };
    window.addEventListener("tasks:updated", refresh);
    return () => {
      window.removeEventListener("tasks:updated", refresh);
    };
  }, [loadUnreadCount, loadNotifications, notificationsOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotificationsOpen(false);
      setMobileQuickOpen(false);
      setMobileSearchOpen(false);
      setCompactActionsOpen(false);
      setMessengerOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    if (appsOpen || feedbackOpen || notificationsOpen) {
      setCompactActionsOpen(false);
    }
  }, [appsOpen, feedbackOpen, notificationsOpen]);

  // Subtle color response when navigation context changes.
  useEffect(() => {
    triggerTopBarReactiveGlow();
  }, [pathname, triggerTopBarReactiveGlow]);

  // Subtle color response when topbar interactive panels are used.
  useEffect(() => {
    if (notificationsOpen || feedbackOpen || appsOpen) {
      triggerTopBarReactiveGlow();
    }
  }, [notificationsOpen, feedbackOpen, appsOpen, triggerTopBarReactiveGlow]);

  // Subtle color response after task-level actions complete in topbar utilities.
  useEffect(() => {
    if (!notificationsLoading || analyzingSignals) return;
    const timer = window.setTimeout(() => {
      triggerTopBarReactiveGlow();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [notificationsLoading, analyzingSignals, triggerTopBarReactiveGlow]);

  useEffect(() => {
    return () => {
      if (reactiveGlowFrameRef.current) {
        window.cancelAnimationFrame(reactiveGlowFrameRef.current);
      }
      if (reactiveGlowTimeoutRef.current) {
        window.clearTimeout(reactiveGlowTimeoutRef.current);
      }
      if (reportingModeChangedTimeoutRef.current) {
        window.clearTimeout(reportingModeChangedTimeoutRef.current);
      }
    };
  }, []);

  /** Manually rebuilds Steward Signals analysis index and notifies workspace widgets to refresh. */
  const runStewardSignalsAnalysis = useCallback(async () => {
    if (!isStewardSignalsWorkspace || analyzingSignals) return;
    setAnalyzingSignals(true);
    setSignalsAnalyzeError(null);

    try {
      const result = await apiFetch<StewardSignalsRebuildResult>("/api/steward-signals/index/rebuild", {
        method: "POST",
        body: JSON.stringify({}),
      });

      window.dispatchEvent(new CustomEvent("steward-signals:analysis-rebuilt", {
        detail: {
          source: "topbar-analyze",
          rebuild: result,
        },
      }));
    } catch (error) {
      setSignalsAnalyzeError(error instanceof Error ? error.message : "Failed to rebuild Steward Signals analysis.");
    } finally {
      setAnalyzingSignals(false);
    }
  }, [isStewardSignalsWorkspace, analyzingSignals, setAnalyzingSignals, setSignalsAnalyzeError]);

  /** Opens AI settings for runtime diagnostics and provider configuration. */
  const openAiSettings = useCallback(() => {
    setNotificationsOpen(false);
    setMobileQuickOpen(false);
    setAppsOpen(false);
    setFeedbackOpen(false);
    setCompactActionsOpen(false);
    router.push("/settings/ai");
  }, [router, setNotificationsOpen, setMobileQuickOpen, setAppsOpen, setFeedbackOpen, setCompactActionsOpen]);

  return (
    <>
      {showTopBarAppLauncher ? <AppsDrawer open={appsOpen} onClose={() => setAppsOpen(false)} /> : null}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        moduleKey={moduleKey}
        pathname={pathname}
      />
      {/* StewardDockPanel renders the floating chat-head and the slide-in agent dock. */}
      <StewardDockPanel moduleKey={moduleKey} behindOverlay={messengerOpen} />
            {/* CRM Messenger panel — slides in from the TopBar chat icon */}
            <MessengerPanel
              open={messengerOpen}
              onClose={() => setMessengerOpen(false)}
              onUnreadChange={setMessengerUnread}
            />

            {/* Incoming message toast — shown when panel is closed and a new message arrives */}
            {incomingMsgToast && !messengerOpen && (
              <div
                role="alert"
                aria-live="polite"
                className="fixed bottom-3 left-3 right-3 z-[60] flex max-w-none cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_16px_48px_rgba(2,6,23,0.18)] sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-[340px]"
                style={{ animation: "msgPanelIn 0.2s cubic-bezier(0.22,1,0.36,1)" }}
                onClick={() => {
                  setMessengerOpen(true);
                  setIncomingMsgToast(null);
                  if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                }}
              >
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${incomingMsgToast.colorClass}`}>
                  {incomingMsgToast.senderInitials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{incomingMsgToast.senderName}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-slate-500">{incomingMsgToast.body}</p>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={(e) => { e.stopPropagation(); setIncomingMsgToast(null); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }}
                  className="ml-0.5 flex-shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
      {/* Command search modal — opened from the centered top-bar icon or Ctrl+K. */}
      {mobileSearchOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-950/25 backdrop-blur-[2px]" onClick={() => setMobileSearchOpen(false)} />
          <div className="fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] z-50 mx-auto flex max-h-[calc(100dvh-1rem)] max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl sm:inset-x-3 sm:top-10 sm:max-h-[calc(100dvh-2.5rem)] sm:p-4 lg:top-16">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Command Search</p>
                <h2 className="text-base font-semibold text-slate-950">Search records, tools, campaigns, and help</h2>
              </div>
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setMobileSearchOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 min-w-0 flex-1">
              <GlobalSearch moduleKey={moduleKey} pathname={pathname} autoFocus wide onNavigate={() => setMobileSearchOpen(false)} />
            </div>
          </div>
        </>
      )}
      <header data-topbar-root="true" className={`fixed left-0 right-0 top-0 isolate z-20 h-16 w-full shrink-0 border-b border-slate-200/80 bg-white/96 backdrop-blur-xl transition-[height,box-shadow,background-color,border-color] ${shellMotionClass} xl:border-b-0 ${scrolled ? "shadow-[0_10px_28px_rgba(15,23,42,0.075)] xl:h-20" : "shadow-none xl:h-28"}`} style={{ paddingTop: "max(0rem, env(safe-area-inset-top))" }}>
        <div aria-hidden="true" className={`pointer-events-none absolute left-0 top-0 z-10 hidden transition-[height,width] ${shellMotionClass} xl:block ${scrolled ? "h-[94px] w-[424px]" : "h-[136px] w-[548px]"}`}>
          <svg className="h-full w-full" viewBox="0 0 590 156" preserveAspectRatio="none">
            <defs>
              <radialGradient id="oyama-brand-glow" cx="16%" cy="20%" r="48%">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.34" />
                <stop offset="58%" stopColor="#10b981" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="oyama-brand-scoop" x1="0%" y1="0%" x2="100%" y2="92%">
                <stop offset="0%" stopColor="#012c25" />
                <stop offset="58%" stopColor="#075443" />
                <stop offset="100%" stopColor="#0f766e" />
              </linearGradient>
            </defs>
            <path
              d="M0 0H590C552 7 521 25 493 55C447 105 399 135 314 144C220 154 130 129 43 132C19 133 7 140 0 150Z"
              fill="url(#oyama-brand-scoop)"
              stroke="#0b6b5c"
              strokeWidth={2.25}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M0 0H590C552 7 521 25 493 55C447 105 399 135 314 144C220 154 130 129 43 132C19 133 7 140 0 150Z"
              fill="url(#oyama-brand-glow)"
            />
          </svg>
        </div>
        <div aria-hidden="true" className={`pointer-events-none absolute bottom-0 right-0 z-0 hidden h-px bg-slate-200/55 transition-[left,opacity] ${shellMotionClass} xl:block ${scrolled ? "left-[280px] opacity-100" : "left-[480px] opacity-70"}`} />
        <div
          aria-hidden="true"
          className={`absolute bottom-0 left-[280px] right-0 h-px pointer-events-none hidden transition-opacity ${shellMotionClass} xl:block ${moduleAccentClass} ${topBarReactiveGlow ? "opacity-70" : "opacity-0"}`}
        />

        <div className="relative z-20 hidden h-full w-[520px] xl:block">
          <Link href={homeHref} className={`absolute left-8 flex shrink-0 items-center gap-2.5 rounded-2xl px-1 py-0.5 transition-[top,opacity] ${shellMotionClass} hover:opacity-90 ${scrolled ? "top-3" : "top-5"}`} aria-label="Go to workspace home">
            <Image
              src="/branding/oyama-crm-logo-final.png"
              alt="OyamaCRM"
              width={260}
              height={74}
              className={`object-contain object-left transition-[height,width,opacity] ${shellMotionClass} ${scrolled ? "h-9 w-[128px]" : "h-11 w-[166px]"}`}
              priority
            />
          </Link>

          {workspaceSettings.showModuleSwitcher && (
            <div className={`absolute transition-[left,top] ${shellMotionClass} ${scrolled ? "left-[176px] top-[14px]" : "left-[152px] top-[62px]"}`}>
              <ModuleSwitcher moduleKey={moduleKey} settings={workspaceSettings} scrolled={scrolled} />
            </div>
          )}
        </div>

        <div className="relative z-20 flex h-full w-full min-w-0 shrink-0 items-center justify-between gap-2 px-2 max-[380px]:gap-1.5 sm:px-3 xl:hidden">
          <div className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2">
            <div className="flex h-11 min-w-0 shrink items-center gap-1 rounded-2xl border border-emerald-200/10 bg-[radial-gradient(circle_at_8%_0%,rgba(52,211,153,0.24),transparent_42%),linear-gradient(135deg,#012c25,#075443_58%,#0f766e)] px-1.5 shadow-[0_10px_26px_rgba(6,78,59,0.20)] max-[380px]:h-10 max-[380px]:rounded-xl max-[380px]:px-1">
              {/* ── Mobile hamburger — opens sidebar drawer via CustomEvent ── */}
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => window.dispatchEvent(new CustomEvent("crm:open-mobile-nav"))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/88 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 max-[380px]:h-8 max-[380px]:w-8"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* ── TopBar Brand ── */}
              <Link href={homeHref} className="flex min-w-0 shrink items-center rounded-xl px-1.5 py-1 transition-opacity hover:opacity-90 max-[380px]:px-1" aria-label="Go to workspace home">
                <Image
                  src="/branding/oyama-crm-logo-final.png"
                  alt="OyamaCRM"
                  width={144}
                  height={48}
                  className="block h-8 w-[116px] object-contain object-left transition-[width,height] duration-200 max-[430px]:w-[96px] max-[380px]:h-7 max-[380px]:w-[76px]"
                  priority
                />
              </Link>
            </div>

            {/* ── Module switcher (left anchor) ── */}
            {workspaceSettings.showModuleSwitcher && (
              <div className="hidden min-[560px]:flex min-w-0 items-center gap-1.5 sm:gap-2">
                <ModuleSwitcher moduleKey={moduleKey} settings={workspaceSettings} scrolled />
              </div>
            )}
          </div>

          {/* Mobile top-right priority controls */}
          <div className="flex shrink-0 items-center gap-1.5 max-[380px]:gap-1 xl:hidden">
            {/* Search icon — opens full-screen overlay */}
            <button
              type="button"
              title="Search"
              onClick={() => {
                setNotificationsOpen(false);
                setMobileQuickOpen(false);
                setCompactActionsOpen(false);
                setMessengerOpen(false);
                setMobileSearchOpen(true);
              }}
              className={chromeButtonBase}
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>

            <div className="relative">
              <button
                title="Notifications"
                onClick={() =>
                  setNotificationsOpen((current) => {
                    const nextOpen = !current;
                    if (nextOpen) {
                      setMobileQuickOpen(false);
                      setCompactActionsOpen(false);
                      setMessengerOpen(false);
                      setMobileSearchOpen(false);
                    }
                    return nextOpen;
                  })}
                className={`${chromeButtonBase} relative`}
              >
                <BellIcon className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${
                    moduleKey === "compassion"
                      ? "bg-blue-500"
                      : moduleKey === "events"
                        ? "bg-violet-500"
                        : moduleKey === "watchdog"
                          ? "bg-red-600"
                          : moduleKey === "webmaster"
                            ? "bg-indigo-600"
                            : moduleKey === "hrm"
                              ? "bg-teal-600"
                              : moduleKey === "oshareview"
                                ? "bg-cyan-600"
                                : "bg-green-600"
                  }`}>
                    {Math.min(unreadCount, 99)}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className={`${mobileSheetBase} max-h-[72vh] flex flex-col`}>
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                      <p className="text-sm font-semibold text-gray-900">Notifications</p>
                      <button
                        onClick={() => void loadNotifications()}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Refresh
                      </button>
                    </div>

                    {notificationsLoading ? (
                      <div className="px-4 py-6 text-sm text-gray-400">Loading notifications...</div>
                    ) : notificationsError ? (
                      <div className="px-4 py-6 text-sm text-red-600">{notificationsError}</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-gray-500">No new notifications.</div>
                    ) : (
                      <div className="overflow-y-auto">
                        {notifications.map((item) => (
                          <div key={item.id} className="w-full px-4 py-3 border-b border-gray-100 text-left hover:bg-gray-50">
                            <button onClick={() => void openNotification(item)} className="w-full text-left">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
                                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${item.priority === "high" ? "bg-red-100 text-red-700" : item.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                  {item.priority}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.message}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                            </button>
                            <div className="mt-2 flex items-center gap-2">
                              {item.status !== "read" ? (
                                <button
                                  onClick={() => void runNotificationAction(item.id, "read")}
                                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
                                >
                                  Mark read
                                </button>
                              ) : null}
                              <button
                                onClick={() => void runNotificationAction(item.id, "snooze", { until: new Date(Date.now() + 60 * 60 * 1000).toISOString() })}
                                className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                              >
                                Snooze 1h
                              </button>
                              <button
                                onClick={() => void runNotificationAction(item.id, "dismiss")}
                                className="text-[11px] font-medium text-red-600 hover:text-red-700"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              title="More workspace tools"
              aria-label="Open workspace tools"
              aria-expanded={mobileQuickOpen}
              onClick={() => {
                setMobileQuickOpen((current) => !current);
                setNotificationsOpen(false);
                setMobileSearchOpen(false);
                setCompactActionsOpen(false);
                setMessengerOpen(false);
              }}
              className={`${chromeButtonBase} relative`}
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
              </svg>
              {messengerUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center bg-violet-500">
                  {Math.min(messengerUnread, 99)}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className={`absolute inset-y-0 left-0 right-0 z-10 hidden min-w-0 items-center pr-5 transition-[padding,gap] ${shellMotionClass} xl:flex 2xl:pr-8 ${scrolled ? "gap-3 pl-[360px] 2xl:pl-[382px]" : "gap-4 pl-[438px] 2xl:gap-5 2xl:pl-[476px]"}`}>
          {/* ── Center command search trigger ── */}
          <div className="flex min-w-0 flex-1 justify-center">
            <button
              type="button"
              aria-label="Open global search"
              title="Search OyamaCRM"
              onClick={() => {
                setNotificationsOpen(false);
                setMobileQuickOpen(false);
                setCompactActionsOpen(false);
                setMessengerOpen(false);
                setMobileSearchOpen(true);
              }}
              className={`group flex w-full items-center justify-between gap-3 rounded-[19px] border border-slate-200/85 bg-white/98 px-4 text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.055),inset_0_1px_0_rgba(255,255,255,0.92)] transition-all ${shellMotionClass} hover:-translate-y-px hover:border-emerald-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 ${scrolled ? "h-11 max-w-[520px]" : "h-[50px] max-w-[560px] 2xl:max-w-[600px]"}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100/90 text-slate-500 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700">
                  <svg className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                </span>
                <span className="truncate text-sm">
                  Search constituents, donations, campaigns, tools...
                </span>
              </span>
              <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-400 min-[1280px]:inline">
                Ctrl K
              </span>
            </button>
          </div>

          {/* ── Right-side icon controls ── */}
          <div className="hidden shrink-0 items-center gap-1.5 xl:flex 2xl:gap-2.5">

          {isStewardSignalsWorkspace && (
            <button
              title={signalsAnalyzeError ?? "Rebuild Steward Signals analysis index"}
              onClick={() => void runStewardSignalsAnalysis()}
              disabled={analyzingSignals}
              className="h-9 rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
            >
              {analyzingSignals ? "Analyzing..." : "Analyze"}
            </button>
          )}

          <div className="order-4">
            <StewardAiRuntimePill
              canRunConnectionTest={canRunAiConnectionTest}
              onOpenSettings={openAiSettings}
              compact
            />
          </div>

          {/* ── Messenger icon (desktop) ── */}
          <div className="relative hidden">
            <button
              type="button"
              title="Messages"
              onClick={() => {
                setMessengerOpen((v) => !v);
                setNotificationsOpen(false);
                setCompactActionsOpen(false);
              }}
              className={`${darkIconButtonBase} relative max-2xl:hidden`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
              </svg>
              {messengerUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center bg-violet-500">
                  {Math.min(messengerUnread, 99)}
                </span>
              )}
            </button>
          </div>

          {/* Notifications */}
        <div ref={desktopNotificationsRef} className="relative order-2">
          <button
            title="Notifications"
            onClick={() =>
              setNotificationsOpen((current) => {
                const nextOpen = !current;
                if (nextOpen) {
                  setCompactActionsOpen(false);
                  setMessengerOpen(false);
                  setMobileQuickOpen(false);
                  setMobileSearchOpen(false);
                }
                return nextOpen;
              })}
            className={`${darkIconButtonBase} relative`}
          >
            <BellIcon className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${
                moduleKey === "compassion"
                  ? "bg-blue-500"
                  : moduleKey === "events"
                    ? "bg-violet-500"
                    : moduleKey === "watchdog"
                      ? "bg-red-600"
                      : moduleKey === "webmaster"
                        ? "bg-indigo-600"
                        : moduleKey === "hrm"
                          ? "bg-teal-600"
                            : moduleKey === "oshareview"
                              ? "bg-cyan-600"
                        : "bg-green-600"
              }`}>
                {Math.min(unreadCount, 99)}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <>
              <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void apiFetch("/api/notifications/mark-all-read", { method: "POST", body: JSON.stringify({ module: moduleKey === "oshareview" || moduleKey === "hrm" ? "donor" : moduleKey }) }).then(() => loadNotifications())}
                      className="text-xs text-slate-600 hover:text-slate-800"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={() => void loadNotifications()}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {notificationsLoading ? (
                  <div className="px-4 py-6 text-sm text-gray-400">Loading notifications...</div>
                ) : notificationsError ? (
                  <div className="px-4 py-6 text-sm text-red-600">{notificationsError}</div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500">No new notifications.</div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.map((item) => (
                      <div key={item.id} className="w-full px-4 py-3 border-b border-gray-100 text-left hover:bg-gray-50">
                        <button onClick={() => void openNotification(item)} className="w-full text-left">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${item.priority === "high" ? "bg-red-100 text-red-700" : item.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.message}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                          {item.status !== "read" ? (
                            <button
                              onClick={() => void runNotificationAction(item.id, "read")}
                              className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
                            >
                              Mark read
                            </button>
                          ) : null}
                          <button
                            onClick={() => void runNotificationAction(item.id, "snooze", { until: new Date(Date.now() + 60 * 60 * 1000).toISOString() })}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                          >
                            Snooze 1h
                          </button>
                          <button
                            onClick={() => void runNotificationAction(item.id, "dismiss")}
                            className="text-[11px] font-medium text-red-600 hover:text-red-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

            <Link
              href={helpHref}
              title="Help"
              aria-label="Open help"
              className={`${darkIconButtonBase} order-3`}
            >
              <HelpCircleIcon className="h-4 w-4" />
            </Link>

            <div className="order-5 hidden h-5 w-px shrink-0 bg-slate-200/80" />

            {/* User avatar */}
            <div className="order-6">
              <UserMenu
                moduleKey={moduleKey}
                showApps={showTopBarAppLauncher}
                onOpenApps={() => {
                  setAppsOpen(true);
                  setNotificationsOpen(false);
                  setMessengerOpen(false);
                }}
                onOpenFeedback={() => {
                  setFeedbackOpen(true);
                  setNotificationsOpen(false);
                  setMessengerOpen(false);
                }}
                onToggleMessages={() => {
                  setMessengerOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
                messengerUnread={messengerUnread}
                helpHref={helpHref}
                reportingWindow={moduleKey === "donor" ? {
                  label: donorReportingModeLabel,
                  description: donorReportingModeDescription,
                  mode: reportingYearMode,
                  justChanged: reportingModeJustChanged,
                  onToggle: handleReportingWindowToggle,
                } : undefined}
              />
            </div>
          </div>
        </div>

        {mobileQuickOpen && (
          <>
            <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setMobileQuickOpen(false)} />
            <div className={`${mobileSheetBase} flex max-h-[82dvh] flex-col`}>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.09),transparent_32%),linear-gradient(90deg,#ffffff,#f8fafc)] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">Workspace tools</p>
                  <p className="truncate text-[11px] text-slate-500">{user ? `${user.firstName} ${user.lastName}` : "Signed in workspace"}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close workspace tools"
                  onClick={() => setMobileQuickOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
                {isStewardSignalsWorkspace && (
                  <button
                    title={signalsAnalyzeError ?? "Rebuild Steward Signals analysis index"}
                    onClick={() => {
                      setMobileQuickOpen(false);
                      void runStewardSignalsAnalysis();
                    }}
                    disabled={analyzingSignals}
                    className="w-full min-h-11 px-3 rounded-xl border border-green-300 bg-green-50 text-green-700 text-sm font-semibold text-left disabled:opacity-60"
                  >
                    {analyzingSignals ? "Analyzing..." : "Analyze Steward Signals"}
                  </button>
                )}

                {showTopBarAppLauncher ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileQuickOpen(false);
                      setAppsOpen(true);
                    }}
                    className="flex w-full min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700"
                  >
                    <AppsGridIcon className="h-4 w-4 shrink-0" />
                    Apps
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setMobileQuickOpen(false);
                    setMessengerOpen((current) => !current);
                  }}
                  className="flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700"
                >
                  <span className="inline-flex min-w-0 items-center gap-3">
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
                    </svg>
                    Messages
                  </span>
                  {messengerUnread > 0 ? (
                    <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {Math.min(messengerUnread, 99)}
                    </span>
                  ) : null}
                </button>

                <button
                  onClick={() => {
                    setMobileQuickOpen(false);
                    setFeedbackOpen(true);
                  }}
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium text-left"
                >
                  Send Feedback
                </button>

                <Link
                  href="/steward-ai-workspace"
                  onClick={() => setMobileQuickOpen(false)}
                  className="flex items-center gap-3 w-full min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium text-left"
                >
                  <StewardAvatarIcon size={16} alt="Steward" className="ring-slate-300/80" />
                  Open AI Assistant
                </Link>

                <Link
                  href={helpHref}
                  onClick={() => setMobileQuickOpen(false)}
                  className="flex items-center w-full min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium"
                >
                  Help & Documentation
                </Link>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="flex items-center gap-3 px-1 py-1.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                      {user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{user ? `${user.firstName} ${user.lastName}` : "Account"}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email ?? "Signed in"}</p>
                    </div>
                  </div>
                </div>

                {moduleKey === "donor" ? (
                  <button
                    type="button"
                    onClick={handleReportingWindowToggle}
                    title={donorReportingModeDescription}
                    className={`flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-medium transition-all ${
                      reportingYearMode === "fiscal"
                        ? "border-emerald-300 bg-emerald-50/80 text-emerald-800"
                        : "border-sky-300 bg-sky-50/80 text-sky-800"
                    } ${reportingModeJustChanged ? "ring-2 ring-emerald-300/70" : ""}`}
                  >
                    <span>Reporting Window</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      reportingYearMode === "fiscal"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-sky-100 text-sky-700"
                    }`}>{donorReportingModeLabel}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleMobileSignOut()}
                  className="w-full min-h-11 rounded-xl border border-red-100 bg-red-50 px-3 text-left text-sm font-semibold text-red-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
    </header>
    </>
  );
}

/**
 * ModuleSwitcher: lets users switch between all enabled OyamaCRM modules.
 */
function ModuleSwitcher({
  moduleKey,
  settings,
  scrolled = false,
}: {
  moduleKey: TopBarModuleKey;
  settings: WorkspaceSettings;
  scrolled?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const canViewHrm = user?.permissions?.includes("hrm.view") ?? user?.role !== "report_viewer";

  const modules = [
    {
      key: "donor",
      label: "DonorCRM",
      helper: "Fundraising",
      href: "/",
      icon: <WorkspaceSwitcherIcon moduleKey="donor" />,
      active: moduleKey === "donor",
    },
    {
      key: "compassion",
      label: "Compassion CRM",
      helper: "Client Care",
      href: "/compassion/dashboard",
      icon: <WorkspaceSwitcherIcon moduleKey="compassion" />,
      active: moduleKey === "compassion",
    },
    {
      key: "events",
      label: "EventSTUDIO",
      helper: "Operations",
      href: "/events",
      icon: <WorkspaceSwitcherIcon moduleKey="events" />,
      active: moduleKey === "events",
    },
    {
      key: "hrm",
      label: "OyamaHRM",
      helper: "HRM",
      href: "/hrm",
      icon: <WorkspaceSwitcherIcon moduleKey="hrm" />,
      active: moduleKey === "hrm",
    },
    {
      key: "oshareview",
      label: "OShareview",
      helper: "Reporting Hub",
      href: "/reports",
      icon: <WorkspaceSwitcherIcon moduleKey="oshareview" />,
      active: moduleKey === "oshareview",
    },
  ].filter((module) => {
    if (module.key === "donor") return settings.donorEnabled;
    if (module.key === "compassion") return settings.compassionEnabled;
    if (module.key === "hrm") return canViewHrm;
    return true;
  });

  if (modules.length === 0) return null;

  const current = modules.find((m) => m.active) ?? modules[0];
  const switcherButtonTone = "border-white/10 bg-white/10";

  function switchTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group flex items-center rounded-[20px] border ${switcherButtonTone} text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-emerald-400/40 hover:bg-white/20 ${scrolled ? "gap-1.5 px-1.5 py-1 xl:min-w-[152px] xl:gap-2 xl:rounded-2xl xl:px-2.5 xl:py-1.5" : "gap-2 px-2.5 py-1.5 xl:min-w-[184px] xl:gap-2.5 xl:rounded-[18px] xl:px-3 xl:py-2"}`}
      >
        <span className={`flex items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/15 text-emerald-200 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${scrolled ? "h-6 w-6 xl:h-7 xl:w-7" : "h-7 w-7 xl:h-8 xl:w-8"}`}>
          {current.icon}
        </span>
        <div className="hidden min-[1180px]:block text-left leading-tight min-w-0 lg:block">
          <p className={`overflow-hidden uppercase text-white/60 transition-[max-height,opacity,letter-spacing,font-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${scrolled ? "max-h-0 text-[0px] opacity-0" : "max-h-4 text-[9px] tracking-[0.16em] opacity-100"}`}>Workspace</p>
          <p className={`truncate font-semibold text-white transition-[font-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${scrolled ? "text-xs" : "text-[13px]"}`}>{current.label}</p>
        </div>
        <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform group-hover:text-emerald-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 bottom-2 z-50 mt-0 max-h-[82dvh] w-auto max-w-none overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-950 shadow-[0_24px_70px_rgba(2,6,23,0.38)] pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:absolute lg:inset-x-auto lg:left-0 lg:bottom-auto lg:top-full lg:mt-2 lg:max-h-[min(70vh,32rem)] lg:w-[320px] lg:max-w-[calc(100vw-1rem)] lg:pb-0">
            <div className={`px-4 pt-3 pb-2 border-b border-slate-800 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.18),transparent_34%),linear-gradient(90deg,#020617,#0f172a)]`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.22em]">Switch Workspace</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Open another module without leaving your current session.</p>
            </div>
            <div className="p-2.5 space-y-2">
              {modules.map((m) => (
                <button
                  key={m.key}
                  onClick={() => switchTo(m.href)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${m.active ? "border-emerald-400/30 bg-emerald-500/15" : "border-transparent bg-transparent hover:border-slate-700 hover:bg-white/8"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${m.active ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-slate-700 bg-white/5 text-slate-300"}`}>
                      {m.icon}
                    </span>
                    <div className="min-w-0 flex-1 px-2">
                      <p className="text-[13px] font-semibold text-white truncate">{m.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{m.helper}</p>
                    </div>
                    {m.active && (
                      <svg className="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface UserMenuProps {
  moduleKey: TopBarModuleKey;
  showApps: boolean;
  onOpenApps: () => void;
  onOpenFeedback: () => void;
  onToggleMessages: () => void;
  messengerUnread: number;
  helpHref: string;
  reportingWindow?: {
    label: string;
    description: string;
    mode: ReportingYearMode;
    justChanged: boolean;
    onToggle: () => void;
  };
}

/** UserMenu: avatar with account, workspace tools, and role-aware admin controls. */
function UserMenu({
  moduleKey,
  showApps,
  onOpenApps,
  onOpenFeedback,
  onToggleMessages,
  messengerUnread,
  helpHref,
  reportingWindow,
}: UserMenuProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?";
  const canSeeAdminMenu = user?.role === "admin" || user?.role === "super_admin";
  const adminLinks = [
    { label: "Settings Home", href: "/settings", icon: "M10.3 4.3c.4-1.8 2.9-1.8 3.4 0 .2.8.9 1.3 1.7 1.3.3 0 .6-.1.9-.2 1.5-.9 3.3.8 2.4 2.4-.5.8-.2 1.9.7 2.3 1.8.4 1.8 2.9 0 3.4-.8.2-1.3.9-1.3 1.7 0 .3.1.6.2.9.9 1.5-.8 3.3-2.4 2.4-.8-.5-1.9-.2-2.3.7-.4 1.8-2.9 1.8-3.4 0-.2-.8-.9-1.3-1.7-1.3-.3 0-.6.1-.9.2-1.5.9-3.3-.8-2.4-2.4.5-.8.2-1.9-.7-2.3-1.8-.4-1.8-2.9 0-3.4.8-.2 1.3-.9 1.3-1.7 0-.3-.1-.6-.2-.9-.9-1.5.8-3.3 2.4-2.4.8.5 1.9.2 2.3-.7zM12 15a3 3 0 100-6 3 3 0 000 6z" },
    { label: "Users", href: "/settings/users", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m20 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" },
    { label: "Roles", href: "/settings/roles", icon: "M12 3l7 4v5c0 4.5-2.9 8.5-7 9-4.1-.5-7-4.5-7-9V7l7-4zm-2 9 1.5 1.5L15 10" },
    { label: "Security", href: "/settings/security", icon: "M12 2l8 4v6c0 5.5-3.5 9.74-8 10-4.5-.26-8-4.5-8-10V6l8-4zm0 7v4m0 4h.01" },
    { label: "Modules", href: "/settings/modules", icon: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" },
    { label: "Imports", href: "/data-tools/import", icon: "M12 3v10m0 0 4-4m-4 4-4-4M5 17v2h14v-2" },
    { label: "Data Tools", href: "/data-tools", icon: "M12 3C7 3 3 4.8 3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7c0-2.2-4-4-9-4zm0 0c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4zm-9 9c0 2.2 4 4 9 4s9-1.8 9-4" },
    { label: "Custom Fields", href: "/custom-fields", icon: "M4 6h16M4 10h10M4 14h16M4 18h8M16 8v4m-2-2h4" },
    { label: "Audit Log", href: "/settings/audit", icon: "M7 4h10M7 8h10M7 12h6m-8 8h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { label: "System Status", href: "/settings/system-status", icon: "M4 13h3l2-6 4 12 2-6h5" },
  ];

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function runProfileAction(action: () => void) {
    setOpen(false);
    action();
  }

  function switchDonorNavigationLayout(layout: "mega" | "sidebar") {
    window.dispatchEvent(new CustomEvent("crm:set-donor-shell-layout", { detail: { layout } }));
  }

  const avatarCls = moduleKey === "compassion"
    ? "bg-blue-700 border-blue-200"
    : moduleKey === "events"
      ? "bg-violet-700 border-violet-200"
      : moduleKey === "watchdog"
        ? "bg-red-700 border-red-200"
        : moduleKey === "webmaster"
          ? "bg-indigo-700 border-indigo-200"
          : moduleKey === "hrm"
            ? "bg-teal-700 border-teal-200"
            : moduleKey === "oshareview"
              ? "bg-cyan-700 border-cyan-200"
          : "bg-emerald-700 border-emerald-200";

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={user ? `${user.firstName} ${user.lastName}` : "Account"}
        className="flex h-11 items-center gap-2.5 rounded-[18px] border border-transparent px-1.5 pr-2 text-left transition-colors hover:bg-slate-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)] ${avatarCls}`}>
          {initials}
        </span>
        <span className="hidden min-w-0 leading-tight 2xl:block">
          <span className="block max-w-[132px] truncate text-sm font-semibold text-slate-900">
            {user ? `${user.firstName} ${user.lastName}` : "Account"}
          </span>
          <span className="block max-w-[132px] truncate text-xs text-slate-500">Oyama Organization</span>
        </span>
        <svg className={`hidden h-4 w-4 text-slate-500 transition-transform xl:block ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 bottom-2 z-50 max-h-[calc(100dvh-1rem)] w-auto overflow-y-auto rounded-2xl border border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl xl:absolute xl:inset-x-auto xl:right-0 xl:bottom-auto xl:top-full xl:mt-2 xl:max-h-[min(80vh,44rem)] xl:w-[min(23rem,calc(100vw-1rem))] xl:pb-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">{user?.role}</span>
            </div>
            <div className="border-b border-slate-100 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">More Tools</p>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-100">Workspace</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {showApps ? (
                  <button
                    type="button"
                    onClick={() => runProfileAction(onOpenApps)}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-transparent bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <AppsGridIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 truncate">Apps</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => runProfileAction(onOpenFeedback)}
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-transparent bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
                  </svg>
                  <span className="min-w-0 truncate">Feedback</span>
                </button>
                <button
                  type="button"
                  onClick={() => runProfileAction(onToggleMessages)}
                  className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-transparent bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
                    </svg>
                    <span className="min-w-0 truncate">Messages</span>
                  </span>
                  {messengerUnread > 0 ? (
                    <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {Math.min(messengerUnread, 99)}
                    </span>
                  ) : null}
                </button>
                <Link
                  href="/steward-ai-workspace"
                  onClick={() => setOpen(false)}
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-transparent bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <StewardAvatarIcon size={14} alt="Steward" className="ring-slate-300/80" />
                  <span className="min-w-0 truncate">Steward</span>
                </Link>
                <Link
                  href={helpHref}
                  onClick={() => setOpen(false)}
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-transparent bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <HelpCircleIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 truncate">Help</span>
                </Link>
                {reportingWindow ? (
                  <button
                    type="button"
                    onClick={() => runProfileAction(reportingWindow.onToggle)}
                    title={reportingWindow.description}
                    className={`flex min-h-10 items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-[12px] font-semibold shadow-sm transition-colors ${
                      reportingWindow.mode === "fiscal"
                        ? "border-emerald-200 bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100"
                        : "border-sky-200 bg-sky-50/90 text-sky-800 hover:bg-sky-100"
                    } ${reportingWindow.justChanged ? "ring-2 ring-emerald-300/70" : ""}`}
                  >
                    <span className="min-w-0 truncate">Reporting</span>
                    <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">{reportingWindow.label}</span>
                  </button>
                ) : null}
                {moduleKey === "donor" ? (
                  <button
                    type="button"
                    onClick={() => runProfileAction(() => switchDonorNavigationLayout("mega"))}
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-transparent bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M8 6v12" />
                    </svg>
                    <span className="min-w-0 truncate">Top Nav</span>
                  </button>
                ) : null}
              </div>
            </div>
            {canSeeAdminMenu ? (
              <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Admin Controls</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">Admin</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {adminLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-10 items-center gap-2 rounded-xl border border-transparent bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                      </svg>
                      <span className="min-w-0 truncate">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="py-1">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
