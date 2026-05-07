/**
 * DividerBlock — canvas render component
 *
 * A simple horizontal rule with configurable colour, thickness, and padding.
 */

'use client';

import type { DividerBlock as DividerBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: DividerBlockData;
}

/** Renders a divider block in the email canvas. */
export default function DividerBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <hr
        style={{
          border:     'none',
          borderTop:  `${block.thickness}px solid ${block.color}`,
          margin:     0,
        }}
      />
    </div>
  );
}
