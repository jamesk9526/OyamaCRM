// TopBar: full-width global navigation header with logo, module switcher, search, and user controls.
"use client";

import ModuleSwitcher from "./topbar/ModuleSwitcher";
import UserMenu from "./topbar/UserMenu";
import GlobalSearch from "./topbar/GlobalSearch";
import DonorQuickAddButton from "./topbar/DonorQuickAddButton";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import AppLauncherIcon from "@/app/components/layout/AppLauncherIcon";
import DonorAccountMenu from "@/app/components/layout/DonorAccountMenu";
import StewardAiRuntimePill from "@/app/components/layout/StewardAiRuntimePill";
import ChromeIcon from "./topbar/ChromeIcon";
import ContextualTutorialModal from "@/app/components/help/ContextualTutorialModal";
import StewardWorkspaceBridge from "@/app/components/ai/StewardWorkspaceBridge";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { SupportTicketModal } from "@/app/components/support/SupportTicketModal";
import { apiFetch } from "@/app/lib/auth-client";
import NotificationPanel from "@/app/components/notifications/NotificationPanel";
import { changeNotification, markNotificationsRead, safeNotificationHref, subscribeToNotifications, type NotificationItem, type NotificationAction } from "@/app/components/notifications/notification-client";
import { OYAMA_PRODUCT_LOGO, OYAMA_PRODUCT_ICON } from "@/app/lib/product-branding";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  fetchWorkspaceSettings,
  getDonorAccentTheme,
  type WorkspaceSettings,
} from "@/app/lib/workspace-settings";
import { resolveTopBarModuleKey } from "@/app/lib/navigation-boundaries";
import {
  getFiscalYearEndMonth,
  getReportingFiscalYearForDate,
  getStoredReportingYearMode,
  setStoredReportingYearMode,
  type ReportingYearMode,
} from "@/app/lib/fiscal-year";
import { buildHelpHref, mapModuleKeyToHelpScope } from "@/app/help-content";
import type { DashboardChromeTint } from "@/app/lib/dashboard-image-tint";
import {
  openFeedbackFromUserMenu,
  type TopBarPanelSetters,
} from "@/app/components/layout/topbar/panel-callbacks";
import {
  resolveTopBarHomeHref,
  resolveTopBarModuleAccentClass,
  resolveTopBarModuleChromePalette,
} from "@/app/components/layout/topbar/theme-tokens";

interface FiscalSettings {
  fiscalYearStart: number;
  fiscalYearEnd: number;
}

type TopBarNotification = NotificationItem;

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
function HelpCircleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <ChromeIcon name="help" className={className} />;
}

/** Generic bell icon used for notifications control in topbar controls. */
function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <ChromeIcon name="notifications" className={className} />;
}

/** Small research icon used for the global individual-donor research shortcut. */
function DonorResearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <ChromeIcon name="research" className={className} />;
}

/** Neutral AI icon for the donor topbar Steward workspace entry point. */
function AiOrbIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <ChromeIcon name="assistant" className={className} />;
}

interface TopBarProps {
  scrolled?: boolean;
  donorChromeTint?: DashboardChromeTint;
  donorSidebarOffset?: boolean;
  donorSidebarCollapsed?: boolean;
}

/** Full-width top navigation bar — spans the entire viewport width. */
export default function TopBar({ scrolled = false, donorChromeTint, donorSidebarOffset = false, donorSidebarCollapsed = false }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const moduleKey = resolveTopBarModuleKey(pathname);
  const showTopBarAppLauncher = true;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<TopBarNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationBusy, setNotificationBusy] = useState<string | null>(null);
  const notificationRequest = useRef(0);
  const unreadRequest = useRef(0);
  const [analyzingSignals, setAnalyzingSignals] = useState(false);
  const [signalsAnalyzeError, setSignalsAnalyzeError] = useState<string | null>(null);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [fiscalSettings, setFiscalSettings] = useState<FiscalSettings | null>(null);
  const [reportingYearMode, setReportingYearMode] = useState<ReportingYearMode>("calendar");
  const [topBarReactiveGlow, setTopBarReactiveGlow] = useState(false);
  const [mobileQuickOpen, setMobileQuickOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [compactActionsOpen, setCompactActionsOpen] = useState(false);
  const [reportingModeJustChanged, setReportingModeJustChanged] = useState(false);
  const reactiveGlowFrameRef = useRef<number | null>(null);
  const reactiveGlowTimeoutRef = useRef<number | null>(null);

  const reportingModeChangedTimeoutRef = useRef<number | null>(null);
  const desktopNotificationsRef = useRef<HTMLDivElement | null>(null);

  const isStewardSignalsWorkspace = moduleKey === "donor" && pathname.startsWith("/steward-signals");
  const donorAccentTheme = getDonorAccentTheme(workspaceSettings.donorAccentTone);
  const isDonorEnterpriseChrome = moduleKey === "donor";
  const chromeButtonBase = isDonorEnterpriseChrome
    ? "oyama-reference-header-control flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-transparent text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 max-[380px]:h-8 max-[380px]:w-8"
    : "flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-slate-200/90 bg-white/96 text-slate-600 shadow-[0_4px_10px_rgba(15,23,42,0.045)] transition-all duration-200 hover:-translate-y-px hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:translate-y-0 max-[380px]:h-8 max-[380px]:w-8";
  const mobileSheetBase = "fixed left-2 right-2 bottom-2 rounded-2xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.18)] z-50 overflow-hidden xl:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]";
  const shellMotionClass = "duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";
  const moduleAccentClass = resolveTopBarModuleAccentClass(moduleKey, donorAccentTheme.topBarAccentLine);
  const donorDesktopInsetClass = donorSidebarOffset && isDonorEnterpriseChrome
    ? donorSidebarCollapsed
      ? "xl:pl-[96px]"
      : "xl:pl-[284px]"
    : "";
  const darkIconButtonBase = isDonorEnterpriseChrome
    ? "oyama-reference-header-control flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-transparent text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    : "flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-transparent bg-transparent text-slate-500 transition-all duration-200 hover:-translate-y-px hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 active:translate-y-0 active:scale-95";
  const donorResearchMobileButtonBase = chromeButtonBase.replace("rounded-xl", "rounded-full");
  const donorResearchDesktopButtonBase = darkIconButtonBase.replace("rounded-lg", "rounded-full");
  const donorResearchActiveClass = pathname === "/donor-profile" || pathname === "/donor-research"
    ? (isDonorEnterpriseChrome ? "bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/50" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")
    : "";
  const showModuleSwitcher = workspaceSettings.showModuleSwitcher || isDonorEnterpriseChrome;
  const moduleChromePalette = resolveTopBarModuleChromePalette(moduleKey, donorChromeTint);
  const homeHref = resolveTopBarHomeHref(moduleKey);
  const breadcrumbLabel = pathname === "/" ? "Overview" : (pathname.split("/").filter(Boolean)[0] ?? "Workspace").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const helpHref = buildHelpHref({
    scope: mapModuleKeyToHelpScope(moduleKey),
    scopePath: pathname,
  });
  const currentFiscalYear = fiscalSettings ? getReportingFiscalYearForDate(new Date(), fiscalSettings.fiscalYearStart) : null;
  const donorReportingModeLabel = reportingYearMode === "fiscal" ? (currentFiscalYear ? `FY ${currentFiscalYear}` : "Fiscal year") : "Calendar Year";
  const donorReportingModeDescription = reportingYearMode === "fiscal"
    ? (fiscalSettings ? `Fiscal year mode is on. FY${currentFiscalYear} runs month ${fiscalSettings.fiscalYearStart}-${fiscalSettings.fiscalYearEnd}.` : "Fiscal year mode is on. Organization fiscal settings could not be loaded; reports use the server settings.")
    : "Calendar year mode is on. Click to use the fiscal year offset from Organization Settings.";
  const canRunAiConnectionTest = user?.role === "admin" || user?.role === "super_admin";
  const topBarPanelSetters: TopBarPanelSetters = {
    setFeedbackOpen,
    setNotificationsOpen,
    setMobileQuickOpen,
    setMobileSearchOpen,
    setCompactActionsOpen,
  };

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
      setFiscalSettings(organizationSettings ? {
        fiscalYearStart,
        fiscalYearEnd: organizationSettings.fiscalYearEnd ?? getFiscalYearEndMonth(fiscalYearStart),
      } : null);
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
    const openSupportTicket = () => setFeedbackOpen(true);
    window.addEventListener("oyamacrm:open-support-ticket", openSupportTicket);
    return () => window.removeEventListener("oyamacrm:open-support-ticket", openSupportTicket);
  }, []);

  useEffect(() => {
    function openSearchFromKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (isEditableEventTarget(event.target)) return;
        event.preventDefault();
        setFeedbackOpen(false);
        setNotificationsOpen(false);
        setMobileQuickOpen(false);
        setCompactActionsOpen(false);
        if (window.matchMedia("(min-width: 1280px)").matches) {
          setMobileSearchOpen(false);
          window.dispatchEvent(new CustomEvent("crm:focus-topbar-search"));
          return;
        }
        setMobileSearchOpen(true);
      }
    }

    window.addEventListener("keydown", openSearchFromKeyboard);
    return () => window.removeEventListener("keydown", openSearchFromKeyboard);
  }, []);

  useEffect(() => {
    const focusRequested = () => {
      if (window.matchMedia("(max-width: 1279px)").matches) {
        setNotificationsOpen(false);
        setMobileQuickOpen(false);
        setCompactActionsOpen(false);
        setMobileSearchOpen(true);
      }
    };
    window.addEventListener("crm:focus-topbar-search", focusRequested);
    return () => window.removeEventListener("crm:focus-topbar-search", focusRequested);
  }, []);

  useEffect(() => {
    const hasOpenPanel = feedbackOpen || notificationsOpen || mobileQuickOpen || mobileSearchOpen || compactActionsOpen;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!hasOpenPanel) {
        return;
      }
      setFeedbackOpen(false);
      setNotificationsOpen(false);
      setMobileQuickOpen(false);
      setMobileSearchOpen(false);
      setCompactActionsOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [compactActionsOpen, feedbackOpen, mobileQuickOpen, mobileSearchOpen, notificationsOpen]);

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
    const request = ++notificationRequest.current;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const notificationModule = moduleKey === "oshareview" ? "donor" : moduleKey;
      const data = await apiFetch<{ items: TopBarNotification[]; unreadCount: number }>(
        `/api/notifications?module=${notificationModule}`
      );
      if (request !== notificationRequest.current) return;
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch (err) {
      if (request !== notificationRequest.current) return;
      setNotificationsError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      if (request === notificationRequest.current) setNotificationsLoading(false);
    }
  }, [moduleKey, setNotificationsLoading, setNotificationsError, setNotifications, setUnreadCount]);

  const loadUnreadCount = useCallback(async () => {
    const request = ++unreadRequest.current;
    try {
      const notificationModule = moduleKey === "oshareview" ? "donor" : moduleKey;
      const data = await apiFetch<{ unreadCount: number }>(`/api/notifications/unread-count?module=${notificationModule}`);
      if (request !== unreadRequest.current) return;
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // Keep existing badge state if lightweight polling fails.
    }
  }, [moduleKey, setUnreadCount]);

  const runNotificationAction = async (
    id: string,
    action: NotificationAction,
    options?: { until?: string }
  ) => {
    setNotificationBusy(id); setNotificationsError(null);
    try { await changeNotification(id, action, options?.until); await loadNotifications(); }
    catch (reason) { setNotificationsError(reason instanceof Error ? reason.message : "Notification could not be updated."); }
    finally { setNotificationBusy(null); }
  };

  const openNotification = async (item: TopBarNotification) => {
    setNotificationBusy(item.id); setNotificationsError(null);
    try {
      if (item.status === "unread") await changeNotification(item.id, "read");
      setNotificationsOpen(false);
      router.push(safeNotificationHref(item.href));
    } catch (reason) { setNotificationsError(reason instanceof Error ? reason.message : "Notification could not be opened. Try again."); }
    finally { setNotificationBusy(null); }
  };

  const readAllNotifications = async () => {
    setNotificationBusy("all"); setNotificationsError(null);
    try { await markNotificationsRead(moduleKey === "oshareview" ? "donor" : moduleKey); await loadNotifications(); }
    catch (reason) { setNotificationsError(reason instanceof Error ? reason.message : "Notifications could not be marked read."); }
    finally { setNotificationBusy(null); }
  };

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
    if (!window.matchMedia("(min-width: 1280px)").matches) return;

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
    const refresh = () => { void loadUnreadCount(); if (notificationsOpen) void loadNotifications(); };
    refresh();
    return subscribeToNotifications(refresh);
  }, [loadUnreadCount, loadNotifications, notificationsOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotificationsOpen(false);
      setMobileQuickOpen(false);
      setMobileSearchOpen(false);
      setCompactActionsOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    if (feedbackOpen || notificationsOpen) {
      setCompactActionsOpen(false);
    }
  }, [feedbackOpen, notificationsOpen]);

  // Subtle color response when navigation context changes.
  useEffect(() => {
    triggerTopBarReactiveGlow();
  }, [pathname, triggerTopBarReactiveGlow]);

  // Subtle color response when topbar interactive panels are used.
  useEffect(() => {
    if (notificationsOpen || feedbackOpen) {
      triggerTopBarReactiveGlow();
    }
  }, [notificationsOpen, feedbackOpen, triggerTopBarReactiveGlow]);

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
    setFeedbackOpen(false);
    setCompactActionsOpen(false);
    router.push("/settings/ai");
  }, [router, setNotificationsOpen, setMobileQuickOpen, setFeedbackOpen, setCompactActionsOpen]);

  return (
    <>
      <SupportTicketModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        moduleKey={moduleKey}
        pathname={pathname}
      />
      {/* Direct staff messaging is retired for now; a future module will be separately reviewed. */}
      <StewardWorkspaceBridge
        moduleKey={moduleKey}
      />
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
      <header data-topbar-root="true" data-donor-topbar={isDonorEnterpriseChrome ? "true" : "false"} className={`oyama-reference-topbar fixed left-0 right-0 top-0 isolate z-50 h-14 w-full shrink-0 transition-[box-shadow,background-color,border-color] ${shellMotionClass} ${isDonorEnterpriseChrome
        ? "border-b border-slate-200 bg-white xl:h-14"
        : (scrolled
          ? "border-b border-slate-200/85 bg-white/98 backdrop-blur-xl shadow-[0_8px_20px_rgba(15,23,42,0.055)] xl:h-[72px]"
          : "border-b border-slate-200/85 bg-white/98 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,23,42,0.035)] xl:h-[72px]")}`}
        style={{
          paddingTop: "max(0rem, env(safe-area-inset-top))",

        }}>
        {!isDonorEnterpriseChrome ? (
          <div aria-hidden="true" className={`oyama-reference-brand-decoration pointer-events-none absolute left-0 top-0 z-10 hidden h-full transition-[width] saturate-[1.18] ${shellMotionClass} xl:block ${scrolled ? "w-[372px]" : "w-[472px]"}`}>
          <svg className="h-full w-full" viewBox="0 0 590 156" preserveAspectRatio="none">
            <defs>
              <radialGradient id="oyama-brand-glow" cx="16%" cy="20%" r="48%">
                <stop offset="0%" stopColor={moduleChromePalette.glowStart} stopOpacity="0.44" />
                <stop offset="58%" stopColor={moduleChromePalette.glowMid} stopOpacity="0.14" />
                <stop offset="100%" stopColor={moduleChromePalette.glowEnd} stopOpacity="0" />
              </radialGradient>
              <linearGradient id="oyama-brand-scoop" x1="0%" y1="0%" x2="100%" y2="92%">
                <stop offset="0%" stopColor={moduleChromePalette.scoopStart} />
                <stop offset="58%" stopColor={moduleChromePalette.scoopMid} />
                <stop offset="100%" stopColor={moduleChromePalette.scoopEnd} />
              </linearGradient>
            </defs>
            <path
              d="M0 0H590C552 7 521 25 493 55C447 105 399 135 314 144C220 154 130 129 43 132C19 133 7 140 0 150Z"
              fill="url(#oyama-brand-scoop)"
              stroke={moduleChromePalette.scoopStroke}
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
        ) : null}
        <div aria-hidden="true" className={`pointer-events-none absolute bottom-0 right-0 z-0 hidden h-px transition-[left,opacity] ${shellMotionClass} xl:block ${isDonorEnterpriseChrome ? "bg-white/10" : "bg-slate-200/55"} ${scrolled ? (isDonorEnterpriseChrome ? "left-0 opacity-100" : "left-[280px] opacity-100") : (isDonorEnterpriseChrome ? "left-0 opacity-85" : "left-[480px] opacity-70")}`} />
        <div
          aria-hidden="true"
          className={`absolute bottom-0 ${isDonorEnterpriseChrome ? "left-0" : "left-[280px]"} right-0 h-px pointer-events-none hidden transition-opacity ${shellMotionClass} xl:block ${moduleAccentClass} ${topBarReactiveGlow ? "opacity-70" : "opacity-0"}`}
        />

        <div className={`oyama-reference-topbar-brand relative z-20 hidden h-full ${isDonorEnterpriseChrome ? "w-64" : "w-[520px]"} xl:block`}>
          {isDonorEnterpriseChrome ? (
            <Link href={homeHref} className="absolute left-5 top-1/2 flex -translate-y-1/2 items-baseline gap-1.5 rounded-[2px] px-1 py-1 text-white transition-colors hover:bg-white/[0.07]" aria-label="Go to OyamaCRM v2.0 home">
              <span className="text-[15px] font-bold tracking-[-0.035em]">OyamaCRM</span>
              <span className="rounded-[2px] bg-white/[0.1] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#cfe4fa] ring-1 ring-white/10">v2.0</span>
            </Link>
          ) : (
          <Link href={homeHref} className={`absolute left-8 flex shrink-0 items-center gap-2.5 rounded-2xl px-2 py-1 transition-[top,opacity,background-color,border-color] ${shellMotionClass} hover:opacity-90 ${scrolled ? "top-2.5" : "top-4"}`} aria-label="Go to workspace home">
            <Image
              src={OYAMA_PRODUCT_LOGO}
              alt="OyamaCRM v2.0"
              width={260}
              height={74}
              className={`object-contain object-left transition-[height,width,opacity] ${shellMotionClass} ${scrolled ? "h-9 w-[128px]" : "h-11 w-[166px]"}`}
              priority
            />
          </Link>
          )}
        </div>

        <div className="oyama-reference-mobile-toolbar relative z-20 flex h-full w-full min-w-0 shrink-0 items-center justify-between gap-2 px-2 max-[380px]:gap-1.5 sm:px-3 xl:hidden">
          <div className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2">
            <div
              className={`oyama-reference-mobile-brand flex h-11 min-w-0 shrink items-center gap-1 rounded-2xl border px-1.5 max-[380px]:h-10 max-[380px]:rounded-xl max-[380px]:px-1 ${isDonorEnterpriseChrome ? "border-transparent bg-transparent px-0 shadow-none" : ""}`}
              style={{
                background: isDonorEnterpriseChrome ? "transparent" : moduleChromePalette.mobileGradient,
                borderColor: isDonorEnterpriseChrome ? "transparent" : moduleChromePalette.mobileBorderColor,
                boxShadow: isDonorEnterpriseChrome ? "none" : moduleChromePalette.mobileShadow,
              }}
            >
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => window.dispatchEvent(new CustomEvent(isDonorEnterpriseChrome ? "crm:toggle-donor-nav" : "crm:open-mobile-nav"))}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors active:bg-white/15 max-[380px]:h-8 max-[380px]:w-8 lg:hidden ${isDonorEnterpriseChrome ? "text-slate-100 hover:bg-white/[0.1] hover:text-white" : "text-white/88 hover:bg-white/10 hover:text-white"}`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* ── TopBar Brand ── */}
              <Link href={homeHref} className={`flex min-w-0 shrink items-center rounded-xl px-1.5 py-1 transition-opacity hover:opacity-90 max-[380px]:px-1 ${isDonorEnterpriseChrome ? "text-white" : ""}`} aria-label="Go to OyamaCRM v2.0 home">
                {isDonorEnterpriseChrome ? (
                  <><Image src={OYAMA_PRODUCT_ICON} alt="" width={26} height={26} className="mr-1 hidden min-[360px]:block"/><span className="inline-flex items-baseline gap-1 whitespace-nowrap text-sm font-bold tracking-[-0.035em] text-white max-[380px]:text-xs">OyamaCRM <span className="text-[9px] font-bold tracking-wide text-emerald-200">v2.0</span></span></>
                ) : (
                  <Image
                    src={OYAMA_PRODUCT_LOGO}
                    alt="OyamaCRM v2.0"
                    width={144}
                    height={48}
                    className="block h-8 w-[116px] object-contain object-left transition-[width,height] duration-200 max-[430px]:w-[96px] max-[380px]:h-7 max-[380px]:w-[76px]"
                    priority
                  />
                )}
              </Link>
            </div>

            {/* ── Module switcher (left anchor) ── */}
            {showModuleSwitcher && (
              <div className={`${isDonorEnterpriseChrome ? "hidden min-[640px]:flex" : "hidden min-[420px]:flex"} min-w-0 items-center gap-1.5 sm:gap-2`}>
                <ModuleSwitcher moduleKey={moduleKey} settings={workspaceSettings} scrolled />
              </div>
            )}
          </div>

          {/* Mobile top-right priority controls */}
          <div className="oyama-topbar-mobile-actions flex shrink-0 items-center gap-1.5 max-[380px]:gap-1 xl:hidden">

            <Link
              href="/donor-profile"
              title="Open OYAMADonorPROFILE"
              aria-label="Open OYAMADonorPROFILE"
              aria-current={pathname === "/donor-profile" || pathname === "/donor-research" ? "page" : undefined}
              className={`${donorResearchMobileButtonBase} ${donorResearchActiveClass} ${isDonorEnterpriseChrome ? "hidden sm:flex" : ""}`}
            >
              <DonorResearchIcon className="h-[18px] w-[18px]" />
            </Link>
            {/* Search icon — opens full-screen overlay */}
            <button
              type="button"
              title="Search"
              aria-label="Open command search"
              onClick={() => {
                setNotificationsOpen(false);
                setMobileQuickOpen(false);
                setCompactActionsOpen(false);
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
                      setMobileSearchOpen(false);
                    }
                    return nextOpen;
                  })}
                className={`${chromeButtonBase} relative`}
              >
                <BellIcon className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${
                    moduleKey === "events"
                        ? "bg-violet-500"
                        : moduleKey === "watchdog"
                          ? "bg-red-600"
                          : moduleKey === "webmaster"
                            ? "bg-indigo-600"
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
                  <div className={`${mobileSheetBase} max-h-[72vh] flex flex-col`}><NotificationPanel items={notifications} loading={notificationsLoading} error={notificationsError} busy={notificationBusy} unreadCount={unreadCount} onRefresh={() => void loadNotifications()} onReadAll={() => void readAllNotifications()} onOpen={(item) => void openNotification(item)} onAction={(item, action) => void runNotificationAction(item.id, action, action === "snooze" ? { until: new Date(Date.now() + 3600000).toISOString() } : undefined)} onNavigate={() => setNotificationsOpen(false)} /></div>
                </>
              )}
            </div>

            {isDonorEnterpriseChrome && <DonorAccountMenu helpHref={helpHref} onSupport={() => openFeedbackFromUserMenu(topBarPanelSetters)} />}

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
              }}
              className={`${chromeButtonBase} relative`}
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`oyama-reference-desktop-toolbar absolute inset-y-0 left-0 right-0 z-10 hidden min-w-0 items-center transition-[padding] ${shellMotionClass} xl:flex ${scrolled ? (isDonorEnterpriseChrome ? `pl-[230px] pr-3 2xl:pr-4 ${donorDesktopInsetClass}` : "pl-[304px] pr-5 2xl:pl-[332px] 2xl:pr-8") : (isDonorEnterpriseChrome ? `pl-[230px] pr-3 2xl:pr-4 ${donorDesktopInsetClass}` : "pl-[362px] pr-5 2xl:pl-[400px] 2xl:pr-8")}`}>
          <div className={`mx-auto flex min-w-0 w-full items-center ${isDonorEnterpriseChrome ? "max-w-[1480px] gap-2" : "gap-3"}`}>
          <div className={`flex min-w-0 flex-1 items-center ${isDonorEnterpriseChrome ? "gap-2 justify-start" : "gap-3 justify-end"}`}>
            {showModuleSwitcher && (
              <nav aria-label="Workspace breadcrumb" className="oyama-reference-breadcrumb flex shrink-0 items-center gap-3">
                <ModuleSwitcher moduleKey={moduleKey} settings={workspaceSettings} scrolled={scrolled} />
                <span className="oyama-reference-current-page" aria-current="page"><span aria-hidden="true">/</span> {breadcrumbLabel}</span>
              </nav>
            )}



            {showTopBarAppLauncher ? (
              <button
                type="button"
                onClick={() => router.push("/apps")}
                title="Open app launcher"
                aria-label="Open app launcher"
                className={isDonorEnterpriseChrome
                  ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-[0_1px_4px_rgba(15,23,42,0.05)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"}
              >
                <AppLauncherIcon className="h-4 w-4" />
              </button>
            ) : null}

            <div className={`oyama-reference-search-tools flex min-w-0 ${isDonorEnterpriseChrome ? "flex-1" : "w-full max-w-[1000px]"} items-center rounded-xl border transition-[height,padding,box-shadow,border-color,background-color] ${shellMotionClass} ${isDonorEnterpriseChrome ? "h-9 border-slate-200 bg-slate-50 px-1.5" : (scrolled ? "h-10 px-1.5 border-slate-200/95 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.07)]" : "h-11 px-2 border-slate-200/95 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.07)]")}`}>
              <div className={`min-w-0 flex-1 ${isDonorEnterpriseChrome ? "px-1" : "px-1.5"}`}>
                <GlobalSearch moduleKey={moduleKey} pathname={pathname} darkChrome={false} onNavigate={() => setNotificationsOpen(false)} />
              </div>

            </div>
            <div className="oyama-topbar-actions flex shrink-0 items-center gap-1">
              {isDonorEnterpriseChrome && (
                <div className="mx-1 shrink-0">
                  <DonorQuickAddButton />
                </div>
              )}

              {isStewardSignalsWorkspace && (
                <button
                  title={signalsAnalyzeError ?? "Rebuild Steward Signals analysis index"}
                  onClick={() => void runStewardSignalsAnalysis()}
                  disabled={analyzingSignals}
                  className="ml-1 h-8 rounded-lg border border-green-200 bg-green-50 px-2.5 text-[11px] font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
                >
                  {analyzingSignals ? "Analyzing..." : "Analyze"}
                </button>
              )}

              <div className={`mx-1 h-5 w-px shrink-0 ${isDonorEnterpriseChrome ? "bg-white/15" : "bg-slate-200"}`} />

              <Link
                href="/donor-profile"
                title="Open OYAMADonorPROFILE"
                aria-label="Open OYAMADonorPROFILE"
                aria-current={pathname === "/donor-profile" || pathname === "/donor-research" ? "page" : undefined}
                className={`${donorResearchDesktopButtonBase} ${donorResearchActiveClass}`}
              >
                <DonorResearchIcon />
              </Link>

              <div ref={desktopNotificationsRef} className="relative shrink-0">
                <button
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                  aria-expanded={notificationsOpen}
                  title="Notifications"
                  onClick={() =>
                    setNotificationsOpen((current) => {
                      const nextOpen = !current;
                      if (nextOpen) {
                        setCompactActionsOpen(false);
                        setMobileQuickOpen(false);
                        setMobileSearchOpen(false);
                      }
                      return nextOpen;
                    })}
                  className={`${darkIconButtonBase} relative`}
                >
                  <BellIcon className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${
                      moduleKey === "events"
                          ? "bg-violet-500"
                          : moduleKey === "watchdog"
                            ? "bg-red-600"
                            : moduleKey === "webmaster"
                              ? "bg-indigo-600"
                              : moduleKey === "oshareview"
                                  ? "bg-cyan-600"
                                  : "bg-indigo-600"
                    }`}>
                      {Math.min(unreadCount, 99)}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <>
                    <div className="absolute right-0 top-full z-50 mt-2 w-[390px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><NotificationPanel items={notifications} loading={notificationsLoading} error={notificationsError} busy={notificationBusy} unreadCount={unreadCount} onRefresh={() => void loadNotifications()} onReadAll={() => void readAllNotifications()} onOpen={(item) => void openNotification(item)} onAction={(item, action) => void runNotificationAction(item.id, action, action === "snooze" ? { until: new Date(Date.now() + 3600000).toISOString() } : undefined)} onNavigate={() => setNotificationsOpen(false)} /></div>
                  </>
                )}
              </div>

              {isDonorEnterpriseChrome ? (
                <>
                  <div className="mx-1 h-5 w-px shrink-0 bg-white/15" />

                  <Link
                    href="/steward-ai-workspace"
                    title="Open Steward Copilot"
                    aria-label="Open Steward Copilot"
                    className={darkIconButtonBase}
                  >
                    <AiOrbIcon className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <div className="mx-1.5 h-6 w-px shrink-0 bg-slate-200/80" />

                  <div className="shrink-0">
                    <StewardAiRuntimePill
                      canRunConnectionTest={canRunAiConnectionTest}
                      onOpenSettings={openAiSettings}
                      compact
                    />
                  </div>

                  <Link
                    href="/steward-ai-workspace"
                    title="Open Steward Copilot"
                    aria-label="Open Steward Copilot"
                    className="ml-0.5 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <StewardAvatarIcon size={12} alt="Steward" className="ring-slate-300/80" />
                    <span className="hidden min-[1500px]:inline">Copilot</span>
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                title="Page tutorial"
                aria-label="Open page tutorial"
                className={`${darkIconButtonBase} ml-0.5`}
              >
                <HelpCircleIcon className="h-4 w-4" />
              </button>
            </div>

            <div className={`flex shrink-0 items-center gap-2 ${isDonorEnterpriseChrome ? "ml-auto" : ""}`}>
              {isDonorEnterpriseChrome ? <>
                <button type="button" onClick={handleReportingWindowToggle} title={donorReportingModeDescription}
                  aria-label={`Reporting period: ${donorReportingModeLabel}. Switch calendar or fiscal year`}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${reportingModeJustChanged ? "ring-2 ring-emerald-300/70" : ""}`}>
                  <span className="text-slate-400">Period</span>{donorReportingModeLabel}
                </button>
                <DonorAccountMenu helpHref={helpHref} onSupport={() => openFeedbackFromUserMenu(topBarPanelSetters)} />
              </> : <UserMenu
                moduleKey={moduleKey}
                showApps={showTopBarAppLauncher}
                onOpenApps={() => router.push("/apps")}
                onOpenFeedback={() => openFeedbackFromUserMenu(topBarPanelSetters)}
                helpHref={helpHref}
              />}
            </div>
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
                {isDonorEnterpriseChrome && showModuleSwitcher ? (
                  <div className="pb-2 sm:hidden"><ModuleSwitcher moduleKey={moduleKey} settings={workspaceSettings} scrolled /></div>
                ) : null}
                <Link href="/donor-profile" onClick={() => setMobileQuickOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><DonorResearchIcon />Donor research</Link>
                <DonorQuickAddButton />
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
                      router.push("/apps");
                    }}
                    className="flex w-full min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700"
                  >
                    <AppLauncherIcon className="h-4 w-4 shrink-0" />
                    Apps
                  </button>
                ) : null}

                <button
                  onClick={() => {
                    setMobileQuickOpen(false);
                    setFeedbackOpen(true);
                  }}
                  className="w-full min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium text-left"
                >
                  Get support
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
        <ContextualTutorialModal
          open={tutorialOpen}
          onClose={() => setTutorialOpen(false)}
          pathname={pathname}
          scope={mapModuleKeyToHelpScope(moduleKey)}
          helpHref={helpHref}
        />
    </header>
    </>
  );
}
