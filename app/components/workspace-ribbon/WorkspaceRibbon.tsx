/** Registers legacy workspace actions with the compact top-bar status control. */
"use client";

import { Children, isValidElement, useEffect } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { publishWorkspaceCommandContext, type WorkspaceCommandEntry } from "@/app/lib/workspace-command-context";

export interface WorkspaceRibbonTab {
  label: string;
  href?: string;
  active?: boolean;
}

interface WorkspaceRibbonProps {
  children: ReactNode;
  tabs?: WorkspaceRibbonTab[];
  accentTone?: "green" | "blue" | "purple" | "amber";
  className?: string;
  sticky?: boolean;
}

function collectActions(children: ReactNode): WorkspaceCommandEntry[] {
  const actions: WorkspaceCommandEntry[] = [];
  Children.forEach(children, (group, groupIndex) => {
    if (!isValidElement<{ children?: ReactNode }>(group)) return;
    Children.forEach(group.props.children, (child, childIndex) => {
      if (!isValidElement<{ label?: unknown; href?: unknown; onClick?: unknown; disabled?: unknown }>(child)) return;
      const props = child.props;
      if (typeof props.label !== "string") return;
      actions.push({
        id: `legacy-${groupIndex}-${childIndex}-${props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: props.label,
        href: typeof props.href === "string" ? props.href : undefined,
        onClick: typeof props.onClick === "function" ? props.onClick as () => void : undefined,
        disabled: Boolean(props.disabled),
      });
    });
  });
  return actions;
}

/** Retires the visual ribbon while preserving its page actions in the top bar. */
export default function WorkspaceRibbon({ children, tabs = [], accentTone: _accentTone = "green", className = "", sticky: _sticky = true }: WorkspaceRibbonProps) {
  const pathname = usePathname();
  const actions = [
    ...tabs.filter((tab) => Boolean(tab.href)).map((tab, index) => ({
      id: `legacy-tab-${index}-${tab.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: tab.label,
      href: tab.href,
    })),
    ...collectActions(children),
  ];

  useEffect(() => {
    publishWorkspaceCommandContext({ pathname, context: {}, handlers: {}, commands: actions });
  }, [actions, pathname]);

  return (
    <div className={`hidden ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}
