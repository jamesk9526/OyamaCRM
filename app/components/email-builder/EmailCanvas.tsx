/**
 * EmailCanvas — center panel
 *
 * Droppable area that renders the email preview (white 600 px card on a
 * dark-gray background).  Blocks are individually sortable via @dnd-kit.
 *
 * Drag interactions:
 *  - Dragging from BlockPalette → drops create new blocks
 *  - Dragging an existing block → reorders via SortableContext
 *
 * Each block wrapper (SortableBlock) is also clickable to select it.
 */

'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EmailBlock, EmailTemplate } from '@/app/lib/email-builder-types';
import BlockRenderer from './BlockRenderer';

// ─── SortableBlock ────────────────────────────────────────────────────────────

interface SortableBlockProps {
  block:      EmailBlock;
  isSelected: boolean;
  onSelect:   (id: string) => void;
  onDelete:   () => void;
}

/**
 * Wraps an individual block with:
 * - Sortable drag behaviour (useSortable)
 * - Visual selection ring
 * - Hover drag-handle
 * - Delete button when selected
 */
function SortableBlock({
  block,
  isSelected,
  onSelect,
  onDelete,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id:   block.id,
    data: { origin: 'canvas' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.35 : 1,
        position:   'relative',
      }}
      /* tabIndex & aria props for keyboard sorting come from attributes */
      {...attributes}
      className="group"
    >
      {/* ── Drag handle (visible on hover) ── */}
      <div
        {...listeners}
        title="Drag to reorder"
        className={[
          'absolute top-0 inset-x-0 z-20 flex items-center justify-center h-6',
          'cursor-grab opacity-0 group-hover:opacity-100 transition-opacity',
          'bg-white/80 border-b border-gray-200',
        ].join(' ')}
      >
        <svg
          width="18"
          height="10"
          viewBox="0 0 18 10"
          fill="none"
          className="text-gray-400"
        >
          <rect y="0" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="4" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
        </svg>
      </div>

      {/* ── Block content ── */}
      <div
        onClick={() => onSelect(block.id)}
        className={[
          'relative cursor-pointer pt-6 transition-all',
          isSelected
            ? 'outline outline-2 outline-green-600 outline-offset-0'
            : 'hover:outline hover:outline-1 hover:outline-gray-300',
        ].join(' ')}
      >
        <BlockRenderer block={block} />

        {/* ── Toolbar shown when selected ── */}
        {isSelected && (
          <div className="absolute top-6 right-1 z-30 flex gap-1">
            <span className="text-xs bg-green-600 text-white rounded-tl-none rounded-br-none rounded-tr-none rounded-bl-none px-1.5 py-0.5 rounded select-none">
              {block.type}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-xs bg-red-500 text-white rounded px-1.5 py-0.5 hover:bg-red-600 transition-colors"
              title="Delete block"
            >
              × Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EmailCanvas ──────────────────────────────────────────────────────────────

interface Props {
  template:         EmailTemplate;
  selectedId:       string | null;
  onSelectBlock:    (id: string | null) => void;
  onDeleteBlock:    (id: string) => void;
}

/**
 * Center panel of the email builder.
 *
 * - Dark-gray canvas background
 * - Centered white email card (max-width = template.contentWidth)
 * - SortableContext wraps all blocks so they can be reordered
 * - useDroppable makes the empty canvas a valid drop target for palette drags
 */
export default function EmailCanvas({
  template,
  selectedId,
  onSelectBlock,
  onDeleteBlock,
}: Props) {
  /* Fallback droppable for when the canvas is empty or the drag target
     is between blocks rather than directly on a block. */
  const { setNodeRef: setCanvasRef, isOver: isCanvasOver } = useDroppable({
    id: 'canvas-droppable',
  });

  return (
    <div
      className="flex-1 overflow-auto bg-gray-600"
      style={{ padding: '32px 24px' }}
      /* Deselect when clicking the raw canvas background */
      onClick={() => onSelectBlock(null)}
    >
      {/* Email content area */}
      <div
        style={{
          maxWidth:        template.contentWidth,
          margin:          '0 auto',
          backgroundColor: '#ffffff',
          boxShadow:       '0 4px 24px rgba(0,0,0,0.18)',
        }}
        /* Stop click propagation so the canvas deselect above doesn't fire */
        onClick={(e) => e.stopPropagation()}
      >
        <SortableContext
          items={template.blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={setCanvasRef}
            style={{ minHeight: 320 }}
            className={[
              'transition-all',
              isCanvasOver
                ? 'outline outline-2 outline-dashed outline-green-400 outline-offset-[-2px]'
                : '',
            ].join(' ')}
          >
            {template.blocks.length === 0 ? (
              /* Empty-state drop zone */
              <div
                className={[
                  'flex flex-col items-center justify-center h-80 text-center',
                  'border-2 border-dashed rounded transition-colors',
                  isCanvasOver
                    ? 'border-green-400 bg-green-50 text-green-600'
                    : 'border-gray-300 text-gray-400',
                ].join(' ')}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mb-3 opacity-60"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                <p className="text-sm font-medium">Drag blocks here to start building</p>
                <p className="text-xs mt-1 opacity-70">
                  Select a block type from the left panel
                </p>
              </div>
            ) : (
              template.blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedId === block.id}
                  onSelect={onSelectBlock}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
