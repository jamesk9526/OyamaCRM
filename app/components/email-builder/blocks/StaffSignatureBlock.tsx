/** StaffSignatureBlock renders a reusable personal signature section. */
'use client';

import type { StaffSignatureBlock as StaffSignatureBlockData } from '@/app/lib/email-builder-types';

interface Props {
  block: StaffSignatureBlockData;
}

/**
 * Displays staff signature details used in donor relationship emails.
 */
export default function StaffSignatureBlock({ block }: Props) {
  return (
    <div style={{ padding: block.padding, color: block.textColor }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {block.headshotUrl && (
          <img
            src={block.headshotUrl}
            alt="Staff headshot"
            style={{ width: 64, height: 64, borderRadius: 999, objectFit: 'cover' }}
          />
        )}
        <div>
          {block.signatureImageUrl && (
            <img
              src={block.signatureImageUrl}
              alt="Signature"
              style={{ maxWidth: 180, height: 'auto', display: 'block', marginBottom: 6 }}
            />
          )}
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{block.nameToken}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.5 }}>{block.titleToken}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>{block.phoneToken} • {block.emailToken}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.5 }}>{block.organizationToken}</p>
        </div>
      </div>
    </div>
  );
}
