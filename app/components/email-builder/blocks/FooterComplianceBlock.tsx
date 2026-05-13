/** FooterComplianceBlock renders required donor email footer compliance details. */
'use client';

import type { FooterComplianceBlock as FooterComplianceBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: FooterComplianceBlockData;
}

/**
 * Displays organization identity, contact details, and unsubscribe/preferences links.
 */
export default function FooterComplianceBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, background: block.bgColor, color: block.textColor, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, lineHeight: 1.6 }}>{block.organizationNameToken}</p>
      <p style={{ margin: '1px 0 0', fontSize: 11, lineHeight: 1.6 }}>{block.addressToken}</p>
      <p style={{ margin: '1px 0 0', fontSize: 11, lineHeight: 1.6 }}>{block.phoneToken} • {block.websiteToken}</p>
      {block.taxIdToken && <p style={{ margin: '1px 0 0', fontSize: 11, lineHeight: 1.6 }}>Tax ID: {block.taxIdToken}</p>}
      <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.6 }}>
        {block.unsubscribeToken} · {block.managePreferencesToken}
      </p>
    </div>
  );
}
