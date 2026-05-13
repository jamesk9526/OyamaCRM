/** FirstTimeDonorWelcomeBlock welcomes and orients new donors. */
'use client';

import type { FirstTimeDonorWelcomeBlock as FirstTimeDonorWelcomeBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: FirstTimeDonorWelcomeBlockData;
}

/**
 * Renders first-time donor onboarding messaging with contact handoff.
 */
export default function FirstTimeDonorWelcomeBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ background: block.bgColor, color: block.textColor, borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.3, fontWeight: 700 }}>{block.headline}</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{block.missionIntro}</p>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{block.whatToExpect}</p>
        <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5 }}>Your contact person: {block.contactPerson}</p>
        <a
          href={block.ctaUrl}
          style={{
            display: 'inline-block',
            marginTop: 12,
            background: '#1d4ed8',
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
