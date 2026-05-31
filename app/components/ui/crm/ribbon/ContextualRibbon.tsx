"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolveCrmRibbonConfig } from "@/app/components/ui/crm/ribbon/config";
import type {
  CrmRibbonCommand,
  CrmRibbonCommandGroup,
  CrmRibbonCommandHandlers,
  CrmRibbonContext,
  CrmRibbonPageConfig,
} from "@/app/components/ui/crm/ribbon/types";

interface ContextualRibbonProps {
  pathname: string;
  className?: string;
  context?: CrmRibbonContext;
  handlers?: CrmRibbonCommandHandlers;
}

function resolveCommandDisabledReason(command: CrmRibbonCommand, context: CrmRibbonContext, handlers: CrmRibbonCommandHandlers): string | null {
  if (command.hidden?.(context)) return "hidden";
  if (command.requiredPermission && !(context.permissions ?? []).includes(command.requiredPermission)) {
    return "You do not have permission to run this command.";
  }
  if (typeof command.requiredSelectionMin === "number") {
    const selected = typeof context.selectionCount === "number" ? context.selectionCount : 0;
    if (selected < command.requiredSelectionMin) {
      return command.disabledReason ?? `Select at least ${command.requiredSelectionMin} record(s) to run this command.`;
    }
  }
  if (command.enabled && !command.enabled(context)) {
    return command.disabledReason ?? "This command is currently unavailable.";
  }
  if (!command.href && !handlers[command.id]) {
    return command.disabledReason ?? "This command is not connected in this workspace yet.";
  }
  return null;
}

function iconForCommand(commandId: string) {
  if (commandId.includes("help")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4M12 17h.01" />
      </svg>
    );
  }
  if (commandId.includes("refresh")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M19 9a7 7 0 0 0-12-3m-2 9a7 7 0 0 0 12 3" />
      </svg>
    );
  }
  if (commandId.includes("new") || commandId.includes("add") || commandId.includes("create")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (commandId.includes("filter")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
      </svg>
    );
  }
  if (commandId.includes("merge") || commandId.includes("dedupe") || commandId.includes("bulk")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 12h10M10 17h4M8 4v6M16 14v6" />
      </svg>
    );
  }
  if (commandId.includes("tag")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7l9 9-7 7-9-9V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h.01" />
      </svg>
    );
  }
  if (commandId.includes("export") || commandId.includes("download")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2h16v-2" />
      </svg>
    );
  }
  if (commandId.includes("share")) {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14-6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 11l8-4M8 13l8 4" />
      </svg>
    );
  }
  return (
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5v14" />
    </svg>
  );
}

function commandLooksLikeMenu(command: CrmRibbonCommand): boolean {
  return /(new-|bulk|saved|export|share|columns|density|view|date-range|sort|group)/.test(command.id);
}

function commandIsWired(command: CrmRibbonCommand, handlers: CrmRibbonCommandHandlers): boolean {
  return Boolean(command.href || handlers[command.id]);
}

function ChevronDownIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RibbonCommandButton({ command, context, handlers }: { command: CrmRibbonCommand; context: CrmRibbonContext; handlers: CrmRibbonCommandHandlers }) {
  const disabledReason = resolveCommandDisabledReason(command, context, handlers);
  if (disabledReason === "hidden") return null;

  const isDisabled = Boolean(disabledReason);
  const isActive = command.active?.(context) ?? false;
  const icon = command.icon ?? iconForCommand(command.id);

  const className = [
    "inline-flex min-h-[3.95rem] w-[4.25rem] shrink-0 select-none flex-col items-center justify-start gap-0.5 rounded-md border px-1 py-1.5 text-center",
    "text-[10px] font-semibold leading-tight transition-colors",
    isActive
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-transparent bg-transparent text-slate-900 hover:border-slate-200 hover:bg-slate-50",
    isDisabled ? "cursor-not-allowed opacity-55" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const title = disabledReason ?? command.label;

  if (command.href && !isDisabled) {
    return (
      <Link href={command.href} className={className} title={title} aria-label={command.label}>
        <span className="inline-flex h-5 w-5 items-center justify-center text-emerald-700">
          {icon}
        </span>
        <span className="line-clamp-2">
          {command.label}
          {commandLooksLikeMenu(command) ? <ChevronDownIcon className="ml-1 inline h-3 w-3 text-slate-500" /> : null}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handlers[command.id]}
      disabled={isDisabled}
      className={className}
      title={title}
      aria-label={command.label}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center text-emerald-700">
        {icon}
      </span>
      <span className="line-clamp-2">
        {command.label}
        {commandLooksLikeMenu(command) ? <ChevronDownIcon className="ml-1 inline h-3 w-3 text-slate-500" /> : null}
      </span>
    </button>
  );
}

function RibbonGroup({ group, context, handlers }: { group: CrmRibbonCommandGroup; context: CrmRibbonContext; handlers: CrmRibbonCommandHandlers }) {
  const visibleCommands = group.commands.filter((command) => !command.hidden?.(context) && commandIsWired(command, handlers));
  if (visibleCommands.length === 0) return null;

  return (
    <section className="flex min-w-fit flex-col justify-between border-r border-slate-200 px-1.5 last:border-r-0">
      <div className="flex flex-nowrap items-start gap-0.5">
        {visibleCommands.map((command) => (
          <RibbonCommandButton key={command.id} command={command} context={context} handlers={handlers} />
        ))}
      </div>
      <p className="pb-0.5 pt-0 text-center text-[9.5px] font-medium text-slate-500">{group.label}</p>
    </section>
  );
}

function findCommand(config: CrmRibbonPageConfig, id: string | undefined): CrmRibbonCommand | null {
  if (!id) return null;
  for (const tab of config.tabs) {
    for (const group of tab.groups) {
      const command = group.commands.find((item) => item.id === id);
      if (command) return command;
    }
  }
  return null;
}

function RibbonPrimaryAction({ command, context, handlers }: { command: CrmRibbonCommand | null; context: CrmRibbonContext; handlers: CrmRibbonCommandHandlers }) {
  if (!command || command.hidden?.(context)) return null;
  if (!commandIsWired(command, handlers)) return null;
  const disabledReason = resolveCommandDisabledReason(command, context, handlers);
  const isDisabled = Boolean(disabledReason);
  const icon = command.icon ?? iconForCommand(command.id);
  const className = "inline-flex h-8 min-w-[9rem] items-center justify-center gap-1.5 rounded-md border border-emerald-800 bg-emerald-800 px-3 text-[13px] font-semibold text-white shadow-[0_8px_16px_rgba(6,95,70,0.2)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";
  const content = (
    <>
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center">{icon}</span>
      <span>{command.label}</span>
      <ChevronDownIcon className="ml-0.5 h-3 w-3 text-emerald-50" />
    </>
  );

  if (command.href && !isDisabled) {
    return (
      <Link href={command.href} className={className} title={command.label}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handlers[command.id]} disabled={isDisabled} className={className} title={disabledReason ?? command.label}>
      {content}
    </button>
  );
}

export default function ContextualRibbon({ pathname, className = "", context, handlers }: ContextualRibbonProps) {
  const mergedContext = context ?? {};
  const resolvedHandlers = handlers ?? {};
  const config = useMemo(() => resolveCrmRibbonConfig(pathname), [pathname]);
  const [activeTabId, setActiveTabId] = useState(config.defaultTabId);

  useEffect(() => {
    setActiveTabId(config.defaultTabId);
  }, [config.defaultTabId, config.id]);

  const activeTab = config.tabs.find((tab) => tab.id === activeTabId) ?? config.tabs[0];
  const primaryCommand = findCommand(config, config.primaryCommandId);

  return (
    <div className={`sticky top-0 z-40 w-full min-w-0 ${className}`}>
      <div className="w-full overflow-hidden rounded-none border-x-0 border-b border-t-0 border-[#d5e2de] bg-white">
        <div className="flex h-4 items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-3 text-[9.5px] font-medium text-slate-400">
          <span className="truncate">{config.workspaceLabel ?? "Donor CRM"} / {config.pageLabel}</span>
          {config.statusLabel ? <span className="text-emerald-600">{config.statusLabel}</span> : null}
          {config.summaryText ? <span className="hidden truncate sm:inline">/ {config.summaryText}</span> : null}
        </div>

        <div className="flex min-h-[42px] items-center gap-3.5 border-b border-slate-200 bg-white px-3">
          <Link
            href="/"
            title="Home"
            aria-label="Home"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-900 shadow-[0_5px_10px_rgba(15,23,42,0.07)] transition hover:bg-slate-50"
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5" />
            </svg>
          </Link>

          <div className="flex min-w-0 flex-1 items-stretch gap-5 overflow-x-auto">
            {config.tabs.map((tab) => {
              const active = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={[
                    "relative h-[42px] shrink-0 border-b-[3px] px-0.5 text-[13.5px] font-semibold tracking-[0.01em]",
                    active
                      ? "border-emerald-700 text-emerald-800"
                      : "border-transparent text-slate-700 hover:text-slate-950",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <RibbonPrimaryAction command={primaryCommand} context={mergedContext} handlers={resolvedHandlers} />
        </div>

        <div className="overflow-x-auto bg-[linear-gradient(180deg,#ffffff_0%,#fbfdfd_100%)] px-2">
          <div className="flex min-h-[70px] min-w-fit items-stretch">
            {activeTab.groups.map((group) => (
              <RibbonGroup key={group.id} group={group} context={mergedContext} handlers={resolvedHandlers} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
