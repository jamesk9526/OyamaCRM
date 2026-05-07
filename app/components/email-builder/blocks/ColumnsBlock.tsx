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
}

/** Renders a two-column layout block in the email canvas. */
export default function ColumnsBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Column 1 */}
        <div
          style={{
            flex:         1,
            border:       '1px dashed #d1d5db',
            borderRadius: 4,
            minHeight:    60,
            overflow:     'hidden',
          }}
        >
          {(block.columns[0] ?? []).map((child) => (
            <BlockRenderer key={child.id} block={child} />
          ))}
          {(block.columns[0] ?? []).length === 0 && (
            <div
              style={{
                padding:    16,
                textAlign:  'center',
                color:      '#9ca3af',
                fontSize:   12,
              }}
            >
              Column 1 (empty)
            </div>
          )}
        </div>

        {/* Column 2 */}
        <div
          style={{
            flex:         1,
            border:       '1px dashed #d1d5db',
            borderRadius: 4,
            minHeight:    60,
            overflow:     'hidden',
          }}
        >
          {(block.columns[1] ?? []).map((child) => (
            <BlockRenderer key={child.id} block={child} />
          ))}
          {(block.columns[1] ?? []).length === 0 && (
            <div
              style={{
                padding:    16,
                textAlign:  'center',
                color:      '#9ca3af',
                fontSize:   12,
              }}
            >
              Column 2 (empty)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
