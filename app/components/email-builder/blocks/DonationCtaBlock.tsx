/** DonationCtaBlock renders a donor appeal call-to-action with amount chips. */
'use client';

import type { DonationCtaBlock as DonationCtaBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: DonationCtaBlockData;
}

/**
 * Shows donation appeal messaging, suggested amounts, and a primary CTA button.
 */
export default function DonationCtaBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ background: block.bgColor, color: block.textColor, borderRadius: 10, padding: 16, textAlign: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 21, lineHeight: 1.3, fontWeight: 700 }}>{block.headline}</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{block.appealText}</p>
        <div style={{ marginTop: 10 }}>
          {block.suggestedAmounts.map((amount) => (
            <span
              key={amount}
              style={{
                display: 'inline-block',
                margin: '4px 4px 0 0',
                border: `1px solid ${block.buttonColor}`,
                color: block.buttonColor,
                borderRadius: 999,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {amount}
            </span>
          ))}
        </div>
        <a
          href={block.buttonUrl}
          style={{
            display: 'inline-block',
            marginTop: 14,
            background: block.buttonColor,
            color: block.buttonTextColor,
            textDecoration: 'none',
            padding: '11px 20px',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {block.buttonLabel}
        </a>
      </div>
    </div>
  );
}
