/** Drag/drop visual builder for print-content blocks in the letters workspace. */
"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PrintLayoutBlock, PrintLayoutDocument, PrintLayoutKind } from "@/app/components/letters/types";
import { createDefaultPrintBlock } from "@/app/components/letters/print-layout-utils";

interface PrintLayoutBuilderProps {
  value: PrintLayoutDocument;
  onChange: (next: PrintLayoutDocument) => void;
}

const BLOCK_KINDS: Array<{ kind: PrintLayoutKind; label: string }> = [
  { kind: "PARAGRAPH", label: "Paragraph" },
  { kind: "HEADING", label: "Heading" },
  { kind: "MERGE_TOKEN", label: "Merge Token" },
  { kind: "DIVIDER", label: "Divider" },
  { kind: "SPACER", label: "Spacer" },
];

/** Renders the visual print-layout builder with draggable blocks. */
export default function PrintLayoutBuilder({ value, onChange }: PrintLayoutBuilderProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  /** Appends one new block to the canvas. */
  function addBlock(kind: PrintLayoutKind) {
    onChange([...value, createDefaultPrintBlock(kind)]);
  }

  /** Removes one block from the canvas by ID. */
  function removeBlock(id: string) {
    onChange(value.filter((block) => block.id !== id));
  }

  /** Updates one block by ID with partial field changes. */
  function updateBlock(id: string, patch: Partial<PrintLayoutBlock>) {
    onChange(value.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  /** Reorders blocks after drag-and-drop completion. */
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = value.findIndex((block) => block.id === String(active.id));
    const to = value.findIndex((block) => block.id === String(over.id));
    if (from < 0 || to < 0) return;

    onChange(arrayMove(value, from, to));
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Block Palette</h3>
        {BLOCK_KINDS.map((entry) => (
          <button
            key={entry.kind}
            type="button"
            onClick={() => addBlock(entry.kind)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            Add {entry.label}
          </button>
        ))}
      </aside>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="mb-3 text-xs text-gray-500">Drag blocks to reorder. This visual layout still saves to the legacy print body format for compatibility.</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {value.length === 0 && (
                <div className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  Add your first block from the palette.
                </div>
              )}
              {value.map((block) => (
                <SortablePrintBlock
                  key={block.id}
                  block={block}
                  onRemove={() => removeBlock(block.id)}
                  onUpdate={(patch) => updateBlock(block.id, patch)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

interface SortablePrintBlockProps {
  block: PrintLayoutBlock;
  onRemove: () => void;
  onUpdate: (patch: Partial<PrintLayoutBlock>) => void;
}

/** Wraps one visual block with sortable drag behavior and inline editing fields. */
function SortablePrintBlock({ block, onRemove, onUpdate }: SortablePrintBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="rounded-md border border-gray-200 bg-white"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
            title="Drag to reorder"
          >
            Drag
          </button>
          <span className="text-xs font-semibold text-gray-700">{block.kind.replace("_", " ")}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:text-red-700">Remove</button>
      </div>

      <div className="p-3">
        {(block.kind === "PARAGRAPH" || block.kind === "HEADING") && (
          <textarea
            value={block.content ?? ""}
            onChange={(event) => onUpdate({ content: event.target.value })}
            rows={block.kind === "HEADING" ? 2 : 4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder={block.kind === "HEADING" ? "Heading text" : "Paragraph text"}
          />
        )}

        {block.kind === "MERGE_TOKEN" && (
          <input
            value={block.token ?? ""}
            onChange={(event) => onUpdate({ token: event.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="{{donor.firstName}}"
          />
        )}

        {block.kind === "SPACER" && (
          <label className="block text-sm text-gray-700">
            Spacer Height (px)
            <input
              type="number"
              min={8}
              max={200}
              value={block.spacerHeight ?? 24}
              onChange={(event) => onUpdate({ spacerHeight: Number.parseInt(event.target.value, 10) || 24 })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {block.kind === "DIVIDER" && <p className="text-xs text-gray-500">Divider renders as a horizontal separator in print text fallback.</p>}
      </div>
    </div>
  );
}
