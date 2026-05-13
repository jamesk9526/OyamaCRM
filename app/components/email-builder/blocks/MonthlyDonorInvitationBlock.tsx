/** MonthlyDonorInvitationBlock invites donors into recurring giving. */
'use client';

import type { MonthlyDonorInvitationBlock as MonthlyDonorInvitationBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: MonthlyDonorInvitationBlockData;
}

/**
 * Renders recurring-gift invitation content with suggested monthly amounts.
 */
export default function MonthlyDonorInvitationBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ background: block.bgColor, color: block.textColor, borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.3, fontWeight: 700 }}>{block.headline}</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{block.message}</p>
        <div style={{ marginTop: 10 }}>
          {block.suggestedMonthlyAmounts.map((amount) => (
            <span
              key={amount}
              style={{
                display: 'inline-block',
                margin: '0 6px 6px 0',
                padding: '5px 10px',
                borderRadius: 999,
                border: '1px solid #bfdbfe',
                background: '#fff',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {amount}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          {block.benefitBullets.map((bullet) => (
            <p key={bullet} style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5 }}>• {bullet}</p>
          ))}
        </div>
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
