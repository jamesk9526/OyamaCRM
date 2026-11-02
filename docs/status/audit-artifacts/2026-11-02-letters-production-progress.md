# Letters production upgrade — implementation in progress

The new pipeline remains behind the organization feature flag. Do not enable it for production yet.

Implemented foundations: additive revision/job/artifact-approval/batch schema, private checksummed PDF storage, Chromium rendering worker, frozen document inputs/assets/fonts, and initial Tiptap/PDF.js components.

Verification on 2026-11-02: server TypeScript passed. The Chromium pagination test passed for long Letter and A4 documents with an explicit final page break; it checks multiple pages and paper widths. This is not a visual or physical-print certification.

Outstanding: connect the complete builder, reconcile all legacy queue/export paths with artifact approvals, finish concurrency/idempotency handling, validate migrations against an isolated database, perform authenticated workflow tests, rasterized PDF inspection and responsive visual verification. No migration was applied and no organization flag was enabled during this work.

Follow-up: connected the feature-flagged structured builder to template save/revision APIs, recipient selection, asynchronous render status, and authenticated PDF retrieval. Added responsive Write/Proof views and guarded save responses against edits made while saving. Web TypeScript passed after integration. Autosave/recovery, full batch/approval UI, and visual certification remain outstanding.
