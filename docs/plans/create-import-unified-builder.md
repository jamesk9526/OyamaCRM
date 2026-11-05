# Automatic content import and unified Create builder

Accepted 2026-11-04. Preserve original donor communications, import new legacy records automatically, review later source edits, and use shared editing alongside Letter/Email/Social/Web/SMS previews. Clinical content and external mail accounts are excluded. Importing never dispatches communications.

## Implementation checkpoints

- [x] Versioned channel design, safe conversion and preserved HTML with focused regressions.
- [x] Durable organization import inventory/worker/source revisions, reconciliation, pagination and history.
- [x] Unified editor/preview panes, channel controls and browser-local recovery.
- [x] Shared preview/release/publication renderers, email-only support and compatibility checks.
- [x] Focused tests, types/lint/build passes, production-browser and rasterized PDF evidence, and status documentation.
- [ ] Run disposable-MySQL migration/contention checks and measure live inventory/conversion exceptions before rollout.
- [x] Final managed-copy/empty-HTML guards and mobile navigation-transition checks passed in the desktop/HTML follow-up; MySQL/live inventory gates remain open.

Implementation, exact verification and rollout gates: [audit report](../status/audit-artifacts/2026-11-04-create-unified-import/verification.md).

## Invariants

Retries and concurrent workers cannot duplicate sources. Original executions/PDFs and existing Studio edits remain intact. Ownership is retained. New legacy edits become review candidates. Public channels never resolve donor-specific content. Preview does not save, approve or release. Existing published outputs remain frozen. Preserve prior document readers and legacy routes through additive changes.
