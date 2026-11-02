# Letter builder component kit

The supplied November 2 mockups define the letters workspace composition and teal/navy control styling. Application controls are scoped with `lb-` classes; printed content uses separate `letter-rich-editor` rules.

- `LetterBuilderKit.tsx`: shared button, status, card, checklist, block palette and merge-field library. Palette actions insert supported editor nodes and preserve typed CRM tokens. Signature entry opens settings; it does not fabricate a signer.
- `ProductionBuilder.tsx`: API orchestration and composition. Owns template revision, selected recipient, save status, proof jobs, and responsive panel selection.
- `LetterFormattingToolbar.tsx` and `LetterEditor.tsx`: structured editing commands and supported node schema.
- `LetterProofViewer.tsx`: original PDF page rendering; proof pagination is authoritative, while the writing canvas remains continuous.

Use real API recipients, merge registries, branding and signatures. Never populate mockup sample names, counts, gifts, or organization identities in production components. Keep save conflicts visible and retain unsaved editor text. Preserve original legacy revision on conversion. Do not imply generation or approval is complete when only a PDF proof has been rendered.

Verification still required: rendered comparison against supplied mockups at desktop/mobile widths, keyboard interactions, upload errors, recipient changes during rendering, and authenticated generation/approval workflows. Existing multi-page PDF tests do not certify physical printing.


## Canonical locations in the structured builder

| Capability | Owning surface | Other surfaces |
| --- | --- | --- |
| Save document / render proof | Command bar: Save letter / Preview | Recipient card explains Preview; no duplicate render button |
| Insert content, images, tables, page breaks | Document blocks library | Formatting toolbar has no insert commands |
| Inline and paragraph formatting | Formatting toolbar | Selection state and table-edit commands are contextual |
| Paper and margins | Document inspector (`LetterDocumentSettings`) | Canvas footer is a read-only summary |
| Letterhead/footer/signature configuration | Organization Branding Defaults | Inspector links there; it does not copy those settings |
| CRM merge fields | Merge-field library | Inserted fields are atomic editor nodes |
| Proof recipient | Recipient preview card | PDF label records rendered recipient and revision |
| PDF page navigation, zoom, download, print | Exact PDF proof viewer | Print opens original PDF and never marks production status |
| Production approval and mailing | Existing queue workflows / production APIs | Preview does not imply approved, printed, or mailed |

These changes consolidate the new structured builder. They do not certify that all historical settings screens, legacy builder tools, or queue controls have been migrated. Preserve legacy routes until their replacement workflows are verified.

Proof freshness compares the displayed artifact's revision/recipient with the current document and unsaved state. Starting a replacement request does not relabel old bytes as current. Recipient changes cancel in-flight requests; rendering has a 90-second client timeout. Renderer version v2.1 changes fingerprints so earlier jobs are not silently reused after output fixes.
