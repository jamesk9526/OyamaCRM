// TriviaOpsShell provides a dark, animated standalone shell for the Oyama Trivia add-on.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
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
          label: "Trivia Home",
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
        label: "Event Setup",
        items: [
          { label: "Overview", href: `${base}/overview` },
          { label: "Builder", href: `${base}/builder` },
          { label: "Printables", href: `${base}/printables` },
        ],
      },
      {
        label: "Night Of",
        items: [
          { label: "Check-In", href: `${base}/check-in` },
          { label: "Host Panel", href: `${base}/host` },
          { label: "Scorekeeper", href: `${base}/scores` },
          { label: "Judge Panel", href: `${base}/judge` },
          { label: "Live Scoreboards", href: `${base}/scoreboard` },
        ],
      },
      {
        label: "Display",
        items: [
          { label: "Projector", href: `/apps/trivia/display/${activeEvent.id}`, external: true },
          { label: "Leaderboard Display", href: `/apps/trivia/display/${activeEvent.id}/leaderboard`, external: true },
          { label: "Check-In Display", href: `/apps/trivia/display/${activeEvent.id}/check-in`, external: true },
        ],
      },
      {
        label: "Operations",
        items: [
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
    <div className="relative min-h-screen h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl animate-pulse" />

      <header className="relative z-10 h-14 border-b border-white/10 bg-black/35 backdrop-blur px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-emerald-500 text-black font-bold flex items-center justify-center">T</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Oyama Trivia</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300 truncate">Standalone Add-on Module</p>
          </div>
        </div>
        <Link href="/apps" className="text-xs text-slate-300 hover:text-white border border-white/20 rounded-lg px-3 py-1.5">
          Apps Home
        </Link>
      </header>

      <div className="relative z-10 flex h-[calc(100%-3.5rem)]">
        <aside className="w-72 shrink-0 border-r border-white/10 bg-black/35 backdrop-blur overflow-auto">
          <div className="px-3 py-3 border-b border-white/10 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Event Command Status</p>
            {activeEvent && activeLive ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 space-y-1.5">
                <p className="text-sm font-semibold text-white truncate">{activeEvent.name}</p>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusBadgeTone(activeEvent.status)}`}>
                  {activeEvent.status.replace("_", " ")}
                </span>
                <p className="text-xs text-slate-200">Round: {activeRound?.title ?? "Not selected"}</p>
                <p className="text-xs text-slate-200">Question: {activeQuestion ? `${activeLive.activeQuestionIndex + 1}` : "Not selected"}</p>
                <p className="text-xs text-slate-200">Projector: {activeLive.projectorConnectionStatus ?? (activeLive.displayOpenedAt ? "connected" : "offline")}</p>
                <p className="text-xs text-slate-300 truncate">Last score: {activeLive.lastScoreActionSummary ?? (lastScoreAction ? `${lastScoreAction.actionType} ${lastScoreAction.delta >= 0 ? `+${lastScoreAction.delta}` : lastScoreAction.delta}` : "No score changes yet")}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                <p className="text-xs text-slate-300">Select an event to open the full Night-of Operations navigation.</p>
              </div>
            )}
          </div>

          <nav className="p-3 space-y-4">
            {navGroups.map((group) => (
              <section key={group.label}>
                <p className="px-1 text-[10px] uppercase tracking-[0.16em] text-slate-400 mb-1">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noopener noreferrer" : undefined}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors border ${
                          active
                            ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                            : "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
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

          <div className="px-3 py-3 border-t border-white/10 mt-auto">
            <p className="text-xs text-slate-400">Standalone trivia shell only. CRM search and CRM AI controls stay excluded.</p>
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
