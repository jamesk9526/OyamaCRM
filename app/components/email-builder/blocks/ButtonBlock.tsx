/**
 * ButtonBlock — canvas render component
 *
 * Renders a styled call-to-action button inside an alignment wrapper.
 */

'use client';

import type { ButtonBlock as ButtonBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: ButtonBlockData;
}

/** Renders a button block in the email canvas. */
export default function ButtonBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, textAlign: block.align }}>
      <span
        style={{
          display:         'inline-block',
          backgroundColor: block.bgColor,
          color:           block.textColor,
          padding:         '12px 28px',
          borderRadius:    block.borderRadius,
          fontSize:        14,
          fontWeight:      'bold',
          cursor:          'pointer',
          textDecoration:  'none',
          lineHeight:      1,
        }}
      >
        {block.label || 'Button'}
      </span>
    </div>
  );
}
