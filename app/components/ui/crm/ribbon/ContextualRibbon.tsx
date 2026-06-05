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

  const className = [
    "inline-flex min-h-[2.6rem] min-w-[4.6rem] shrink-0 select-none items-center justify-center rounded-md border px-2 py-1 text-center",
    "font-sans text-[11px] font-semibold leading-tight transition-colors",
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
    <section className="flex min-w-fit flex-col justify-between border-r border-slate-200 px-1 last:border-r-0">
      <div className="flex flex-nowrap items-start gap-0.5 py-0.5">
        {visibleCommands.map((command) => (
          <RibbonCommandButton key={command.id} command={command} context={context} handlers={handlers} />
        ))}
      </div>
      <p className="pb-0.5 pt-0 text-center font-sans text-[9px] font-medium text-slate-500">{group.label}</p>
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
  const className = "inline-flex h-7 min-w-[7.5rem] items-center justify-center gap-1 rounded-md border border-emerald-800 bg-emerald-800 px-2.5 font-sans text-[12px] font-semibold text-white shadow-[0_6px_14px_rgba(6,95,70,0.16)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";
  const content = (
    <>
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
      <div className="w-full overflow-hidden rounded-none border-x-0 border-b border-t-0 border-[#d5e2de] bg-white font-sans">
        <div className="flex h-3.5 items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-2.5 text-[9px] font-medium text-slate-400">
          <span className="truncate">{config.workspaceLabel ?? "Donor CRM"} / {config.pageLabel}</span>
          {config.statusLabel ? <span className="text-emerald-600">{config.statusLabel}</span> : null}
          {config.summaryText ? <span className="hidden truncate sm:inline">/ {config.summaryText}</span> : null}
        </div>

        <div className="flex min-h-[36px] items-center gap-2.5 border-b border-slate-200 bg-white px-2.5">
          <Link
            href="/"
            title="Home"
            aria-label="Home"
            className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2 font-sans text-[11px] font-semibold text-slate-900 shadow-[0_4px_8px_rgba(15,23,42,0.06)] transition hover:bg-slate-50"
          >
            Home
          </Link>

          <div className="flex min-w-0 flex-1 items-stretch gap-4 overflow-x-auto">
            {config.tabs.map((tab) => {
              const active = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={[
                    "relative h-[36px] shrink-0 border-b-[2px] px-0.5 font-sans text-[12px] font-semibold tracking-normal",
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

        <div className="overflow-x-auto bg-[linear-gradient(180deg,#ffffff_0%,#fbfdfd_100%)] px-1.5">
          <div className="flex min-h-[54px] min-w-fit items-stretch">
            {activeTab.groups.map((group) => (
              <RibbonGroup key={group.id} group={group} context={mergedContext} handlers={resolvedHandlers} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
