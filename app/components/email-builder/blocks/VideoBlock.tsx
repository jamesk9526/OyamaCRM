/**
 * VideoBlock — canvas render component
 *
 * Shows a thumbnail with a play-button overlay in the canvas (iframes
 * cannot be embedded in real email; for the live preview we use an iframe).
 * Supports YouTube, Vimeo, OneDrive, and generic video URLs.
 *
 * Note: Raw <img> is intentional — thumbnail URLs are runtime user-supplied
 * values (YouTube CDN, Vimeo, etc.) that cannot be statically optimised.
 */
/* eslint-disable @next/next/no-img-element */

'use client';

import { parseVideoUrl } from '@/app/lib/email-builder-utils';
import type { VideoBlock as VideoBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: VideoBlockData;
}

/** Renders a video block with thumbnail + play overlay in the canvas. */
export default function VideoBlock({ block }: Props) {
  const parsed     = parseVideoUrl(block.url);
  const thumbUrl   = block.thumbnailUrl ?? parsed.thumbnailUrl;

  return (
    <div style={{ padding: block.padding, textAlign: 'center' }}>
      {/* Thumbnail / placeholder */}
      <div
        style={{
          position:     'relative',
          display:      'inline-block',
          maxWidth:     '100%',
          width:        '100%',
          background:   thumbUrl ? undefined : '#1f2937',
          borderRadius: 4,
          overflow:     'hidden',
          cursor:       'pointer',
        }}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={block.caption ?? 'Video thumbnail'}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        ) : (
          /* Dark placeholder when no thumbnail is available */
          <div
            style={{
              height:     160,
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color:      '#6b7280',
              fontSize:   14,
              flexDirection: 'column',
              gap:        8,
            }}
          >
            <span style={{ fontSize: 40 }}>▶</span>
            {block.url
              ? <span>Video preview unavailable</span>
              : <span>No video URL set</span>}
          </div>
        )}

        {/* Play button overlay */}
        {(thumbUrl || block.url) && (
          <div
            style={{
              position:   'absolute',
              inset:      0,
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                width:        56,
                height:       56,
                borderRadius: '50%',
                background:   'rgba(0,0,0,0.65)',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                color:        '#fff',
                fontSize:     22,
              }}
            >
              ▶
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      {block.caption && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
          {block.caption}
        </p>
      )}

      {/* Embed type badge */}
      {block.url && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
          {parsed.embedType.charAt(0).toUpperCase() + parsed.embedType.slice(1)} video
        </p>
      )}
    </div>
  );
}
