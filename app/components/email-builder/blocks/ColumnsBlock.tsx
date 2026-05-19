/**
 * ColumnsBlock — canvas render component
 *
 * Renders two equal-width columns side by side, each containing its own
 * stack of EmailBlocks.  Column editing is handled by BlockEditor.
 */

'use client';

import type { ColumnsBlock as ColumnsBlockData } from '@/app/lib/email-builder-types';
import BlockRenderer from '../BlockRenderer';

interface Props {
  block: ColumnsBlockData;
  templateFontFamily?: string;
}

/** Renders a two-column layout block in the email canvas. */
export default function ColumnsBlock({ block, templateFontFamily }: Props) {
  const totalColumns = block.columnCount === 3 ? 3 : 2;
  const columns = Array.from({ length: totalColumns }, (_, index) => block.columns[index] ?? []);

  return (
    <div style={{ padding: block.padding }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        {columns.map((column, index) => (
          <div
            key={`column-${index + 1}`}
            style={{
              flex: 1,
              border: '1px dashed #d1d5db',
              borderRadius: 4,
              minHeight: 60,
              overflow: 'hidden',
            }}
          >
            {column.map((child) => (
              <BlockRenderer key={child.id} block={child} templateFontFamily={templateFontFamily} />
            ))}
            {column.length === 0 && (
              <div
                style={{
                  padding: 16,
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: 12,
                }}
              >
                Column {index + 1} (empty)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
