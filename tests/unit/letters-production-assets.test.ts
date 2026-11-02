import { describe, expect, it } from 'vitest';
import { freezeLetterImages, letterBodyHtml, letterChromeHtml, renderProductionLetter, sanitizeLetterHtml } from '../../server/src/services/letter-production-renderer';
import { readFile } from 'node:fs/promises';
import type { LetterSnapshot } from '../../server/src/services/letter-production-contract';

const image = 'data:image/png;base64,iVBORw0KGgo=';
function fixture(): LetterSnapshot {
  return {
    version: 2, organizationId: 'fixture-org', templateId: 'fixture-template', revision: 1,
    title: 'Fixture', subject: '', bodyHtml: '<p>Body</p>', generatedAt: '2026-11-02T12:00:00Z',
    recipientId: null, recipient: { name: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '' },
    branding: { organizationName: 'Example Foundation', streetAddress1: '123 Main', contactPhone: '555-0100', contactEmail: 'info@example.test', websiteUrl: 'https://example.test', taxId: '12-345' },
    header: {}, footer: {}, signature: {}, layout: { paper: 'Letter', margins: { top: .75, right: .75, bottom: .75, left: .75 } },
    assets: {}, warnings: [], blockers: [],
  };
}

describe('production PDF frozen assets and chrome', () => {
  it('resolves unquoted/entity-escaped image URLs and retains the frozen bytes through sanitization', () => {
    const src = '/uploads/a.png?a=1&b=2';
    const html = freezeLetterImages('<img src=/uploads/a.png?a=1&amp;b=2 alt="Letter image">', { [src]: image });
    expect(sanitizeLetterHtml(html)).toContain(`src="${image}"`);
  });
  it('fails visibly for missing or unsafe images instead of silently omitting content', () => {
    expect(() => freezeLetterImages('<img src="https://example.test/missing.png">', {})).toThrow('frozen asset package');
    expect(() => freezeLetterImages('<img src="svg">', { svg: 'data:image/svg+xml;base64,PHN2Zz4=' })).toThrow('frozen asset package');
  });
  it('honors organization/contact visibility flags in repeated chrome', () => {
    const snapshot = fixture();
    snapshot.footer = { showOrganizationName: false, showAddress: false, showPhone: false, showEmail: false, showWebsite: false, showPageNumber: false, showTaxId: true };
    const output = letterChromeHtml(snapshot, true);
    expect(output).toContain('12-345');
    for (const hidden of ['Example Foundation', '123 Main', '555-0100', 'info@example.test', 'https://example.test', 'pageNumber']) expect(output).not.toContain(hidden);
    expect(letterChromeHtml({ ...snapshot, header: { enabled: false } }, false)).toBe('<div></div>');
  });
  it('uses frozen custom header/footer images and rejects a missing configured logo', () => {
    const snapshot = fixture();
    snapshot.assets = { '/stamp.png': image };
    snapshot.header = { customHtml: '<img src="/stamp.png">' };
    expect(letterChromeHtml(snapshot, false)).toContain(image);
    snapshot.branding.logoUrl = '/missing.png';
    expect(() => letterChromeHtml(snapshot, false)).toThrow('logo is missing');
  });
  it('retains explicit signature markers through canonical sanitization and avoids a duplicate automatic signature', () => {
    const snapshot = fixture();
    snapshot.bodyHtml = sanitizeLetterHtml('<div data-letter-signature="true"><p>Existing signer</p></div>');
    snapshot.signature = { signerName: 'Automatic signer' };
    expect(letterBodyHtml(snapshot)).toContain('Existing signer');
    expect(letterBodyHtml(snapshot)).not.toContain('Automatic signer');
  });
  it('rejects a header that would be clipped by its reserved margin', async () => {
    const snapshot = fixture();
    snapshot.layout.margins.top = .125;
    snapshot.header.customHtml = '<p style="font-size:24pt">A large header</p>';
    await expect(renderProductionLetter(snapshot)).rejects.toThrow('header does not fit its reserved margin');
  }, 30000);
  it('checks wide tables against printable paper width rather than the default browser viewport', async () => {
    const snapshot = fixture();
    snapshot.assets = {
      'font:Inter': (await readFile('public/fonts/inter-latin-variable.woff2')).toString('base64'),
      'font:Noto Serif': (await readFile('public/fonts/noto-serif-latin.woff2')).toString('base64'),
    };
    snapshot.bodyHtml = '<table style="width:900px"><tr><td>Oversized table</td></tr></table>';
    await expect(renderProductionLetter(snapshot)).rejects.toThrow('exceeds the printable width');
  }, 30000);
});
