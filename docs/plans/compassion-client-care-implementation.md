# Compassion client-care implementation

Approved direction: recover and refactor the former Compassion app as a client-care application, sharing platform accounts while keeping its workflows, API process, data, audit evidence, and visual design separate from DonorCRM.

## Architecture

- `/compassion` is the canonical entry point; `/compassion/login` provides the clinical sign-in screen.
- The API runs independently on `127.0.0.1:4100`. Next proxies `/api/compassion/*` and `/api/compassion-public/*` to it. The donor API entry point and routes are unchanged.
- Platform authentication supplies identity only. Explicit Compassion memberships authorize records, scheduling, casework, clinical access, physician sign-off, migration, exports, messages, and administration.
- New data, booking configuration, and audit evidence use dedicated `Compassion*` tables. Client records never create donors, donations, donor activities, audiences, or AI context.
- Clinical CSS is scoped under `.compassion-shell`; Compassion does not inherit donor appearance settings. Separately authorized donor dashboard work changes donor styles only.

## Delivered workflows

1. Recovered client directory, client/case management, service and assistance history, staff directory, follow-up, and scheduling logic from `32c316f6^`; replaced the old application chrome and misleading client-tab representations.
2. Added a Today workspace, day/week/month/agenda scheduling, protected conflict checks, room/equipment reservations, availability checks, check-in, and reviewed public booking.
3. Added encrypted chart drafts, required-field review, review locking, physician-only electronic sign-off, preserved amendments, protected documents, and printable signed reports with identity/attachment provenance.
4. Added mobile English/Spanish intake with center-provided consent text, single-use expiring requests, returned-form review, and explicit chart processing.
5. Added revocable short-lived portal links, secure conversations, explicit document sharing, appointments, education history and points.
6. Added education sessions, capacity and waitlists, attendance completion, idempotent point awards, boutique redemption, staff hours, client letters, and existing operational reporting.
7. Added reviewable identity migration previews, explicit unsupported-field reporting, source IDs, batch checksums, atomic commits, reconciliation, source-identity idempotency, and durable import history.
8. Added reviewed duplicate consolidation with archived source records, compatible record redirects, preserved signed content, and revoked portal access.

## External readiness requirements

A complete CenterPiece replacement is not yet certified. No export sample has been provided. Source-specific relational exports, original audit/signature archives, national reporting contracts, and complete history reconciliation require verified source material. PlusLink access has not been established. Outbound email/SMS providers have not been configured; portal messaging works without external delivery. PowerPoint analytics exports and organization-specific report packs remain on the roadmap.

Clinical templates, consent wording, retention, encrypted backups and key recovery, hosting, access assignments, and operational procedures require center validation before clinical cutover. The readiness API explicitly reports cutover as unapproved. No live migration, outbound message campaign, production deployment, or clinical cutover was performed.

## Local operations

- `pnpm compassion:migrate` applies only the additive Compassion migrations and records their checksums. The command deliberately leaves unrelated pending donor migrations alone. A separate, verified local-only donor tax-schema compatibility repair is documented in the audit evidence.
- `pnpm dev:compassion` starts the independent care API. `pnpm dev:web` starts the existing web application. The shared platform API must also be running for sign-in (`pnpm dev:api` in local development).
- Set `COMPASSION_API_URL` for the Next proxy, `COMPASSION_API_PORT`/`COMPASSION_API_HOST` for the service, and a 64-character hexadecimal `COMPASSION_ENCRYPTION_KEY` for protected storage.
- Preserve the encryption key separately with protected backups. Losing it makes encrypted records unrecoverable. Do not rotate it without a re-encryption procedure.
- The API requires the same platform `JWT_SECRET`; the dedicated screen uses the existing account/MFA/recovery service.
- Initialize an empty care workspace explicitly from its access screen using an active platform administrator, or run `pnpm compassion:grant -- account@example.org ADMIN` locally. Subsequent clinical memberships are managed in Compassion Administration. Platform administrator status alone does not authorize chart endpoints.
- Build the server with `pnpm build:server`; the PM2 configuration includes a separate `oyama-compassion-api` process. Do not restart the donor service as part of deploying this service.

## Recovery and rollback

The original migration was recovered from Git without resetting data. Additive migrations preserve surviving client-care tables and fill compatibility columns. Keep independent database backups before production migration. To roll back application exposure, stop only the Compassion API and restore the previous launcher/proxy configuration; retain tables, encrypted data, and keys. Do not run destructive down migrations or broad database resets.

Validation evidence is recorded in `docs/status/audit-artifacts/2026-10-29-compassion/verification.md`.
