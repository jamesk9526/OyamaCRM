/**
 * TextBlock — canvas render component
 *
 * Displays the block's HTML content with its styling applied.
 * Uses dangerouslySetInnerHTML because the content is user-authored HTML.
 */

'use client';

import type { TextBlock as TextBlockData } from '@/app/lib/email-builder-types';
import RichTextEditor from '@/app/components/email-builder/RichTextEditor';
import { formatRichTextHtml } from '@/app/lib/email-builder-utils';

interface Props {
  block: TextBlockData;
  fontFamily?: string;
  editable?: boolean;
  onChangeContent?: (content: string) => void;
}

/**
 * Renders a text block in the email canvas.
 * Inline styles mirror what the HTML email generator produces.
 */
export default function TextBlock({ block, fontFamily, editable = false, onChangeContent }: Props) {
  if (editable) {
    return (
      <div style={{ padding: block.padding }}>
        <RichTextEditor
          value={block.content}
          onChange={(content) => onChangeContent?.(content)}
          minHeight={140}
          fontFamily={fontFamily}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        padding:    block.padding,
        fontFamily,
        fontSize:   block.fontSize,
        color:      block.color,
        textAlign:  block.align,
        lineHeight: 1.5,
      }}
      /* Safe — content is user-controlled within the builder. */
      dangerouslySetInnerHTML={{
        __html: formatRichTextHtml(block.content, {
          textColor: block.color,
          baseFontSizePx: block.fontSize,
          linkColor: block.color,
          fontFamily,
        }),
      }}
    />
  );
}
