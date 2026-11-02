# Letter builder component kit

The supplied November 2 mockups define the letters workspace composition and teal/navy control styling. Application controls are scoped with `lb-` classes; printed content uses separate `letter-rich-editor` rules.

- `LetterBuilderKit.tsx`: shared button, status, card, checklist, block palette and merge-field library. Palette actions insert supported editor nodes and preserve typed CRM tokens. Signature entry opens settings; it does not fabricate a signer.
- `ProductionBuilder.tsx`: API orchestration and composition. Owns template revision, selected recipient, save status, proof jobs, and responsive panel selection.
- `LetterFormattingToolbar.tsx` and `LetterEditor.tsx`: structured editing commands and supported node schema.
- `LetterProofViewer.tsx`: original PDF page rendering; proof pagination is authoritative, while the writing canvas remains continuous.

Use real API recipients, merge registries, branding and signatures. Never populate mockup sample names, counts, gifts, or organization identities in production components. Keep save conflicts visible and retain unsaved editor text. Preserve original legacy revision on conversion. Do not imply generation or approval is complete when only a PDF proof has been rendered.

Verification still required: rendered comparison against supplied mockups at desktop/mobile widths, keyboard interactions, upload errors, recipient changes during rendering, and authenticated generation/approval workflows. Existing multi-page PDF tests do not certify physical printing.
