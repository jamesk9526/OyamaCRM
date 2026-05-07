/**
 * TextBlock — canvas render component
 *
 * Displays the block's HTML content with its styling applied.
 * Uses dangerouslySetInnerHTML because the content is user-authored HTML.
 */

'use client';

import type { TextBlock as TextBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: TextBlockData;
}

/**
 * Renders a text block in the email canvas.
 * Inline styles mirror what the HTML email generator produces.
 */
export default function TextBlock({ block }: Props) {
  return (
    <div
      style={{
        padding:    block.padding,
        fontSize:   block.fontSize,
        color:      block.color,
        textAlign:  block.align,
        lineHeight: 1.5,
      }}
      /* Safe — content is user-controlled within the builder. */
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
}
