/**
 * Reusable right-side workspace control rail for page-level views/actions.
 */
"use client";

import { useState } from "react";
import WorkspaceControlRailGroup from "./WorkspaceControlRailGroup";
import WorkspaceControlRailItem from "./WorkspaceControlRailItem";
import type { WorkspaceControlGroup } from "./workspace-types";

interface WorkspaceControlRailProps {
  groups: WorkspaceControlGroup[];
  activeItem?: string;
  onSelect: (id: string) => void;
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/** Sticky contextual control panel that avoids becoming a second global sidebar. */
export default function WorkspaceControlRail({
  groups,
  activeItem,
  onSelect,
  title = "Workspace Controls",
  collapsible = true,
  defaultCollapsed = false,
}: WorkspaceControlRailProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside className={`sticky top-3 h-fit rounded-xl border border-gray-200 bg-white shadow-sm ${collapsed ? "w-14" : "w-full"}`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-2.5 py-2">
        {!collapsed && <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h2>}
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-md border border-gray-300 px-1.5 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
            aria-label={collapsed ? "Expand control rail" : "Collapse control rail"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? ">" : "<"}
          </button>
        )}
      </div>

      <div className="space-y-3 p-2">
        {groups.map((group) => (
          <WorkspaceControlRailGroup key={group.id} label={collapsed ? "" : group.label}>
            {group.items.map((item) => (
              <WorkspaceControlRailItem
                key={item.id}
                item={{ ...item, description: collapsed ? undefined : item.description }}
                active={activeItem === item.id}
                onSelect={onSelect}
              />
            ))}
          </WorkspaceControlRailGroup>
        ))}
      </div>
    </aside>
  );
}
