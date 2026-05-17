/**
 * BlockPalette — left panel
 *
 * Displays draggable block-type cards grouped into sections.
 * Each card uses @dnd-kit/core's useDraggable hook with `data.origin = 'palette'`
 * so EmailCanvas can distinguish palette drops from canvas reorders.
 */

'use client';

import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { PALETTE_ITEMS } from '@/app/lib/email-builder-types';
import type { PaletteItem } from '@/app/lib/email-builder-types';

// ─── PaletteDragCard ──────────────────────────────────────────────────────────

interface CardProps {
  item: PaletteItem;
}

/**
 * A single draggable card in the palette.
 * The card's drag data includes `origin: 'palette'` and `blockType`
 * so the DndContext onDragEnd handler knows to create a new block.
 */
function PaletteDragCard({ item }: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `palette-${item.blockType}`,
    data: { origin: 'palette', blockType: item.blockType },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={[
        'group flex min-h-[118px] flex-col items-start gap-2 bg-white rounded-lg border border-gray-200 p-3',
        'cursor-grab select-none transition-all duration-150',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-green-300',
        isDragging ? 'opacity-40 shadow-lg scale-105' : '',
      ].join(' ')}
      title={`Drag to add ${item.label} block`}
    >
      {/* Icon */}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-600"
        aria-hidden
      >
        {item.icon}
      </span>

      {/* Label + description */}
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-gray-800">{item.label}</p>
        <p className="line-clamp-3 text-xs leading-tight text-gray-500">{item.description}</p>
      </div>

      <span className="mt-auto self-end text-xs font-semibold text-gray-300 group-hover:text-gray-400">Drag</span>
    </div>
  );
}

// ─── BlockPalette ─────────────────────────────────────────────────────────────

/** Section order determines display order in the left panel. */
const SECTIONS: PaletteItem['section'][] = [
  'Basic',
  'Impact',
  'Donation & Giving',
  'Stewardship',
  'Campaigns',
  'Events',
  'Stories',
  'Ministry / Mission',
  'Personalization',
  'Layout',
  'Compliance',
  'Media',
  'AI',
];

/**
 * Left panel — shows all draggable block-type cards grouped by section.
 * Width is fixed at 288 px (set by the component class).
 */
export default function BlockPalette() {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<PaletteItem['section'], boolean>>({
    Basic: false,
    Impact: false,
    'Donation & Giving': false,
    Stewardship: false,
    Campaigns: false,
    Events: false,
    Stories: false,
    'Ministry / Mission': false,
    Personalization: false,
    Layout: false,
    Compliance: false,
    Media: false,
    AI: false,
  });

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      PALETTE_ITEMS.filter((item) => {
        if (!normalizedQuery) return true;
        return [item.label, item.description, item.section]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery]
  );

  return (
    <aside className="h-full w-full bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Block Library
        </h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocks..."
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700"
        />
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 px-3">
        {SECTIONS.map((section) => {
          const items = filteredItems.filter((i) => i.section === section);
          if (items.length === 0) return null;
          const isCollapsed = collapsed[section];
          return (
            <div key={section}>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }))}
                className="mb-2 flex w-full items-center justify-between px-0.5 text-left"
              >
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{section}</span>
                <span className="text-xs text-gray-400">{isCollapsed ? '+' : '-'}</span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item) => (
                    <PaletteDragCard key={item.blockType} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <p className="text-xs text-gray-400 text-center">
          Drag blocks onto the canvas
        </p>
      </div>
    </aside>
  );
}
