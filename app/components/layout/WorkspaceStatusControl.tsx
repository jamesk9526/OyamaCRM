"use client";

import ChromeIcon, { type ChromeIconName } from "./topbar/ChromeIcon";
import "./workspace-command-dock.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveCrmRibbonConfig } from "@/app/components/ui/crm/ribbon/config";
import type { CrmRibbonCommand, CrmRibbonCommandHandlers, CrmRibbonContext } from "@/app/components/ui/crm/ribbon/types";
import { getWorkspaceCommandContext, WORKSPACE_COMMAND_CONTEXT_EVENT, type WorkspaceCommandContextDetail, type WorkspaceCommandEntry } from "@/app/lib/workspace-command-context";

function commandIcon(id: string): ChromeIconName {
  if (/help/.test(id)) return "help";
  if (/gift|giving|receipt|recurring|donation/.test(id)) return "gift";
  if (/email/.test(id)) return "mail";
  if (/import|export/.test(id)) return "upload";
  if (/report|summary|trend/.test(id)) return "chart";
  if (/letter|document/.test(id)) return "document";
  if (/constituent|donor|contact/.test(id)) return "person";
  if (/task|follow|interaction/.test(id)) return "check";
  if (/steward/.test(id)) return "assistant";
  return "commands";
}

function isAvailable(command: CrmRibbonCommand, context: CrmRibbonContext, handlers: CrmRibbonCommandHandlers): boolean {
  if (command.hidden?.(context)) return false;
  if (command.requiredPermission && !(context.permissions ?? []).includes(command.requiredPermission)) return false;
  if (typeof command.requiredSelectionMin === "number" && (context.selectionCount ?? 0) < command.requiredSelectionMin) return false;
  if (command.enabled && !command.enabled(context)) return false;
  return Boolean(command.href || handlers[command.id]);
}

/** Small hoverable top-bar replacement for the retired full-width CRM ribbon. */
export default function WorkspaceStatusControl() {
  const pathname = usePathname();
  const config = useMemo(() => resolveCrmRibbonConfig(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [registered, setRegistered] = useState<WorkspaceCommandContextDetail | null>(null);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setRegistered(getWorkspaceCommandContext(pathname));
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<WorkspaceCommandContextDetail>).detail;
      if (detail?.pathname === pathname) setRegistered(detail);
    };
    window.addEventListener(WORKSPACE_COMMAND_CONTEXT_EVENT, receive);
    return () => window.removeEventListener(WORKSPACE_COMMAND_CONTEXT_EVENT, receive);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const closeWhenOutside = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); controlRef.current?.querySelector<HTMLButtonElement>(".workspace-command-pill")?.focus(); }
    };

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const context = registered?.pathname === pathname ? registered.context : {};
  const handlers = registered?.pathname === pathname ? registered.handlers : {};
  const configuredCommands = config.tabs.flatMap((tab) => tab.groups.flatMap((group) => group.commands))
    .filter((command) => isAvailable(command, context, handlers))
    .map((command): WorkspaceCommandEntry => ({ id: command.id, label: command.label, href: command.href, onClick: handlers[command.id] }));
  const commands = (registered?.pathname === pathname && registered.commands?.length ? registered.commands : configuredCommands)
    .filter((command) => !command.disabled && Boolean(command.href || command.onClick))
    .filter((command, index, all) => all.findIndex(item => item.id === command.id) === index);
  const selected = context.selectionCount ?? 0;
  const visibleContext = registered?.pathname === pathname ? registered : null;
  const selectionLabel = visibleContext && selected > 0 ? `${selected} selected` : `${commands.length} actions`;
  return (
    <div ref={controlRef} className="workspace-command-dock" data-open={open} onPointerEnter={event => { if(event.pointerType === "mouse") setOpen(true); }}
      onMouseLeave={() => { if (!controlRef.current?.contains(document.activeElement)) setOpen(false); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      {open && <section id="workspace-command-ribbon" aria-label={`${config.pageLabel} commands`} className="workspace-command-ribbon">
        <header><div><p>{config.workspaceLabel ?? "Workspace"}</p><h2>{config.pageLabel}</h2></div>
          <span>{selectionLabel}</span><button type="button" aria-label="Collapse commands" onClick={() => { setOpen(false); controlRef.current?.querySelector<HTMLButtonElement>(".workspace-command-pill")?.focus(); }}>×</button></header>
        <nav aria-label="Page actions">{commands.length ? commands.map(command => command.href ?
          <Link key={command.id} href={command.href} onClick={() => setOpen(false)}><ChromeIcon name={commandIcon(command.id)} className="h-4 w-4"/>{command.label}</Link> :
          <button key={command.id} type="button" onClick={() => { command.onClick?.(); setOpen(false); }}><ChromeIcon name={commandIcon(command.id)} className="h-4 w-4"/>{command.label}</button>
        ) : <p className="workspace-command-empty">No page actions are available in this context.</p>}</nav>
      </section>}
      <button type="button" className="workspace-command-pill" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="workspace-command-ribbon"
        aria-label={`${open ? "Collapse" : "Expand"} ${config.pageLabel} commands`}>
        <span className="workspace-command-mark"><ChromeIcon name="commands" className="h-4 w-4"/></span>
        <strong>{config.pageLabel}</strong><span className="workspace-command-separator"/><span>{selectionLabel}</span>
        <ChromeIcon name="chevron" className={`h-3.5 w-3.5 ${open ? "rotate-180" : ""}`}/>
      </button>
    </div>
  );
}
