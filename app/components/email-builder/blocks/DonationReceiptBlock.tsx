/** DonationReceiptBlock renders formal donation receipt summary content. */
'use client';

import type { DonationReceiptBlock as DonationReceiptBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: DonationReceiptBlockData;
}

/**
 * Displays donation details in a receipt-like card for tax and records email use.
 */
export default function DonationReceiptBlock({ block }: Props) {
  const rowStyle: React.CSSProperties = { margin: '4px 0', fontSize: 13, lineHeight: 1.5 };

  return (
    <div style={{ padding: block.padding }}>
      <div style={{ border: `1px solid ${block.borderColor}`, borderRadius: 10, background: block.bgColor, color: block.textColor }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${block.borderColor}`, fontSize: 14, fontWeight: 700 }}>
          Donation Receipt Summary
        </div>
        <div style={{ padding: '12px 16px' }}>
          <div style={rowStyle}><strong>Donor:</strong> {block.donorNameToken}</div>
          <div style={rowStyle}><strong>Gift Amount:</strong> {block.giftAmountToken}</div>
          <div style={rowStyle}><strong>Gift Date:</strong> {block.giftDateToken}</div>
          <div style={rowStyle}><strong>Receipt #:</strong> {block.receiptNumberToken}</div>
          <div style={rowStyle}><strong>Tax-Deductible:</strong> {block.taxDeductibleToken}</div>
          <div style={rowStyle}><strong>Designation:</strong> {block.designationToken}</div>
          <div style={rowStyle}><strong>Tax ID:</strong> {block.organizationTaxIdToken}</div>
          <p style={{ margin: '10px 0 0', paddingTop: 10, borderTop: `1px dashed ${block.borderColor}`, fontSize: 12, lineHeight: 1.5 }}>
            {block.goodsServicesStatement}
          </p>
        </div>
      </div>
    </div>
  );
}
