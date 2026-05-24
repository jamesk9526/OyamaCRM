/**
 * ColumnsBlock — canvas render component
 *
 * Renders two equal-width columns side by side, each containing its own
 * stack of EmailBlocks.  Column editing is handled by BlockEditor.
 */

'use client';

import { useDroppable } from '@dnd-kit/core';
import type { ColumnsBlock as ColumnsBlockData } from '@/app/lib/email-builder-types';
import BlockRenderer from '../BlockRenderer';

interface Props {
  block: ColumnsBlockData;
  templateFontFamily?: string;
}

interface ColumnDropZoneProps {
  parentBlockId: string;
  columnIndex: number;
  blocks: ColumnsBlockData['columns'][number];
  templateFontFamily?: string;
}

/** Each column is a dedicated drop target for palette/content blocks. */
function ColumnDropZone({ parentBlockId, columnIndex, blocks, templateFontFamily }: ColumnDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `columns-drop-${parentBlockId}-${columnIndex}`,
    data: {
      target: 'columns-slot',
      parentBlockId,
      columnIndex,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        border: isOver ? '2px dashed #3b82f6' : '1px dashed #d1d5db',
        borderRadius: 4,
        minHeight: 60,
        overflow: 'hidden',
        backgroundColor: isOver ? '#eff6ff' : '#ffffff',
        transition: 'all 120ms ease',
      }}
    >
      {blocks.map((child) => (
        <BlockRenderer key={child.id} block={child} templateFontFamily={templateFontFamily} />
      ))}
      {blocks.length === 0 && (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: 12,
          }}
        >
          Column {columnIndex + 1} (empty)<br />
          Drag content blocks here
        </div>
      )}
    </div>
  );
}

/** Renders a two-column layout block in the email canvas. */
export default function ColumnsBlock({ block, templateFontFamily }: Props) {
  const totalColumns = block.columnCount === 3 ? 3 : 2;
  const columns = Array.from({ length: totalColumns }, (_, index) => block.columns[index] ?? []);

  return (
    <div style={{ padding: block.padding }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        {columns.map((column, index) => (
          <ColumnDropZone
            key={`column-${index + 1}`}
            parentBlockId={block.id}
            columnIndex={index}
            blocks={column}
            templateFontFamily={templateFontFamily}
          />
        ))}
      </div>
    </div>
  );
}
