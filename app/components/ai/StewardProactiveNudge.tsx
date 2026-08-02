/** Contextual, dismissible Steward suggestions for high-value CRM work. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { openStewardWithPrompt, type StewardOpenPromptDetail } from "@/app/lib/steward-context";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";

export interface StewardNudgeDefinition {
  key: string;
  eyebrow: string;
  title: string;
  prompt: string;
  mode: StewardOpenPromptDetail["mode"];
}

/** Returns a useful suggestion only for routes where live CRM context materially helps. */
export function getStewardNudge(pathname: string): StewardNudgeDefinition | null {
  if (/^\/constituents\/[^/]+(?:\/|$)/.test(pathname)) return {
    key: "constituent-profile",
    eyebrow: "Donor briefing",
    title: "Want the relationship summary?",
    prompt: "Using this donor record and live CRM data, give me a concise relationship briefing: giving pattern, communication constraints, open work, risks, and the best next step.",
    mode: "analyze",
  };
  if (/^\/campaigns\/[^/]+(?:\/|$)/.test(pathname)) return {
    key: "campaign-detail",
    eyebrow: "Campaign review",
    title: "See what needs attention",
    prompt: "Analyze the campaign in my current CRM view using its actual results and related donor activity. Highlight progress, risks, audience opportunities, and three practical next actions.",
    mode: "analyze",
  };
  if (/^\/donations\/[^/]+(?:\/|$)/.test(pathname)) return {
    key: "donation-detail",
    eyebrow: "Gift follow-up",
    title: "Plan the right response",
    prompt: "Review this gift and its donor context. Check acknowledgment and communication constraints, then recommend the most appropriate review-first follow-up.",
    mode: "action",
  };
  const stewardPathRecordRoute = /^\/steward-paths\/builder\/[^/]+(?:\/|$)/.test(pathname)
    || /^\/steward-paths\/(?!activity(?:\/|$)|analytics(?:\/|$)|builder(?:\/|$)|enrollments(?:\/|$)|library(?:\/|$)|livecom(?:\/|$)|new(?:\/|$)|review(?:\/|$)|settings(?:\/|$))[^/]+(?:\/|$)/.test(pathname);
  if (stewardPathRecordRoute) return {
    key: "steward-path",
    eyebrow: "Path coach",
    title: "Audit this donor journey",
    prompt: "Audit the Steward Path in my current view. Check its trigger, sequence, branches, review gates, donor experience, configuration gaps, and activation readiness using the real saved path data.",
    mode: "analyze",
  };
  if (pathname === "/reports" || pathname.startsWith("/reports/")) return {
    key: "reports",
    eyebrow: "Performance insight",
    title: "Turn this report into action",
    prompt: "Explain the most important signals in the current report using verified CRM totals. Identify meaningful changes, avoid estimates, and recommend the next three decisions.",
    mode: "analyze",
  };
  if (pathname === "/tasks") return {
    key: "tasks",
    eyebrow: "Work prioritization",
    title: "Find today’s highest-value work",
    prompt: "Prioritize the current CRM task workload using donor value, urgency, overdue status, and stewardship risk. Explain which tasks should move first and why.",
    mode: "analyze",
  };
  return null;
}

export default function StewardProactiveNudge() {
  const pathname = usePathname();
  const nudge = useMemo(() => getStewardNudge(pathname), [pathname]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    if (!nudge) return;
    let active = true;
    let timer: number | undefined;
    const storageKey = `steward-nudge:v1:${nudge.key}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    apiFetch<{ enabled?: boolean; chatHeadEnabled?: boolean }>("/api/steward-ai/config")
      .then((config) => {
        if (!active || config.enabled !== true || config.chatHeadEnabled === false) return;
        timer = window.setTimeout(() => { if (active) setVisible(true); }, 1800);
      })
      .catch(() => {});

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [nudge]);

  if (!nudge || !visible) return null;
  const storageKey = `steward-nudge:v1:${nudge.key}`;
  const dismiss = () => { window.sessionStorage.setItem(storageKey, "dismissed"); setVisible(false); };

  return (
    <aside className="fixed bottom-[max(5rem,calc(env(safe-area-inset-bottom)+5rem))] right-3 z-[9989] w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-blue-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.18)] sm:right-5" aria-label="Steward Copilot suggestion">
      <div className="flex items-start gap-2.5">
        <StewardAvatarIcon size={30} alt="Steward" className="shrink-0 ring-2 ring-blue-100" />
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f6cbd]">{nudge.eyebrow}</p><p className="mt-0.5 text-sm font-semibold text-slate-900">{nudge.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">Steward can use the record already open in this CRM view.</p></div>
        <button type="button" onClick={dismiss} aria-label="Dismiss Steward suggestion" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
      </div>
      <button type="button" onClick={() => { dismiss(); openStewardWithPrompt({ prompt: nudge.prompt, moduleKey: "donor", mode: nudge.mode }); }} className="mt-3 flex h-9 w-full items-center justify-center rounded-xl bg-[#0f6cbd] px-3 text-xs font-bold text-white hover:bg-[#115ea3]">Ask Steward</button>
    </aside>
  );
}
