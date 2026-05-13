/** GivingSummaryBlock renders a donor's annual giving overview. */
'use client';

import type { GivingSummaryBlock as GivingSummaryBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: GivingSummaryBlockData;
}

/**
 * Displays year-level giving totals and cadence metrics for stewardship emails.
 */
export default function GivingSummaryBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ background: block.bgColor, color: block.textColor, border: `1px solid ${block.accentColor}`, borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.3, fontWeight: 700 }}>Your {block.yearToken} Giving Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
          <div><strong>Total Giving:</strong> {block.totalGivingToken}</div>
          <div><strong>Number of Gifts:</strong> {block.giftCountToken}</div>
          <div><strong>First Gift:</strong> {block.firstGiftDateToken}</div>
          <div><strong>Last Gift:</strong> {block.lastGiftDateToken}</div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.5 }}>Campaigns supported: {block.campaignsSupportedToken}</p>
      </div>
    </div>
  );
}
