/** DonorThankYouBlock renders a prebuilt acknowledgment section for donations. */
'use client';

import type { DonorThankYouBlock as DonorThankYouBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: DonorThankYouBlockData;
}

/**
 * Displays merge-token-ready donor thank-you messaging with signature.
 */
export default function DonorThankYouBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding }}>
      <div style={{ background: block.bgColor, color: block.textColor, borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.3, fontWeight: 700 }}>{block.headline}</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>
          Thank you for your gift of <strong>{block.giftAmountToken}</strong> on <strong>{block.giftDateToken}</strong>.
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.6 }}>Campaign/Fund: {block.campaignToken}</p>
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6 }}>{block.thankYouMessage}</p>
        <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.5 }}>
          With gratitude,
          <br />
          {block.staffSignature}
        </p>
      </div>
    </div>
  );
}
