// TopBar: full-width global navigation header with logo, module switcher, search, and user controls.
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import AppsDrawer, { AppsGridIcon } from "@/app/components/layout/AppsDrawer";
import StewardChatPanel, { type StewardPanelMode } from "@/app/components/ai/StewardChatPanel";
import { FeedbackButton } from "@/app/components/feedback/FeedbackButton";
import { FeedbackModal } from "@/app/components/feedback/FeedbackModal";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";
import { apiFetch } from "@/app/lib/auth-client";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  fetchWorkspaceSettings,
  type WorkspaceSettings,
} from "@/app/lib/workspace-settings";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/app/lib/navigation-boundaries";
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
  module: "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "reportit" | "hrm";
  query: string;
  results: SearchResult[];
}

interface TopBarNotification {
  id: string;
  type: "task" | "meeting" | "follow_up" | "appointment";
  title: string;
  message: string;
  href: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
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

/** Generic sparkles icon used for AI assistant trigger in topbar controls. */
function SparklesIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3zM6 14l.9 2.1L9 17l-2.1.9L6 20l-.9-2.1L3 17l2.1-.9L6 14zM18 13l1 2.3L21.3 16 19 17l-1 2.3-1-2.3L14.7 16l2.3-.7 1-2.3z" />
    </svg>
  );
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

function GlobalSearch({ moduleKey, pathname }: { moduleKey: TopBarModuleKey; pathname: string }) {
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

  const quickActions: SearchResult[] = moduleKey === "compassion"
    ? [
      { id: "quick-compassion-dashboard", type: "tool", label: "Open Compassion Dashboard", sublabel: "Workspace home", href: "/compassion/dashboard", group: "tools" },
      { id: "quick-compassion-clients", type: "tool", label: "Open Clients", sublabel: "Client records and profiles", href: "/compassion/clients", group: "tools" },
      { id: "quick-compassion-appointments", type: "tool", label: "Open Appointments", sublabel: "Calendar and scheduling", href: "/compassion/appointments", group: "tools" },
      { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=compassion&scopePath=${encodeURIComponent(pathname || "/compassion/dashboard")}`, group: "tools" },
    ]
    : moduleKey === "events"
      ? [
        { id: "quick-events-workspace", type: "tool", label: "Open Events Workspace", sublabel: "Select and manage event context", href: "/events/workspace", group: "tools" },
        { id: "quick-events-registry", type: "tool", label: "Open Events Registry", sublabel: "All events", href: "/events/events", group: "tools" },
        { id: "quick-events-checkin", type: "tool", label: "Open Event Check-In", sublabel: "Guest arrival workflows", href: "/events/checkin", group: "tools" },
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
          : moduleKey === "reportit"
            ? [
              { id: "quick-reportit-home", type: "tool", label: "Open Reports Hub", sublabel: "Reporting workspace", href: "/reports", group: "tools" },
              { id: "quick-reportit-builder", type: "tool", label: "Open Report Builder", sublabel: "Create custom reports", href: "/reports/builder", group: "tools" },
              { id: "quick-reportit-segments", type: "tool", label: "Open Segments", sublabel: "Audience and cohort sets", href: "/reports/segments", group: "tools" },
              { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=donor&scopePath=${encodeURIComponent(pathname || "/reports")}`, group: "tools" },
            ]
            : [
              { id: "quick-donor-home", type: "tool", label: "Open Donor Dashboard", sublabel: "Fundraising home", href: "/", group: "tools" },
              { id: "quick-donor-constituents", type: "tool", label: "Open Constituents", sublabel: "Profiles and stewardship", href: "/constituents", group: "tools" },
              { id: "quick-donor-donations", type: "tool", label: "Open Donations", sublabel: "Gift records", href: "/donations", group: "tools" },
              { id: "quick-donor-campaigns", type: "tool", label: "Open Campaigns", sublabel: "Fundraising initiatives", href: "/campaigns", group: "tools" },
              { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=donor&scopePath=${encodeURIComponent(pathname || "/")}`, group: "tools" },
            ];

  const filteredResults = (resultGroupFilter === "all"
    ? results
    : results.filter((result) => result.group === resultGroupFilter)
  ).slice(0, 12);

  const quickActionMatches = (() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return quickActions.slice(0, 5);
    return quickActions
      .filter((action) =>
        action.label.toLowerCase().includes(normalized)
        || (action.sublabel ?? "").toLowerCase().includes(normalized)
      )
      .slice(0, 4);
  })();

  const combinedNavigableResults = query.trim()
    ? [...filteredResults, ...quickActionMatches.filter((action) => !filteredResults.some((result) => result.href === action.href))]
    : quickActions.slice(0, 5);

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
      const searchModule = moduleKey === "reportit" || moduleKey === "hrm" ? "donor" : moduleKey;
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
      ? "focus:ring-amber-400/60"
      : moduleKey === "watchdog"
        ? "focus:ring-red-400/60"
        : moduleKey === "webmaster"
          ? "focus:ring-indigo-400/60"
          : moduleKey === "hrm"
            ? "focus:ring-teal-400/60"
          : moduleKey === "reportit"
              ? "focus:ring-cyan-400/60"
          : "focus:ring-green-400/60";
  const activeResultBg = moduleKey === "compassion"
    ? "bg-blue-50"
    : moduleKey === "events"
      ? "bg-amber-50"
      : moduleKey === "watchdog"
        ? "bg-red-50"
        : moduleKey === "webmaster"
          ? "bg-indigo-50"
          : moduleKey === "hrm"
            ? "bg-teal-50"
          : moduleKey === "reportit"
              ? "bg-cyan-50"
          : "bg-green-50";
  const spinnerColor = moduleKey === "compassion"
    ? "border-blue-400"
    : moduleKey === "events"
      ? "border-amber-400"
      : moduleKey === "watchdog"
        ? "border-red-400"
        : moduleKey === "webmaster"
          ? "border-indigo-400"
          : moduleKey === "hrm"
            ? "border-teal-500"
          : moduleKey === "reportit"
              ? "border-cyan-500"
          : "border-green-400";
  const placeholder = moduleKey === "compassion"
    ? "Search tools, clients, cases, commands... (Ctrl+K)"
    : moduleKey === "events"
      ? "Search tools, events, guests, commands... (Ctrl+K)"
      : moduleKey === "watchdog"
        ? "Search security tools, vault items, commands... (Ctrl+K)"
        : moduleKey === "webmaster"
          ? "Search templates, pages, website tools, commands... (Ctrl+K)"
          : moduleKey === "hrm"
            ? "Search staff, schedules, locations, messages... (Ctrl+K)"
          : moduleKey === "reportit"
              ? "Search reports, segments, analytics views, commands... (Ctrl+K)"
          : "Search tools, constituents, campaigns, commands... (Ctrl+K)";

  return (
    <div className="relative w-full min-w-0 max-w-3xl">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className={`w-full pl-11 pr-16 py-2.5 text-sm bg-white/12 text-white placeholder:text-gray-300 border border-white/20 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.18)] backdrop-blur-sm focus:outline-none focus:ring-1 ${focusRing} focus:bg-white/20 transition-all`}
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-300 bg-white/10 px-1.5 py-0.5 rounded border border-white/20 hidden md:block">
          Ctrl+K
        </kbd>
        {loading && (
          <div className={`absolute right-11 top-1/2 -translate-y-1/2 w-3 h-3 border-2 ${spinnerColor} border-t-transparent rounded-full animate-spin`} />
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl border border-gray-200 shadow-2xl z-50 overflow-hidden">
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

/** Full-width top navigation bar — spans the entire viewport width. */
export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const moduleKey = resolveTopBarModuleKey(pathname);
  const showTopBarAppLauncher = false;
  const [appsOpen, setAppsOpen] = useState(false);
  const [stewardMode, setStewardMode] = useState<StewardPanelMode>("collapsed");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<TopBarNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [analyzingSignals, setAnalyzingSignals] = useState(false);
  const [signalsAnalyzeError, setSignalsAnalyzeError] = useState<string | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const isStewardSignalsWorkspace = moduleKey === "donor" && pathname.startsWith("/steward-signals");
  const chromeButtonBase = "w-9 h-9 rounded-xl border border-white/20 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-sm flex items-center justify-center transition-all";
  const iconActiveTone = moduleKey === "compassion"
    ? "text-white border-blue-300/50 bg-blue-500/25 ring-1 ring-blue-300/35"
    : moduleKey === "events"
      ? "text-white border-amber-300/50 bg-amber-500/25 ring-1 ring-amber-300/35"
      : moduleKey === "watchdog"
        ? "text-white border-red-300/50 bg-red-500/25 ring-1 ring-red-300/35"
        : moduleKey === "webmaster"
          ? "text-white border-indigo-300/50 bg-indigo-500/25 ring-1 ring-indigo-300/35"
          : moduleKey === "hrm"
            ? "text-white border-teal-300/50 bg-teal-500/25 ring-1 ring-teal-300/35"
          : moduleKey === "reportit"
            ? "text-white border-cyan-300/50 bg-cyan-500/25 ring-1 ring-cyan-300/35"
            : "text-white border-green-300/50 bg-green-500/25 ring-1 ring-green-300/35";
  const topBarRightTint = moduleKey === "compassion"
    ? "#1e3a8a"
    : moduleKey === "events"
      ? "#7c2d12"
      : moduleKey === "watchdog"
        ? "#7f1d1d"
        : moduleKey === "webmaster"
          ? "#3730a3"
          : moduleKey === "hrm"
            ? "#0f766e"
          : moduleKey === "reportit"
            ? "#155e75"
            : "#14532d";
  const topBarBackground = `linear-gradient(90deg, #0f172a 0%, #18253a 56%, ${topBarRightTint} 100%)`;
  const homeHref = moduleKey === "compassion"
    ? "/compassion/dashboard"
    : moduleKey === "events"
      ? "/events/workspace"
      : moduleKey === "watchdog"
        ? "/watchdog"
        : moduleKey === "webmaster"
          ? "/webmaster"
          : moduleKey === "hrm"
            ? "/hrm"
          : moduleKey === "reportit"
            ? "/reports"
            : "/";
  const helpHref = buildHelpHref({
    scope: mapModuleKeyToHelpScope(moduleKey),
    scopePath: pathname,
  });

  useEffect(() => {
    let active = true;

    async function loadWorkspaceSettings() {
      const settings = await fetchWorkspaceSettings();
      if (!active) return;
      setWorkspaceSettings(settings);
    }

    void loadWorkspaceSettings();
    return () => {
      active = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const notificationModule = moduleKey === "reportit" || moduleKey === "hrm" ? "donor" : moduleKey;
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
  }, [moduleKey]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const timer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notificationsOpen, loadNotifications]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotificationsOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

  // Legacy compatibility: allow links like /?steward=open to open the popout Steward assistant.
  useEffect(() => {
    if (searchParams.get("steward") !== "open") return;
    setStewardMode((current) => (current === "collapsed" ? "popout" : current));
  }, [searchParams]);

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
  }, [isStewardSignalsWorkspace, analyzingSignals]);

  return (
    <>
      {showTopBarAppLauncher ? <AppsDrawer open={appsOpen} onClose={() => setAppsOpen(false)} /> : null}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        moduleKey={moduleKey}
        pathname={pathname}
      />
      <StewardChatPanel
        open={stewardMode !== "collapsed"}
        onClose={() => setStewardMode("collapsed")}
        moduleKey={moduleKey}
        scopePath={pathname}
        displayMode={stewardMode === "collapsed" ? "popout" : stewardMode}
        onDisplayModeChange={setStewardMode}
      />
      <header className="relative h-14 shrink-0 w-full flex items-center gap-2 md:gap-4 px-2 md:px-4 border-b border-slate-700/60 shadow-[0_8px_28px_rgba(2,6,23,0.38)] backdrop-blur z-20 isolate" style={{ background: topBarBackground }}>
        {/* Diagonal light segment for brand + module switcher area. */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-[min(430px,38vw)] border-r border-white/35 pointer-events-none"
          style={{
            clipPath: "polygon(0 0, 88% 0, 100% 100%, 0 100%)",
            background: "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.92) 100%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          {/* ── TopBar Brand ── */}
          <Link href={homeHref} className="shrink-0 flex items-center rounded-lg px-1.5 py-1 hover:bg-slate-200/70 transition-colors" aria-label="Go to workspace home">
            <Image
              src="/branding/oyama-logo-w384.png"
              alt="OyamaCRM"
              width={132}
              height={24}
              className="block h-6 w-auto object-contain"
              priority
            />
          </Link>

          <div className="w-px h-6 bg-slate-300/90 shrink-0" />

          {/* ── Module switcher (left anchor) ── */}
          {workspaceSettings.showModuleSwitcher && (
            <>
              <ModuleSwitcher moduleKey={moduleKey} settings={workspaceSettings} />
              {/* ── Divider ── */}
              <div className="w-px h-6 bg-slate-300/90 shrink-0" />
            </>
          )}
        </div>

        <div className="relative z-10 flex-1 min-w-0 flex items-center gap-2 md:gap-4">
          {/* ── Search (centered) ── */}
          <div className="flex-1 min-w-0 flex justify-center px-0 sm:px-2 md:px-3">
            <GlobalSearch moduleKey={moduleKey} pathname={pathname} />
          </div>

          {/* ── Right-side icon controls ── */}
          <div className="flex items-center gap-1 shrink-0">

          {isStewardSignalsWorkspace && (
            <button
              title={signalsAnalyzeError ?? "Rebuild Steward Signals analysis index"}
              onClick={() => void runStewardSignalsAnalysis()}
              disabled={analyzingSignals}
              className="h-9 px-3 rounded-lg border border-green-400/40 bg-green-500/20 text-green-100 text-xs font-semibold hover:bg-green-500/30 disabled:opacity-60"
            >
              {analyzingSignals ? "Analyzing..." : "Analyze"}
            </button>
          )}

          {showTopBarAppLauncher ? (
            <button
              title="Apps"
              onClick={() => setAppsOpen((v) => !v)}
              className={`${chromeButtonBase} ${appsOpen ? iconActiveTone : "text-white/90 hover:text-white hover:bg-white/14 hover:border-white/30 hover:-translate-y-px"}`}
            >
              <AppsGridIcon className="w-4 h-4" />
            </button>
          ) : null}

          <FeedbackButton
            onClick={() => setFeedbackOpen(true)}
            className={`${chromeButtonBase} text-white/90 hover:text-white hover:bg-white/14 hover:border-white/30 hover:-translate-y-px`}
          />

          {/* AI Assistant */}
          <button
            title="Open Steward AI Assistant"
            onClick={() => setStewardMode((current) => (current === "collapsed" ? "popout" : "collapsed"))}
            className={`${chromeButtonBase} relative group ${stewardMode !== "collapsed" ? iconActiveTone : "text-white/90 hover:text-white hover:bg-white/14 hover:border-white/30 hover:-translate-y-px"}`}
          >
            <SparklesIcon className="w-5 h-5" />
          <span className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            AI Assistant
          </span>
        </button>

        {/* Help */}
        <Link
          href={helpHref}
          title="Help & Documentation"
          className={`${chromeButtonBase} text-white/90 hover:text-white hover:bg-white/14 hover:border-white/30 hover:-translate-y-px`}
        >
          <HelpCircleIcon className="w-5 h-5" />
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            title="Notifications"
            onClick={() => setNotificationsOpen((v) => !v)}
            className={`${chromeButtonBase} text-white/90 hover:text-white hover:bg-white/14 hover:border-white/30 hover:-translate-y-px relative`}
          >
            <BellIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${
                moduleKey === "compassion"
                  ? "bg-blue-500"
                  : moduleKey === "events"
                    ? "bg-amber-500"
                    : moduleKey === "watchdog"
                      ? "bg-red-600"
                      : moduleKey === "webmaster"
                        ? "bg-indigo-600"
                        : moduleKey === "hrm"
                          ? "bg-teal-600"
                            : moduleKey === "reportit"
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
              <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
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
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          router.push(item.href);
                        }}
                        className="w-full px-4 py-3 border-b border-gray-100 text-left hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${item.priority === "high" ? "bg-red-100 text-red-700" : item.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

            <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

            {/* User avatar */}
            <UserMenu moduleKey={moduleKey} />
          </div>
        </div>
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
}: {
  moduleKey: TopBarModuleKey;
  settings: WorkspaceSettings;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const modules = [
    {
      key: "donor",
      label: "DonorCRM",
      helper: "Fundraising",
      href: "/",
      icon: (
        <OyamaGradientIcon name="donor-gift" size={16} />
      ),
      active: moduleKey === "donor",
    },
    {
      key: "compassion",
      label: "Compassion CRM",
      helper: "Client Care",
      href: "/compassion/dashboard",
      icon: (
        <OyamaGradientIcon name="client-support-chat" size={16} />
      ),
      active: moduleKey === "compassion",
    },
    {
      key: "events",
      label: "Events CRM",
      helper: "Operations",
      href: "/events",
      icon: (
        <OyamaGradientIcon name="task-checklist" size={16} />
      ),
      active: moduleKey === "events",
    },
    {
      key: "watchdog",
      label: "OyamaWatchdog",
      helper: "Security",
      href: "/watchdog",
      icon: (
        <OyamaGradientIcon name="client-profile-sync" size={16} />
      ),
      active: moduleKey === "watchdog",
    },
    {
      key: "webmaster",
      label: "OyamaWebMaster",
      helper: "Web Builder",
      href: "/webmaster",
      icon: (
        <OyamaGradientIcon name="growth-analytics" size={16} />
      ),
      active: moduleKey === "webmaster",
    },
    {
      key: "hrm",
      label: "OyamaHRM",
      helper: "HRM",
      href: "/hrm",
      icon: (
        <OyamaGradientIcon name="relationship-partnership" size={16} />
      ),
      active: moduleKey === "hrm",
    },
    {
      key: "reportit",
      label: "OyamaREPORTIT CRM",
      helper: "Reporting Hub",
      href: "/reports",
      icon: (
        <OyamaGradientIcon name="reporting-dashboard" size={16} />
      ),
      active: moduleKey === "reportit",
    },
  ].filter((module) => {
    if (module.key === "donor") return settings.donorEnabled;
    if (module.key === "compassion") return settings.compassionEnabled;
    // TODO: replace role-only gate with explicit HRM workspace permission checks.
    if (module.key === "hrm") return user?.role !== "report_viewer";
    return true;
  });

  if (modules.length === 0) return null;

  const current = modules.find((m) => m.active) ?? modules[0];
  const switcherButtonTone = "from-slate-100/95 to-slate-200/95 border-slate-300/90";
  const switcherTone = current.key === "compassion"
    ? "from-blue-50 to-sky-50 border-blue-200/80"
    : current.key === "events"
      ? "from-amber-50 to-orange-50 border-amber-200/80"
      : current.key === "watchdog"
        ? "from-red-50 to-rose-50 border-red-200/80"
        : current.key === "webmaster"
          ? "from-indigo-50 to-violet-50 border-indigo-200/80"
          : current.key === "hrm"
            ? "from-teal-50 to-cyan-50 border-teal-200/80"
          : current.key === "reportit"
            ? "from-cyan-50 to-sky-50 border-cyan-200/80"
            : "from-green-50 to-emerald-50 border-green-200/80";

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
        className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border bg-gradient-to-br ${switcherButtonTone} text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition-all`}
      >
        <span className="w-8 h-8 rounded-xl border border-slate-300/90 bg-white/90 shadow-[0_1px_4px_rgba(15,23,42,0.08)] text-slate-700 flex items-center justify-center">
          {current.icon}
        </span>
        <div className="hidden sm:block text-left leading-tight min-w-0">
          <p className="text-[9px] uppercase tracking-[0.22em] text-slate-500">Workspace</p>
          <p className="text-xs font-semibold text-slate-900 truncate">{current.label}</p>
        </div>
        <svg className={`w-3.5 h-3.5 ml-0.5 text-slate-500 group-hover:text-slate-700 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-[320px] max-w-[calc(100vw-1rem)] bg-white/98 rounded-[22px] shadow-[0_18px_42px_rgba(15,23,42,0.18)] border border-slate-200/90 z-50 overflow-hidden backdrop-blur-xl">
            <div className={`px-4 pt-3 pb-2 border-b border-slate-100 bg-gradient-to-r ${switcherTone}`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.22em]">Switch CRM</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Choose the workspace you want to open next.</p>
            </div>
            <div className="p-2.5 space-y-2">
              {modules.map((m) => (
                <button
                  key={m.key}
                  onClick={() => switchTo(m.href)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${m.active ? "border-slate-300 bg-slate-100 shadow-sm ring-1 ring-slate-200" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center justify-center shrink-0">
                      {m.icon}
                    </span>
                    <div className="min-w-0 flex-1 px-2">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{m.label}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5 truncate">{m.helper}</p>
                    </div>
                    {m.active && (
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

/** UserMenu: avatar with sign-out dropdown. */
function UserMenu({ moduleKey }: { moduleKey: TopBarModuleKey }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const avatarCls = moduleKey === "compassion"
    ? "bg-blue-700 border-blue-500"
    : moduleKey === "events"
      ? "bg-amber-700 border-amber-500"
      : moduleKey === "watchdog"
        ? "bg-red-700 border-red-500"
        : moduleKey === "webmaster"
          ? "bg-indigo-700 border-indigo-500"
          : moduleKey === "hrm"
            ? "bg-teal-700 border-teal-500"
            : moduleKey === "reportit"
              ? "bg-cyan-700 border-cyan-500"
          : "bg-green-700 border-green-500";

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={user ? `${user.firstName} ${user.lastName}` : "Account"}
        className={`w-8 h-8 rounded-full border-2 text-white flex items-center justify-center text-xs font-bold hover:opacity-90 transition-colors ${avatarCls}`}
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">{user?.role}</span>
            </div>
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
