/** ImpactStoryBlock renders a privacy-safe donor impact story card. */
'use client';

import type { ImpactStoryBlock as ImpactStoryBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: ImpactStoryBlockData;
}

/**
 * Displays a donor newsletter story section with optional image and CTA.
 */
export default function ImpactStoryBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ background: block.bgColor, color: block.textColor, borderRadius: 10, overflow: 'hidden' }}>
        {block.imageUrl && (
          <img
            src={block.imageUrl}
            alt="Impact story"
            style={{ width: '100%', display: 'block', height: 'auto' }}
          />
        )}
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>{block.headline}</h3>
          {block.pseudonym && (
            <p style={{ margin: '6px 0 0', fontSize: 11, opacity: 0.8 }}>{block.pseudonym}</p>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{block.story}</p>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
            Outcome: {block.outcome}
          </p>
          {block.ctaLabel && block.ctaUrl && (
            <a
              href={block.ctaUrl}
              style={{
                display: 'inline-block',
                marginTop: 12,
                background: '#16a34a',
                color: '#fff',
                textDecoration: 'none',
                padding: '10px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {block.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
