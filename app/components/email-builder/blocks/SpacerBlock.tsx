/**
 * SpacerBlock — canvas render component
 *
 * Renders a vertical gap of the configured height (in pixels).
 * The dotted outline and label only appear in the canvas; they are
 * omitted in the generated email HTML.
 */

'use client';

import type { SpacerBlock as SpacerBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: SpacerBlockData;
}

/** Renders a visible spacer in the canvas (becomes transparent in real email). */
export default function SpacerBlock({ block }: Props) {
  return (
    <div
      style={{
        height:     block.height,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border:     '1px dashed #d1d5db',
        background: 'repeating-linear-gradient(45deg,#f9fafb,#f9fafb 4px,#f3f4f6 4px,#f3f4f6 8px)',
      }}
    >
      <span style={{ fontSize: 11, color: '#9ca3af', userSelect: 'none' }}>
        ↕ {block.height}px spacer
      </span>
    </div>
  );
}
