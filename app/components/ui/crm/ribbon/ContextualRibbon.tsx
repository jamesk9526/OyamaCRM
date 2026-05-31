"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolveCrmRibbonConfig } from "@/app/components/ui/crm/ribbon/config";
import type {
  CrmRibbonCommand,
  CrmRibbonCommandGroup,
  CrmRibbonCommandHandlers,
  CrmRibbonContext,
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
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4M12 17h.01" />
      </svg>
    );
  }
  if (commandId.includes("refresh")) {
    return (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M19 9a7 7 0 0 0-12-3m-2 9a7 7 0 0 0 12 3" />
      </svg>
    );
  }
  if (commandId.includes("new") || commandId.includes("add") || commandId.includes("create")) {
    return (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (commandId.includes("export") || commandId.includes("download")) {
    return (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2h16v-2" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5v14" />
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
    "inline-flex min-h-14 w-[5.1rem] shrink-0 select-none flex-col items-center justify-start gap-1 rounded-md border px-1.5 py-1.5 text-center",
    "text-[11px] font-medium leading-tight transition-colors",
    isActive
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100",
    isDisabled ? "cursor-not-allowed opacity-55" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const title = disabledReason ?? command.label;

  if (command.href && !isDisabled) {
    return (
      <Link href={command.href} className={className} title={title} aria-label={command.label}>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600">
          {icon}
        </span>
        <span className="line-clamp-2">{command.label}</span>
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
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600">
        {icon}
      </span>
      <span className="line-clamp-2">{command.label}</span>
    </button>
  );
}

function RibbonGroup({ group, context, handlers }: { group: CrmRibbonCommandGroup; context: CrmRibbonContext; handlers: CrmRibbonCommandHandlers }) {
  return (
    <section className="flex min-w-fit flex-col border-r border-slate-200 px-2 last:border-r-0 min-[1400px]:px-2.5">
      <div className="flex flex-wrap items-start gap-0.5">
        {group.commands.map((command) => (
          <RibbonCommandButton key={command.id} command={command} context={context} handlers={handlers} />
        ))}
      </div>
      <p className="pt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
    </section>
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

  return (
    <div className={`sticky top-0 z-30 ${className}`}>
      <div className="overflow-hidden rounded-md border border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfd_100%)] shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200/90 px-3">
          <div className="flex min-w-0 items-end gap-4 overflow-x-auto">
            {config.tabs.map((tab) => {
              const active = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={[
                    "relative h-9 shrink-0 border-b-2 px-0.5 text-[12px] font-semibold tracking-[0.01em]",
                    active
                      ? "border-emerald-600 text-slate-900"
                      : "border-transparent text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto px-2 py-1.5 min-[1400px]:px-2.5">
          <div className="flex min-w-fit items-stretch gap-0.5">
            {activeTab.groups.map((group) => (
              <RibbonGroup key={group.id} group={group} context={mergedContext} handlers={resolvedHandlers} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
