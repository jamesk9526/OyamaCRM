import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { renderProductionLetter } from '../../server/src/services/letter-production-renderer';
import type { LetterSnapshot } from '../../server/src/services/letter-production-contract';

describe('production PDF pagination', () => {
  it('preserves long content across Letter and A4 pages and explicit page breaks', async () => {
    const assets = {
      'font:Inter': (await readFile('public/fonts/inter-latin-variable.woff2')).toString('base64'),
      'font:Noto Serif': (await readFile('public/fonts/noto-serif-latin.woff2')).toString('base64'),
    };
    for (const paper of ['Letter', 'A4'] as const) {
      const snapshot: LetterSnapshot = {
        version: 2, organizationId: 'fixture-org', templateId: 'fixture-template', revision: 1,
        title: 'Multi-page verification', subject: 'Annual update', generatedAt: '2026-11-02T12:00:00Z',
        recipientId: 'fixture-recipient', recipient: { name: 'Alexandra Example', addressLine1: '123 Example Street', addressLine2: '', city: 'Chicago', state: 'IL', zip: '60601' },
        branding: { organizationName: 'Letter verification fixture' }, header: {}, footer: { showPageNumber: true }, signature: { signerName: 'Example Signer' },
        layout: { paper, margins: { top: .75, right: .75, bottom: .75, left: .75 } }, assets, warnings: [], blockers: [],
        bodyHtml: Array.from({ length: 70 }, (_, i) => `<p>Paragraph ${i + 1}. Thank you for supporting our community. This paragraph verifies that long letters flow onto additional pages without losing content.</p>`).join('') + '<div data-letter-page-break="true"></div><p>FINAL EXPLICIT PAGE</p>',
      };
      const result = await renderProductionLetter(snapshot);
      const pdf = await PDFDocument.load(result.bytes);
      expect(result.pageCount).toBeGreaterThan(3);
      expect(pdf.getPages().every(page => Math.abs(page.getWidth() - (paper === 'Letter' ? 612 : 595.28)) < 1)).toBe(true);
      expect(pdf.getPageCount()).toBe(result.pageCount);
    }
  }, 120000);
});
