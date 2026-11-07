# Compassion modular workspace and physician review — 2026-11-06

## Accepted direction

Retain Compassion’s light blue appearance and simple task flow. CenterPiece is a workflow reference for client files, case context and grouped forms. The newer request takes precedence: use one right sidebar, with a collapsible current-client section. Unrelated supplied screenshots are excluded.

## Implemented architecture

- Browser-safe contracts define module ids, organization dependencies, role allowances, navigation contributions, client tabs, contextual commands and API prefixes. Add a feature to this registry and mount its feature router; the shell consumes contributions automatically.
- Core stays enabled. Existing features default on. Physician review defaults off. Ultrasounds require Clinical; Physician review requires Ultrasounds. Dependencies describe organization availability; a reviewer does not acquire general Clinical permission through a dependency.
- Module policy is organization-scoped in existing `CompassionConfiguration` rows keyed `module:<id>`. Configuration is reviewed, validated and audited. Module changes revoke physician sessions. Disabling a module preserves its records.
- The independent API retains its URLs. The recovered monolith now mounts seven feature routers: client files, casework, scheduling, staff, reporting, booking settings and dashboard summaries. Shared recovery helpers remain within Compassion.
- API entry points, mutation transactions, public links and aggregate projections enforce module availability. Module role allowances never grant capabilities. Medical intake processing, medical delivered services, protected documents, client surveys and their public links retain their additional boundaries.
- The client header, right rail and form editor share current-client state. Selected case context lives in the URL. Legacy note/service tab links remain supported. Printed paper templates and source PDFs remain independent of application chrome.
- Compassion staff pages use their own provider boundary. Physician pages initialize no platform authentication, donor shell, plugin, AI or offline provider. The service worker bypasses Compassion routes.

## Physician workflow and contracts

- `/compassion/physician/login` authenticates a dedicated `compassion_user` identity with `ULTRASOUND_REVIEWER` membership. The role has no ordinary care capabilities. Existing full-access PHYSICIAN accounts retain their staff workflow.
- `/api/compassion/physician-review` accepts its own opaque, hashed, revocable session cookie. It does not accept a general bearer token as physician authentication or issue platform access/refresh tokens. Normal account login and refresh reject reviewer memberships.
- Password plus TOTP is mandatory. Secrets are AES-GCM protected with organization/user/purpose binding. Codes are replay-protected. Challenges expire after five minutes and five failed attempts; account/IP throttles bound repeated authentication. Recovery codes are stored as hashes and reset enrollment without opening a medical session.
- Sessions have a 15-minute inactivity timeout, eight-hour absolute limit, CSRF protection and account/membership version checks. Signing after five minutes requires fresh TOTP. Five failed step-up attempts revoke the session. Production authentication requires HTTPS through the trusted loopback proxy.
- The pending queue includes submitted ultrasounds in the organization. Completed reviews include the physician’s own signatures and correction requests. Correction history does not open the author's draft. Unrelated charts, unrelated files, other organizations and general CRM tools remain unavailable. A linked earlier signed version supports amendment review.
- Shared clinical review services implement return-to-author and signing. Ultrasound updates, submission and review require the current `expectedUpdatedAt`; the reviewer signature also requires the reviewed attachment manifest. Clinical writes share the organization transaction lock. Signatures preserve patient and signer identity, chart version, attachment hashes, timestamp and digest. Existing signed snapshots are not rewritten.
- Protected previews verify file checksums. Signed examinations verify their signature evidence. Access, signatures, corrections, authentication, enrollment, recovery and policy changes are audited without logging findings, passwords or TOTP secrets.

## Installation and rollout

1. Back up the database and protected storage; preserve and separately protect the existing encryption key. Verify the backup restoration and key recovery procedure in an isolated environment.
2. Install locked dependencies, then run `pnpm exec prisma validate`, `pnpm exec prisma generate` and `pnpm compassion:migrate`. The added migration is `20261106200000_compassion_modules_physician_review`; the migration runner remains limited to additive Compassion migrations.
3. Build web and API with `pnpm build` and `pnpm build:server`. Deploy web and the independent care API together. Preserve prior encrypted records and keys; do not reset the database.
4. Keep the API bound to loopback behind the HTTPS web proxy. Sanitize forwarded headers at the public proxy. Test secure cookies, CSRF, revocation and timeout behavior through that actual proxy.
5. In Compassion Settings → Modules, enable Physician review with its dependencies and the reviewer role. In Settings → Physician reviewers, verify the physician’s identity/professional credentials and provision a dedicated account. Share its initial credentials using the center’s secure process. The physician enrolls an authenticator and stores recovery codes before medical access.
6. Complete the center’s clinical, privacy/security and operating review before live medical use. This change does not authorize production deployment or clinical cutover by itself.

## HIPAA baseline and remaining release gates

The software supports access control, authentication, audit, integrity and transmission safeguards described by [HHS](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html). Authenticator handling follows the relevant [NIST guidance](https://pages.nist.gov/800-63-4/sp800-63b.html); OTP is not phishing-resistant authentication. This is not a HIPAA certification or an assertion that the entire deployment complies.

The center must document its risk assessment, applicability and state requirements, professional credential checks, access reviews, retention, incident procedures, staff training, encrypted backups, key recovery, and hosting/vendor arrangements, including [BAAs where applicable](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html).

Local MySQL is unavailable and Docker has no running engine. Migration application, actual database transaction/concurrency behavior, restart persistence and backup restoration remain unverified release gates. Synthetic HTTP tests prove application contracts against fixture persistence only. Evidence and exact checks are recorded in the dated audit directory.
