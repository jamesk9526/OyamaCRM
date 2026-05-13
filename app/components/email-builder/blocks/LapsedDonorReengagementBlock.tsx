/** LapsedDonorReengagementBlock renders warm reconnect messaging. */
'use client';

import type { LapsedDonorReengagementBlock as LapsedDonorReengagementBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: LapsedDonorReengagementBlockData;
}

/**
 * Displays donor re-engagement copy anchored to the last gift reference.
 */
export default function LapsedDonorReengagementBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ background: block.bgColor, color: block.textColor, borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.3, fontWeight: 700 }}>{block.greeting}</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>
          It has been a while since your last gift on {block.lastGiftDateToken}.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{block.message}</p>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>{block.impactReminder}</p>
        <a
          href={block.ctaUrl}
          style={{
            display: 'inline-block',
            marginTop: 12,
            background: '#ea580c',
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
      </div>
    </div>
  );
}
