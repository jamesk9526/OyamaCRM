/**
 * ImageBlock — canvas render component
 *
 * Shows the image (or a placeholder when src is empty) along with optional
 * link wrapping, alignment, and padding.
 *
 * Note: Raw <img> is intentional here — these are user-supplied URLs whose
 * domains are unknown at build time, so Next.js Image optimization is not
 * applicable.  The email builder is an internal tool, not a public page.
 */
/* eslint-disable @next/next/no-img-element */

'use client';

import type { ImageBlock as ImageBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: ImageBlockData;
}

/** Renders an image block in the email canvas. */
export default function ImageBlock({ block }: Props) {
  const img =
    block.src ? (
      <img
        src={block.src}
        alt={block.alt}
        style={{ display: 'block', maxWidth: `${block.width}%`, height: 'auto', margin: 'auto' }}
      />
    ) : (
      /* Placeholder shown when no src is set */
      <div
        style={{
          maxWidth: `${block.width}%`,
          margin:   'auto',
          background: '#e5e7eb',
          border:   '2px dashed #9ca3af',
          borderRadius: 4,
          padding:  '32px 16px',
          textAlign: 'center',
          color:    '#6b7280',
          fontSize: 14,
        }}
      >
        🖼 No image URL set
      </div>
    );

  return (
    <div style={{ padding: block.padding, textAlign: block.align }}>
      {block.link ? (
        <a href={block.link} style={{ textDecoration: 'none' }}>
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
}
