// TopBar: full-width global navigation header with logo, module switcher, search, and user controls.
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import AppsDrawer, { AppsGridIcon } from "@/app/components/layout/AppsDrawer";
import StewardChatPanel, { type StewardPanelMode } from "@/app/components/ai/StewardChatPanel";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";
import { apiFetch } from "@/app/lib/auth-client";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  fetchWorkspaceSettings,
  type WorkspaceSettings,
} from "@/app/lib/workspace-settings";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/app/lib/navigation-boundaries";

interface SearchResult {
  id: string;
  type: "tool" | "constituent" | "donation" | "campaign" | "client" | "case" | "event" | "guest" | "site" | "page";
  label: string;
  sublabel?: string;
  href: string;
  group: "tools" | "records";
}

interface SearchResponse {
  module: "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "reportit";
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

function GlobalSearch({ moduleKey }: { moduleKey: TopBarModuleKey }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastRequestIdRef = useRef(0);

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

  const search = useCallback(async (q: string) => {
    const normalized = q.trim();
    if (!normalized) { setResults([]); setOpen(false); return; }

    const requestId = ++lastRequestIdRef.current;
    setLoading(true);
    try {
      const searchModule = moduleKey === "reportit" ? "donor" : moduleKey;
      const params = new URLSearchParams({
        module: searchModule,
        q: normalized,
        limit: "6",
      });
      const data = await apiFetch<SearchResponse>(`/api/search?${params.toString()}`);

      // Ignore stale responses when users type quickly and previous requests finish late.
      if (requestId !== lastRequestIdRef.current) return;

      setResults(data.results);
      setOpen(true);
      setSelected(0);
    } catch {
      if (requestId !== lastRequestIdRef.current) return;
      setResults([]);
      setOpen(false);
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [moduleKey]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected].href);
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
    if (type === "tool") return <OyamaGradientIcon name="contact-checklist" size={16} />;
    if (type === "event") return <OyamaGradientIcon name="task-checklist" size={16} />;
    if (type === "guest") return <OyamaGradientIcon name="constituent-search" size={16} />;
    if (type === "client") return <OyamaGradientIcon name="client-support-chat" size={16} />;
    if (type === "case") return <OyamaGradientIcon name="contact-checklist" size={16} />;
    if (type === "constituent") return <OyamaGradientIcon name="constituent-search" size={16} />;
    if (type === "campaign") return <OyamaGradientIcon name="goal-target" size={16} />;
    if (type === "site") return <OyamaGradientIcon name="growth-analytics" size={16} />;
    if (type === "page") return <OyamaGradientIcon name="reporting-dashboard" size={16} />;
    return <OyamaGradientIcon name="donor-gift" size={16} />;
  }

  const focusRing = moduleKey === "compassion"
    ? "focus:ring-blue-400/60"
    : moduleKey === "events"
      ? "focus:ring-amber-400/60"
      : moduleKey === "watchdog"
        ? "focus:ring-red-400/60"
        : moduleKey === "webmaster"
          ? "focus:ring-indigo-400/60"
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
          : moduleKey === "reportit"
              ? "border-cyan-500"
          : "border-green-400";
  const placeholder = moduleKey === "compassion"
    ? "Search tools, clients, and cases (Ctrl+K)"
    : moduleKey === "events"
      ? "Search tools, events, and guests (Ctrl+K)"
      : moduleKey === "watchdog"
        ? "Search security tools and vault items (Ctrl+K)"
        : moduleKey === "webmaster"
          ? "Search templates, pages, and website tools (Ctrl+K)"
          : moduleKey === "reportit"
              ? "Search reports, segments, and analytics views (Ctrl+K)"
          : "Search tools, constituents, campaigns... (Ctrl+K)";

  return (
    <div className="relative w-full max-w-3xl">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
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
          {results.length > 0 ? (
          <ul className="py-1">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  onMouseDown={() => navigate(r.href)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? activeResultBg : "hover:bg-gray-50"}`}
                >
                  <TypeIcon type={r.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                    <p className="text-xs text-gray-400 truncate">{r.sublabel}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide shrink-0 px-1.5 py-0.5 rounded-full border ${r.group === "tools" ? "text-slate-500 bg-slate-50 border-slate-200" : "text-gray-400 bg-gray-50 border-gray-200"}`}>
                    {typeLabel[r.type]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          ) : (
            <div className="px-4 py-4 text-sm text-gray-500">No matches in this CRM scope.</div>
          )}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 bg-gray-50">
            <span className="text-xs text-gray-400">↑↓ navigate</span>
            <span className="text-xs text-gray-400">↵ open</span>
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<TopBarNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [analyzingSignals, setAnalyzingSignals] = useState(false);
  const [signalsAnalyzeError, setSignalsAnalyzeError] = useState<string | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const isStewardSignalsWorkspace = moduleKey === "donor" && pathname.startsWith("/steward-signals");
  const chromeButtonBase = "w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center transition-colors";
  const homeHref = moduleKey === "compassion"
    ? "/compassion/dashboard"
    : moduleKey === "events"
      ? "/events/workspace"
      : moduleKey === "watchdog"
        ? "/watchdog"
        : moduleKey === "webmaster"
          ? "/webmaster"
          : moduleKey === "reportit"
            ? "/reports"
            : "/";

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
      const notificationModule = moduleKey === "reportit" ? "donor" : moduleKey;
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
      <StewardChatPanel
        open={stewardMode !== "collapsed"}
        onClose={() => setStewardMode("collapsed")}
        moduleKey={moduleKey}
        scopePath={pathname}
        displayMode={stewardMode === "collapsed" ? "popout" : stewardMode}
        onDisplayModeChange={setStewardMode}
      />
      <header className="relative h-14 shrink-0 w-full flex items-center gap-4 px-4 bg-gradient-to-r from-[#0f172a] via-[#18253a] to-[#0f172a] border-b border-slate-700/60 shadow-[0_8px_28px_rgba(2,6,23,0.38)] backdrop-blur z-20 isolate">
        {/* Diagonal light segment for brand + module switcher area. */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-[430px] border-r border-white/35 pointer-events-none"
          style={{
            clipPath: "polygon(0 0, 88% 0, 100% 100%, 0 100%)",
            background: "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.92) 100%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          {/* ── TopBar Brand ── */}
          <Link href={homeHref} className="shrink-0 flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-slate-200/70 transition-colors" aria-label="Go to workspace home">
            <span className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center overflow-hidden">
              <Image src="/branding/oyama-mark-64.png" alt="OyamaCRM logo" width={24} height={24} className="w-6 h-6 object-contain" />
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900 hidden sm:inline">OyamaCRM</span>
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

        <div className="relative z-10 flex-1 flex items-center gap-4">
          {/* ── Search (centered) ── */}
          <div className="flex-1 flex justify-center px-1 sm:px-3">
            <GlobalSearch moduleKey={moduleKey} />
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
              className={`${chromeButtonBase} ${appsOpen ? "text-white bg-white/20 border-white/20" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
            >
              <AppsGridIcon className="w-4 h-4" />
            </button>
          ) : null}

          {/* AI Assistant */}
          <button
            title="Open Steward AI Assistant"
            onClick={() => setStewardMode((current) => (current === "collapsed" ? "popout" : "collapsed"))}
            className={`${chromeButtonBase} relative group ${stewardMode !== "collapsed" ? "text-white bg-white/20 border-white/20" : "text-slate-300 hover:text-white hover:bg-white/10"}`}
          >
            <OyamaGradientIcon name="client-support-chat" size={20} />
          <span className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            AI Assistant
          </span>
        </button>

        {/* Help */}
        <button
          title="Help & Documentation"
          className={`${chromeButtonBase} text-slate-300 hover:text-white hover:bg-white/10`}
        >
          <OyamaGradientIcon name="messaging-chat" size={20} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            title="Notifications"
            onClick={() => setNotificationsOpen((v) => !v)}
            className={`${chromeButtonBase} text-slate-300 hover:text-white hover:bg-white/10 relative`}
          >
            <OyamaGradientIcon name="task-checklist" size={20} />
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
  const [open, setOpen] = useState(false);

  const modules = [
    {
      key: "donor",
      label: "DonorCRM",
      helper: "Fundraising",
      href: "/",
      color: "bg-green-500",
      tileTone: "from-green-50 to-emerald-50",
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
      color: "bg-blue-500",
      tileTone: "from-blue-50 to-sky-50",
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
      color: "bg-amber-500",
      tileTone: "from-amber-50 to-orange-50",
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
      color: "bg-red-500",
      tileTone: "from-red-50 to-rose-50",
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
      color: "bg-indigo-500",
      tileTone: "from-indigo-50 to-violet-50",
      icon: (
        <OyamaGradientIcon name="growth-analytics" size={16} />
      ),
      active: moduleKey === "webmaster",
    },
    {
      key: "reportit",
      label: "OyamaREPORTIT CRM",
      helper: "Reporting Hub",
      href: "/reports",
      color: "bg-cyan-500",
      tileTone: "from-cyan-50 to-sky-50",
      icon: (
        <OyamaGradientIcon name="reporting-dashboard" size={16} />
      ),
      active: moduleKey === "reportit",
    },
  ].filter((module) => {
    if (module.key === "donor") return settings.donorEnabled;
    if (module.key === "compassion") return settings.compassionEnabled;
    return true;
  });

  if (modules.length === 0) return null;

  const current = modules.find((m) => m.active) ?? modules[0];
  const switcherTone = current.key === "compassion"
    ? "from-blue-50 to-sky-50 border-blue-200/80"
    : current.key === "events"
      ? "from-amber-50 to-orange-50 border-amber-200/80"
      : current.key === "watchdog"
        ? "from-red-50 to-rose-50 border-red-200/80"
        : current.key === "webmaster"
          ? "from-indigo-50 to-violet-50 border-indigo-200/80"
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
        className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border bg-gradient-to-br ${switcherTone} text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition-all`}
      >
        <span className={`w-8 h-8 rounded-xl ${current.color} text-white flex items-center justify-center shadow-sm ring-1 ring-white/70`}>
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
          <div className="absolute left-0 top-full mt-2 w-[380px] max-w-[calc(100vw-1rem)] bg-white/98 rounded-[22px] shadow-[0_18px_42px_rgba(15,23,42,0.18)] border border-slate-200/90 z-50 overflow-hidden backdrop-blur-xl">
            <div className={`px-4 pt-3 pb-2 border-b border-slate-100 bg-gradient-to-r ${switcherTone}`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.22em]">Switch CRM</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Choose the workspace you want to open next.</p>
            </div>
            <div className="p-2.5 grid grid-cols-2 gap-2.5">
              {modules.map((m) => (
                <button
                  key={m.key}
                  onClick={() => switchTo(m.href)}
                  className={`rounded-2xl border p-3 text-left transition-all ${m.active ? "border-slate-300 bg-slate-100 shadow-sm ring-1 ring-slate-200" : `border-slate-200 bg-gradient-to-br ${m.tileTone} hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5`}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`w-9 h-9 rounded-xl ${m.color} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                      {m.icon}
                    </span>
                    {m.active && (
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-slate-900 mt-2.5">{m.label}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{m.helper}</p>
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
