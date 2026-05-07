/**
 * SocialBlock — canvas render component
 *
 * Displays coloured platform badges arranged according to the block's
 * alignment setting.
 */

'use client';

import type { SocialBlock as SocialBlockData, SocialPlatform } from '@/app/lib/email-builder-types';

interface Props {
  block: SocialBlockData;
}

/** Brand colour per social platform. */
const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  facebook:  '#1877f2',
  twitter:   '#1da1f2',
  instagram: '#e1306c',
  linkedin:  '#0a66c2',
  youtube:   '#ff0000',
};

/** Display label per social platform. */
const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook:  'Facebook',
  twitter:   'Twitter',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
  youtube:   'YouTube',
};

/** Renders a social links block in the email canvas. */
export default function SocialBlock({ block }: Props) {
  return (
    <div
      style={{
        padding:    block.padding,
        textAlign:  block.align,
        display:    'flex',
        flexWrap:   'wrap',
        gap:        8,
        justifyContent:
          block.align === 'center' ? 'center'
          : block.align === 'right'  ? 'flex-end'
          : 'flex-start',
      }}
    >
      {block.links.length === 0 && (
        <span style={{ fontSize: 13, color: '#9ca3af' }}>No social links added</span>
      )}
      {block.links.map((link) => (
        <span
          key={link.platform}
          style={{
            display:         'inline-block',
            backgroundColor: PLATFORM_COLORS[link.platform],
            color:           '#ffffff',
            fontSize:        12,
            fontWeight:      'bold',
            padding:         '6px 14px',
            borderRadius:    4,
            cursor:          'pointer',
          }}
        >
          {PLATFORM_LABELS[link.platform]}
        </span>
      ))}
    </div>
  );
}
