# Compassion client files and paper intake implementation — 2026-11-05

## Accepted direction

Modern CenterPiece workflow, light blue application surfaces and a slim light sidebar. Staff transcribe completed paper, with separate existing online intake. The supplied case intake and health/pregnancy forms are fixed v1 templates; wording, answer choices, sequence, sections, signatures and three-page grouping are preserved. Health forms are clinical-only. Scan annotations are excluded. Reflow on phones and continuation pages for unusually long entries are intentional.

## Implemented slices

- Versioned six-page field inventory and checked-in blank source PDFs under `docs/references/compassion`; source SHA-256 values are stored with new records.
- Client-file header, nine scoped tabs, case context and grouped Add record actions. Existing clinical, messaging, classes, appointments, imports and access destinations remain available.
- Paper editor, server drafts, casework revisions, reviewed profile/contact updates, protected source attachments, print controls and unsaved-navigation guards.
- One health/pregnancy chart, with existing encrypted storage, author-only editing, required clinical review fields, physician sign-off, returned corrections and amendments.
- Actual visit records distinct from bookings, walk-ins, case/staff links, retry keys, explicit services and linked forms/follow-ups.
- Support records for children/births, case visits, concepts, correspondence, individual education/mentoring and referrals; clinical vitals. Existing notes, service history, boutique/classes, STI/labs and ultrasound workflows are reused.
- Calendar-month/location register, source links, separate booking/attendance/client/supply totals, versioned optional event definitions, and guarded CSV export. No inference from draft forms or automatic clinical interpretation.
- Today documentation queue and client context on class/education links.

## Interfaces and persistence

New care APIs: `/form-templates`, `/documentation-queue`, `/clients/:id/forms`, `/case-forms` and revisions/documents/profile application, `/case-form-documents/:id/download`, `/visits` and services, `/reports/definitions`, `/reports/monthly`. Existing chart API supports `HEALTH_PREGNANCY_INTAKE` and `VITALS`. New form chart mutations require the current `expectedUpdatedAt`. Existing unrelated chart contracts remain compatible.

Additive migration: `20261105190000_compassion_paper_forms_visits`. Apply using `pnpm compassion:migrate`; generate the client before starting the updated API. New tables are CompassionFormRecord, CompassionFormRevision, CompassionVisit and CompassionReportDefinition. Existing documents default to CLINICAL; casework originals are explicitly form-owned. Duplicate consolidation rebinds encrypted forms, history and visits while preserving snapshots.

## Release gates

- Synthetic unit, HTTP and browser proof is separate from real database proof.
- Local MySQL is unavailable (ECONNREFUSED); migration application, transaction/concurrency proof and restart persistence remain required before release.
- No live care records, provider messages, production deployment or clinical cutover are authorized by the verification evidence.
- Blank source forms are retained unchanged; the digital form is a clean semantic reconstruction, not a pixel-equivalence claim against scanned artifacts.

Actual commands, results and visual comparisons are in `docs/status/audit-artifacts/2026-11-05-compassion-paper-forms/verification.md`.
