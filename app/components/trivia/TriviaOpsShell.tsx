// TriviaOpsShell provides a Fluent-inspired standalone shell for the Oyama Trivia add-on.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import { getActiveQuestion, getActiveRound } from "@/app/apps/trivia/lib/trivia-selectors";

interface TriviaOpsShellProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function statusBadgeTone(status: string): string {
  if (status === "live") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40";
  if (status === "paused") return "bg-amber-500/20 text-amber-200 border-amber-400/40";
  if (status === "completed") return "bg-cyan-500/20 text-cyan-200 border-cyan-400/40";
  if (status === "archived") return "bg-slate-700/70 text-slate-200 border-slate-500/60";
  if (status === "check_in_open") return "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40";
  return "bg-slate-700/70 text-slate-200 border-slate-500/60";
}

/** TriviaOpsShell keeps Trivia as a standalone app shell outside CRM controls. */
export default function TriviaOpsShell({ children }: TriviaOpsShellProps) {
  const pathname = usePathname();
  const { state } = useTriviaModuleState();
  const [railCollapsed, setRailCollapsed] = useState(false);

  const pathParts = pathname.split("/").filter(Boolean);
  const eventId = pathParts[2] === "events" && pathParts[3] ? pathParts[3] : null;

  const activeEvent = useMemo(
    () => (eventId ? state.events.find((event) => event.id === eventId) ?? null : null),
    [state.events, eventId],
  );

  const activeLive = activeEvent ? state.liveByEventId[activeEvent.id] : null;
  const activeRound = activeEvent && activeLive ? getActiveRound(activeEvent, activeLive) : null;
  const activeQuestion = activeEvent && activeLive ? getActiveQuestion(activeEvent, activeLive) : null;
  const scoreHistory = activeEvent ? state.scoreHistoryByEventId[activeEvent.id] ?? [] : [];
  const lastScoreAction = scoreHistory[scoreHistory.length - 1] ?? null;

  const navGroups: NavGroup[] = useMemo(() => {
    if (!activeEvent) {
      return [
        {
        label: "Start here",
          items: [
            { label: "Dashboard", href: "/apps/trivia" },
            { label: "Events", href: "/apps/trivia/events" },
            { label: "Create Event", href: "/apps/trivia/events/new" },
          ],
        },
      ];
    }

    const base = `/apps/trivia/events/${activeEvent.id}`;
    return [
      {
        label: "Plan the event",
        items: [
          { label: "Overview", href: `${base}/overview` },
          { label: "Builder", href: `${base}/builder` },
          { label: "Print & backups", href: `${base}/printables` },
        ],
      },
      {
        label: "Run the night",
        items: [
          { label: "Check-In", href: `${base}/check-in` },
          { label: "Host Panel", href: `${base}/host` },
          { label: "Scorekeeper", href: `${base}/scores` },
          { label: "Judge Panel", href: `${base}/judge` },
          { label: "Scoreboard", href: `${base}/scoreboard` },
        ],
      },
      {
        label: "Display & closeout",
        items: [
          { label: "Projector", href: `/apps/trivia/display/${activeEvent.id}`, external: true },
          { label: "Leaderboard", href: `/apps/trivia/display/${activeEvent.id}/leaderboard`, external: true },
          { label: "Check-In Board", href: `/apps/trivia/display/${activeEvent.id}/check-in`, external: true },
          { label: "Answer Key", href: `${base}/answer-key` },
          { label: "Recovery", href: `${base}/recovery` },
          { label: "Events List", href: "/apps/trivia/events" },
        ],
      },
    ];
  }, [activeEvent]);

  function isItemActive(href: string): boolean {
    if (pathname === href) return true;
    return pathname.startsWith(`${href}/`);
  }

  return (
    <div className="trivia-admin-shell min-h-screen h-screen overflow-hidden bg-[#f5f4f8] text-slate-900">
      <header className="relative z-10 flex h-16 items-center justify-between border-b border-[#d9d2e8] bg-white px-4 shadow-[0_1px_2px_rgba(31,20,55,0.08)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#5b3f9b] font-bold text-white">T</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Oyama Trivia</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#5b3f9b] truncate">Event Operations</p>
          </div>
          {activeEvent ? <div className="hidden border-l border-[#d9d2e8] pl-3 sm:block"><p className="text-xs text-slate-500">Current event</p><p className="max-w-48 truncate text-sm font-semibold text-slate-800">{activeEvent.name}</p></div> : null}
        </div>
        <div className="flex items-center gap-2">{activeEvent ? <Link href={`/apps/trivia/events/${activeEvent.id}/host`} className="hidden bg-[#5b3f9b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4a327f] sm:inline-flex">Host panel</Link> : null}<Link href="/apps" className="border border-[#a99ad0] bg-white px-3 py-1.5 text-xs font-semibold text-[#4a327f] hover:bg-[#f6f2ff]">Apps Home</Link></div>
      </header>

      <div className="relative z-10 flex h-[calc(100%-4rem)]">
        <aside className={`${railCollapsed ? "w-16" : "w-72"} shrink-0 overflow-auto border-r border-[#3f2c6e] bg-[#2b2142] transition-[width] duration-200`}>
          <div className="space-y-2 border-b border-[#4b3975] px-3 py-3">
            <button type="button" onClick={() => setRailCollapsed((value) => !value)} className="flex h-8 w-full items-center gap-2 text-left text-xs font-semibold text-[#e9e2ff] hover:text-white" aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}><span className="text-base">☰</span>{!railCollapsed ? <span>Trivia navigation</span> : null}</button>
            {!railCollapsed ? <p className="text-[10px] uppercase tracking-[0.18em] text-[#d9cffa]">Event command status</p> : null}
            {activeEvent && activeLive ? (
              <div className={`${railCollapsed ? "hidden" : "space-y-1.5"} border border-[#8067b7] bg-[#372957] p-3 shadow-[inset_3px_0_0_#a78bfa]`}>
                <p className="text-sm font-semibold text-white truncate">{activeEvent.name}</p>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusBadgeTone(activeEvent.status)}`}>
                  {activeEvent.status.replace("_", " ")}
                </span>
                <p className="text-xs text-[#f1edff]">Round: {activeRound?.title ?? "Not selected"}</p>
                <p className="text-xs text-[#f1edff]">Question: {activeQuestion ? `${activeLive.activeQuestionIndex + 1}` : "Not selected"}</p>
                <p className="text-xs text-[#f1edff]">Projector: {activeLive.projectorConnectionStatus ?? (activeLive.displayOpenedAt ? "connected" : "offline")}</p>
                <p className="truncate text-xs text-[#d9cffa]">Last score: {activeLive.lastScoreActionSummary ?? (lastScoreAction ? `${lastScoreAction.actionType} ${lastScoreAction.delta >= 0 ? `+${lastScoreAction.delta}` : lastScoreAction.delta}` : "No score changes yet")}</p>
              </div>
            ) : (
              <div className={`${railCollapsed ? "hidden" : ""} border border-[#4b3975] bg-[#372957] p-3`}>
                <p className="text-xs text-[#e9e2ff]">Select an event to open the full Night-of Operations navigation.</p>
              </div>
            )}
          </div>

          <nav className="space-y-4 p-3">
            {navGroups.map((group) => (
              <section key={group.label}>
                {!railCollapsed ? <p className="mb-1 px-1 text-[10px] uppercase tracking-[0.16em] text-[#cbbef0]">{group.label}</p> : null}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noopener noreferrer" : undefined}
                        title={railCollapsed ? item.label : undefined}
                        className={`block border-l-2 px-3 py-2 text-sm transition-colors ${railCollapsed ? "text-center text-[0px] before:text-base before:content-['•']" : ""} ${
                          active
                            ? "border-[#d6c5ff] bg-[#5b3f9b] text-white"
                            : "border-transparent text-[#e9e2ff] hover:border-[#a78bfa] hover:bg-[#372957] hover:text-white"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="mt-auto border-t border-[#4b3975] px-3 py-3">
            {!railCollapsed ? <p className="text-xs text-[#cbbef0]">Plan → run → display. Keep this rail for the next action only.</p> : null}
          </div>
        </aside>

        <main className="trivia-admin-content flex-1 overflow-auto bg-[#f5f4f8] p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
