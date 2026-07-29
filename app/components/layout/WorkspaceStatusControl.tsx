"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveCrmRibbonConfig } from "@/app/components/ui/crm/ribbon/config";
import type { CrmRibbonCommand, CrmRibbonCommandHandlers, CrmRibbonContext } from "@/app/components/ui/crm/ribbon/types";
import { WORKSPACE_COMMAND_CONTEXT_EVENT, type WorkspaceCommandContextDetail } from "@/app/lib/workspace-command-context";

function isAvailable(command: CrmRibbonCommand, context: CrmRibbonContext, handlers: CrmRibbonCommandHandlers): boolean {
  if (command.hidden?.(context)) return false;
  if (command.requiredPermission && !(context.permissions ?? []).includes(command.requiredPermission)) return false;
  if (typeof command.requiredSelectionMin === "number" && (context.selectionCount ?? 0) < command.requiredSelectionMin) return false;
  if (command.enabled && !command.enabled(context)) return false;
  return Boolean(command.href || handlers[command.id]);
}

/** Small hoverable top-bar replacement for the retired full-width CRM ribbon. */
export default function WorkspaceStatusControl({ dark = false }: { dark?: boolean }) {
  const pathname = usePathname();
  const config = useMemo(() => resolveCrmRibbonConfig(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [registered, setRegistered] = useState<WorkspaceCommandContextDetail | null>(null);

  useEffect(() => {
    setRegistered(null);
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceCommandContextDetail>).detail;
      if (detail?.pathname === pathname) setRegistered(detail);
    };
    window.addEventListener(WORKSPACE_COMMAND_CONTEXT_EVENT, receive);
    return () => window.removeEventListener(WORKSPACE_COMMAND_CONTEXT_EVENT, receive);
  }, [pathname]);

  const context = registered?.context ?? {};
  const handlers = registered?.handlers ?? {};
  const commands = config.tabs.flatMap((tab) => tab.groups.flatMap((group) => group.commands))
    .filter((command) => isAvailable(command, context, handlers))
    .slice(0, 8);
  const stateLabel = config.statusLabel ?? "Workspace";
  const buttonTone = dark
    ? "border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]"
    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";

  return (
    <div className="relative shrink-0" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`${config.workspaceLabel ?? "CRM"} · ${config.pageLabel}`}
        className={`inline-flex h-8 max-w-[190px] items-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition-colors ${buttonTone}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateLabel === "Working" ? "bg-emerald-500" : "bg-amber-500"}`} />
        <span className="hidden truncate 2xl:inline">{config.pageLabel}</span>
        <span className="truncate xl:inline">{stateLabel}</span>
        <svg className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
      </button>

      {open ? (
        <div role="dialog" aria-label="Current workspace status and actions" className="absolute right-0 top-full z-[70] mt-2 w-[min(360px,calc(100vw-1rem))] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
          <div className="border-b border-slate-200 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Current workspace</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{config.workspaceLabel ?? "CRM"} <span className="text-slate-300">/</span> {config.pageLabel}</p>
            <p className="mt-0.5 text-xs text-slate-500">{config.summaryText ?? "Current work context"}</p>
          </div>
          <div className="grid grid-cols-2 gap-1 p-2">
            {commands.length ? commands.map((command) => command.href ? (
              <Link key={command.id} href={command.href} onClick={() => setOpen(false)} className="rounded-md px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950">{command.label}</Link>
            ) : (
              <button key={command.id} type="button" onClick={() => { handlers[command.id]?.(); setOpen(false); }} className="rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950">{command.label}</button>
            )) : <p className="col-span-2 px-2.5 py-2 text-xs text-slate-500">Page actions will appear here when available.</p>}
          </div>
          <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">Hover or click this status control anytime to see page context and actions.</div>
        </div>
      ) : null}
    </div>
  );
}
