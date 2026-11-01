"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { mapModuleKeyToHelpScope } from "@/app/help-content";
import { apiFetch } from "@/app/lib/auth-client";
import type { TopBarModuleKey } from "@/app/lib/navigation-boundaries";

interface SearchResult {
  id: string;
  type: "tool" | "constituent" | "donation" | "campaign" | "client" | "case" | "event" | "guest" | "site" | "page";
  label: string;
  sublabel?: string;
  href: string;
  group: "tools" | "records";
}

interface SearchResponse {
  module: "donor" | "events" | "watchdog" | "webmaster" | "oshareview";
  query: string;
  results: SearchResult[];
}

export default function GlobalSearch({
  moduleKey,
  pathname,
  autoFocus = false,
  onNavigate,
  wide = false,
  darkChrome = false,
}: {
  moduleKey: TopBarModuleKey;
  pathname: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  wide?: boolean;
  darkChrome?: boolean;
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

  const quickActions: SearchResult[] = useMemo(() => moduleKey === "events"
      ? [
        { id: "quick-events-workspace", type: "tool", label: "Open Events", sublabel: "Find, create, or open an event", href: "/events", group: "tools" },
        { id: "quick-events-registry", type: "tool", label: "New Event", sublabel: "Create a standard event or trivia night", href: "/events", group: "tools" },
        { id: "quick-events-checkin", type: "tool", label: "Open Event Check-In", sublabel: "Use All Events to select event first", href: "/events/events", group: "tools" },
        { id: "quick-help", type: "tool", label: "Open Help Center", sublabel: "Guides and walkthroughs", href: `/help?scope=events&scopePath=${encodeURIComponent(pathname || "/events")}`, group: "tools" },
      ]
      : moduleKey === "watchdog"
        ? [
          { id: "quick-watchdog-home", type: "tool", label: "Open Watchdog Home", sublabel: "Security workspace", href: "/watchdog", group: "tools" },
          { id: "quick-watchdog-support", type: "tool", label: "Open Support Tickets", sublabel: "Review organization support requests", href: "/watchdog/support-tickets", group: "tools" },
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
          : moduleKey === "oshareview"
            ? [
              { id: "quick-donor-reports", type: "tool", label: "Open donor reports", sublabel: "Month-to-date giving workbook", href: "/reports", group: "tools" },
              { id: "quick-donor-designations", type: "tool", label: "Donors by designation", sublabel: "Month-to-date donor giving", href: "/reports?sheet=designation", group: "tools" },
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
    function focusSearch() {
      if (!inputRef.current?.getClientRects().length) return;
      inputRef.current?.focus();
      setOpen(true);
    }

    window.addEventListener("crm:focus-topbar-search", focusSearch);
    return () => window.removeEventListener("crm:focus-topbar-search", focusSearch);
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
      const searchModule = moduleKey === "oshareview" || moduleKey === "letters" ? "donor" : moduleKey;
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

  const focusRing = moduleKey === "events"
      ? "focus:ring-violet-400/60"
      : moduleKey === "watchdog"
        ? "focus:ring-red-400/60"
        : moduleKey === "webmaster"
          ? "focus:ring-indigo-400/60"
          : moduleKey === "oshareview"
              ? "focus:ring-cyan-400/60"
          : "focus:ring-indigo-400/60";
  const activeResultBg = moduleKey === "events"
      ? "bg-violet-50"
      : moduleKey === "watchdog"
        ? "bg-red-50"
        : moduleKey === "webmaster"
          ? "bg-indigo-50"
          : moduleKey === "oshareview"
              ? "bg-cyan-50"
          : "bg-indigo-50";
  const spinnerColor = moduleKey === "events"
      ? "border-violet-400"
      : moduleKey === "watchdog"
        ? "border-red-400"
        : moduleKey === "webmaster"
          ? "border-indigo-400"
          : moduleKey === "oshareview"
              ? "border-cyan-500"
          : "border-indigo-400";
  const placeholder = moduleKey === "events"
      ? "Search events, guests, tools..."
      : moduleKey === "watchdog"
        ? "Search alerts, vault, security tools..."
        : moduleKey === "webmaster"
          ? "Search sites, pages, publish tools..."
          : moduleKey === "oshareview"
              ? "Search reports, segments, analytics..."
          : "Search CRM...";

  return (
    <div className={`relative w-full min-w-0 ${wide ? "max-w-none" : "max-w-xl"}`}>
      <div className="group/search relative transition-colors duration-200 ease-out">
        <svg className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none transition-colors duration-200 ease-out ${darkChrome ? "text-slate-400 group-focus-within/search:text-white" : "text-slate-500 group-focus-within/search:text-slate-700"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          aria-label="Search CRM"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={`w-full rounded-xl border pl-8 pr-12 shadow-sm transition-colors duration-200 ease-out focus:outline-none focus:ring-1 ${darkChrome ? "border-white/10 bg-transparent text-white placeholder:text-slate-400 focus:border-emerald-300/50 focus:bg-white/[0.04] focus:ring-emerald-300/30" : `border-slate-200 bg-white text-slate-900 placeholder:text-slate-500 focus:border-indigo-300 focus:bg-white ${focusRing}`} ${wide ? "h-12 text-sm" : "py-2 text-xs"}`}
        />
        <kbd className={`absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition-colors duration-200 ease-out min-[1120px]:block ${darkChrome ? "border-white/10 bg-white/[0.06] text-slate-400 group-focus-within/search:bg-white/[0.1] group-focus-within/search:text-white" : "border-slate-200 bg-slate-50 text-slate-500 group-focus-within/search:bg-white group-focus-within/search:text-slate-700"}`}>
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

