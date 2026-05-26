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

type PaletteMode = 'content' | 'layout';

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
        'group flex min-h-[5.35rem] flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-3 text-center',
        'cursor-grab select-none transition-all duration-150',
        'hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm',
        isDragging ? 'opacity-40 shadow-lg scale-105' : '',
      ].join(' ')}
      title={`Drag to add ${item.label} block`}
    >
      {/* Icon */}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-sm font-bold text-blue-600"
        aria-hidden
      >
        {item.icon}
      </span>

      <div className="min-w-0">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-slate-800">{item.label}</p>
      </div>
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
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('content');
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

  const visibleItems = useMemo(
    () => filteredItems.filter((item) => (paletteMode === 'layout' ? item.section === 'Layout' : item.section !== 'Layout')),
    [filteredItems, paletteMode]
  );

  return (
    <aside className="h-full w-full border-r border-slate-200 bg-white flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900">Add Components</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Drag content blocks onto the email canvas.</p>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {visibleItems.length} items
          </span>
        </div>
        <div className="flex gap-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setPaletteMode('content')}
            className={[
              'pb-2 text-sm font-semibold transition-colors',
              paletteMode === 'content'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            Content
          </button>
          <button
            type="button"
            onClick={() => setPaletteMode('layout')}
            className={[
              'pb-2 text-sm font-semibold transition-colors',
              paletteMode === 'layout'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            Layouts
          </button>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={paletteMode === 'layout' ? 'Search layout blocks...' : 'Search content blocks...'}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {SECTIONS.map((section) => {
          const items = visibleItems.filter((i) => i.section === section);
          if (items.length === 0) return null;
          const isCollapsed = collapsed[section];
          return (
            <div key={section}>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }))}
                className="mb-2 flex w-full items-center justify-between px-0.5 text-left"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{section}</span>
                <span className="text-xs text-slate-400">{isCollapsed ? '+' : '-'}</span>
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
        {visibleItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
            No blocks match this search.
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-slate-200 bg-white px-4 py-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-800">Design tip</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Keep your message clear and focused.</p>
          <p className="mt-2 text-xs font-semibold text-blue-600">Learn more →</p>
        </div>
      </div>
    </aside>
  );
}
