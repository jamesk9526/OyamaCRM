// TriviaOpsShell provides a focused Fluent-style shell for planning and running trivia.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  ClipboardCheck,
  FileOutput,
  Gamepad2,
  Home,
  LayoutDashboard,
  Menu,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Presentation,
  Radio,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { getActiveQuestion, getActiveRound } from "@/app/apps/trivia/lib/trivia-selectors";

interface TriviaOpsShellProps { children: React.ReactNode; }
interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; external?: boolean; }
interface NavGroup { label: string; items: NavItem[]; }

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

/** Trivia remains a standalone app while sharing the CRM's Microsoft-style chrome. */
export default function TriviaOpsShell({ children }: TriviaOpsShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useTriviaModuleState();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pathParts = pathname.split("/").filter(Boolean);
  const eventId = pathParts[2] === "events" && pathParts[3] ? pathParts[3] : null;
  const activeEvent = useMemo(() => eventId ? state.events.find((event) => event.id === eventId) ?? null : null, [state.events, eventId]);
  const activeLive = activeEvent ? state.liveByEventId[activeEvent.id] : null;
  const activeRound = activeEvent && activeLive ? getActiveRound(activeEvent, activeLive) : null;
  const activeQuestion = activeEvent && activeLive ? getActiveQuestion(activeEvent, activeLive) : null;
  const scoreHistory = activeEvent ? state.scoreHistoryByEventId[activeEvent.id] ?? [] : [];
  const lastScoreAction = scoreHistory.at(-1) ?? null;

  const navGroups: NavGroup[] = useMemo(() => {
    if (!activeEvent) {
      return [{ label: "Trivia workspace", items: [
        { label: "Home", href: "/apps/trivia", icon: Home },
        { label: "All events", href: "/apps/trivia/events", icon: Gamepad2 },
        { label: "Create event", href: "/apps/trivia/events/new", icon: Plus },
      ] }];
    }
    const base = `/apps/trivia/events/${activeEvent.id}`;
    return [
      { label: "Prepare", items: [
        { label: "Overview", href: `${base}/overview`, icon: LayoutDashboard },
        { label: "Game builder", href: `${base}/builder`, icon: Settings2 },
        { label: "Registration & page", href: `${base}/registration`, icon: Users },
        { label: "Print & backups", href: `${base}/printables`, icon: FileOutput },
      ] },
      { label: "Run the night", items: [
        { label: "Check-in", href: `${base}/check-in`, icon: ClipboardCheck },
        { label: "Host controls", href: `${base}/host`, icon: Radio },
        { label: "Scorekeeper", href: `${base}/scores`, icon: BarChart3 },
        { label: "Judge answers", href: `${base}/judge`, icon: ShieldCheck },
        { label: "Scoreboard", href: `${base}/scoreboard`, icon: Trophy },
      ] },
      { label: "Display & close", items: [
        { label: "Projector", href: `/apps/trivia/display/${activeEvent.id}`, icon: MonitorPlay, external: true },
        { label: "Leaderboard", href: `/apps/trivia/display/${activeEvent.id}/leaderboard`, icon: Presentation, external: true },
        { label: "Check-In Board", href: `/apps/trivia/display/${activeEvent.id}/check-in`, icon: ClipboardCheck, external: true },
        { label: "Answer key", href: `${base}/answer-key`, icon: BookOpenCheck },
        { label: "Recovery", href: `${base}/recovery`, icon: RotateCcw },
      ] },
    ];
  }, [activeEvent]);

  function isItemActive(href: string): boolean { return pathname === href || pathname.startsWith(`${href}/`); }
  function switchEvent(nextEventId: string) {
    if (!nextEventId) { router.push("/apps/trivia/events"); return; }
    const route = pathParts[4] && !["display", "remote"].includes(pathParts[2] ?? "") ? pathParts[4] : "overview";
    router.push(`/apps/trivia/events/${nextEventId}/${route}`);
  }

  const currentPage = navGroups.flatMap((group) => group.items).find((item) => isItemActive(item.href))?.label ?? (activeEvent ? "Event workspace" : "Trivia home");

  function renderNavigation(collapsed = false) { return (
    <>
      {activeEvent && activeLive && !collapsed ? (
        <section className="mx-2 mt-3 border border-[#d1d1d1] bg-white p-3" aria-label="Live event status">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{activeEvent.name}</p>
            <span className={`trivia-status-dot trivia-status-${activeEvent.status}`} title={statusLabel(activeEvent.status)} />
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div><dt className="text-[#616161]">Round</dt><dd className="truncate font-medium">{activeRound?.title ?? "Not selected"}</dd></div>
            <div><dt className="text-[#616161]">Question</dt><dd className="font-medium">{activeQuestion ? activeLive.activeQuestionIndex + 1 : "—"}</dd></div>
            <div><dt className="text-[#616161]">Projector</dt><dd className="font-medium capitalize">{activeLive.projectorConnectionStatus ?? (activeLive.displayOpenedAt ? "connected" : "offline")}</dd></div>
            <div><dt className="text-[#616161]">Last score</dt><dd className="truncate font-medium">{activeLive.lastScoreActionSummary ?? (lastScoreAction ? `${lastScoreAction.delta >= 0 ? "+" : ""}${lastScoreAction.delta}` : "None")}</dd></div>
          </dl>
        </section>
      ) : null}
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2" aria-label="Trivia workflow">
        {navGroups.map((group) => (
          <section key={group.label}>
            {!collapsed ? <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#616161]">{group.label}</p> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} title={collapsed ? item.label : undefined} onClick={() => setMobileNavOpen(false)} className={`trivia-nav-item ${isItemActive(item.href) ? "is-active" : ""}`}><Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}</Link>;
              })}
            </div>
          </section>
        ))}
      </nav>
    </>
  ); }

  return (
    <div className="trivia-admin-shell flex h-dvh min-h-0 overflow-hidden bg-[#f5f5f5] text-[#242424]">
      {mobileNavOpen ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setMobileNavOpen(false)} /> : null}
      <aside className={`${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-[#e1dfdd] bg-[#fafafa] shadow-xl transition-transform lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${railCollapsed ? "lg:w-14" : "lg:w-[232px]"}`}>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#e1dfdd] px-3">
          <Link href="/apps/trivia" className="flex min-w-0 flex-1 items-center gap-2" aria-label="Oyama Trivia home">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-[#5c2d91] text-sm font-bold text-white">T</span>
            {!railCollapsed ? <span className="min-w-0"><strong className="block truncate text-sm font-semibold">Oyama Trivia</strong><span className="block truncate text-[10px] text-[#616161]">Plan, host, score, display</span></span> : null}
          </Link>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-sm hover:bg-[#edebe9] lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X className="h-4 w-4" /></button>
        </div>
        {renderNavigation(railCollapsed)}
        <div className="shrink-0 border-t border-[#e1dfdd] p-2">
          <Link href="/apps" title={railCollapsed ? "Apps home" : undefined} className="trivia-nav-item"><Home className="h-[18px] w-[18px]" />{!railCollapsed ? <span>Apps home</span> : null}</Link>
          <div className="hidden lg:block"><button type="button" className="trivia-nav-item mt-0.5 w-full" onClick={() => setRailCollapsed((value) => !value)} aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}>{railCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}{!railCollapsed ? <span>Collapse navigation</span> : null}</button></div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#d1d1d1] bg-white px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-sm hover:bg-[#f3f2f1] lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open trivia navigation"><Menu className="h-5 w-5" /></button>
            <div className="hidden items-center gap-2 sm:flex"><span className="font-semibold">Oyama Trivia</span><ChevronDown className="h-4 w-4 text-[#616161]" /></div>
            <span className="hidden h-5 w-px bg-[#d1d1d1] sm:block" />
            <select aria-label="Switch trivia event" value={activeEvent?.id ?? ""} onChange={(event) => switchEvent(event.target.value)} className="h-9 min-w-0 max-w-[52vw] border border-[#8a8886] bg-white px-2 text-sm outline-none hover:border-[#323130] focus:border-[#5c2d91] focus:ring-1 focus:ring-[#5c2d91] sm:max-w-72 sm:min-w-56">
              <option value="">All trivia events</option>
              {state.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeEvent ? <Link href={`/apps/trivia/events/${activeEvent.id}/host`} className="trivia-primary-button"><Play className="h-4 w-4" /><span className="hidden sm:inline">Host controls</span><span className="sm:hidden">Host</span></Link> : <Link href="/apps/trivia/events/new" className="trivia-primary-button"><Plus className="h-4 w-4" />New event</Link>}
          </div>
        </header>

        <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-[#e1dfdd] bg-[#fafafa] px-3 sm:px-5">
          <div className="min-w-0"><div className="flex min-w-0 items-center gap-2 text-sm"><span className="truncate font-semibold">{activeEvent?.name ?? "Trivia"}</span><span className="text-[#8a8886]">/</span><span className="truncate text-[#616161]">{currentPage}</span></div>{activeEvent ? <p className="hidden truncate text-[11px] text-[#616161] sm:block">{activeEvent.venue || "Venue not set"} · Host {activeEvent.hostName || "Not set"}</p> : null}</div>
          {activeEvent ? <span className="inline-flex shrink-0 items-center gap-1.5 text-xs capitalize text-[#616161]"><span className={`trivia-status-dot trivia-status-${activeEvent.status}`} />{statusLabel(activeEvent.status)}</span> : null}
        </div>

        <main className="trivia-admin-content min-h-0 flex-1 overflow-auto bg-[#f5f5f5] p-3 sm:p-5 xl:p-6">{children}</main>
      </div>
    </div>
  );
}
