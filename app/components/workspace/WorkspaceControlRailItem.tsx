/**
 * Renders a single workspace control rail item as either a local button or link.
 */
"use client";

import Link from "next/link";
import type { WorkspaceControlItem } from "./workspace-types";

interface WorkspaceControlRailItemProps {
  item: WorkspaceControlItem;
  active: boolean;
  onSelect: (id: string) => void;
}

const STATUS_STYLE: Record<NonNullable<WorkspaceControlItem["status"]>, string> = {
  Working: "bg-emerald-100 text-emerald-700",
  "Partially Working": "bg-amber-100 text-amber-700",
  "Demo Only": "bg-sky-100 text-sky-700",
  Broken: "bg-red-100 text-red-700",
  "Not Implemented": "bg-gray-200 text-gray-700",
};

/** A focused control item with accessibility-safe active and disabled behavior. */
export default function WorkspaceControlRailItem({ item, active, onSelect }: WorkspaceControlRailItemProps) {
  const baseClass = `group w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
    active
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
  }`;

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {item.icon && <span className="text-gray-500">{item.icon}</span>}
            <span className="truncate text-sm font-medium">{item.label}</span>
            {item.external && <span aria-hidden className="text-xs text-gray-400">↗</span>}
          </div>
          {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {item.badge !== undefined && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
              {item.badge}
            </span>
          )}
        </div>
      </div>

      {item.status && (
        <div className="mt-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[item.status]}`}>
            {item.status}
          </span>
        </div>
      )}
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={baseClass}
        title={item.description}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!item.disabled) onSelect(item.id);
      }}
      disabled={item.disabled}
      aria-current={active ? "page" : undefined}
      className={`${baseClass} disabled:cursor-not-allowed disabled:opacity-50`}
      title={item.disabled ? item.disabledReason : item.description}
    >
      {content}
    </button>
  );
}
