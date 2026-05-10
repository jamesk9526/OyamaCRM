/**
 * BlockPalette — left panel
 *
 * Displays draggable block-type cards grouped into sections.
 * Each card uses @dnd-kit/core's useDraggable hook with `data.origin = 'palette'`
 * so EmailCanvas can distinguish palette drops from canvas reorders.
 */

'use client';

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
        'flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border border-gray-200',
        'cursor-grab select-none transition-all duration-150',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-green-300',
        isDragging ? 'opacity-40 shadow-lg scale-105' : '',
      ].join(' ')}
      title={`Drag to add ${item.label} block`}
    >
      {/* Icon */}
      <span
        className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 font-bold text-sm shrink-0"
        aria-hidden
      >
        {item.icon}
      </span>

      {/* Label + description */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-tight">{item.label}</p>
        <p className="text-xs text-gray-400 leading-tight truncate">{item.description}</p>
      </div>
    </div>
  );
}

// ─── BlockPalette ─────────────────────────────────────────────────────────────

/** Section order determines display order in the left panel. */
const SECTIONS: PaletteItem['section'][] = ['Content', 'Media', 'Layout', 'Elements', 'AI'];

/**
 * Left panel — shows all draggable block-type cards grouped by section.
 * Width is fixed at 240 px (set by the parent layout).
 */
export default function BlockPalette() {
  return (
    <aside className="w-60 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Content Blocks
        </h2>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 px-3">
        {SECTIONS.map((section) => {
          const items = PALETTE_ITEMS.filter((i) => i.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-0.5">
                {section}
              </p>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <PaletteDragCard key={item.blockType} item={item} />
                ))}
              </div>
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
