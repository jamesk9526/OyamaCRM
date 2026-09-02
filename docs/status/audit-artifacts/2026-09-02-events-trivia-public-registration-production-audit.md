# Events, Trivia, and Public Registration Production Audit — 2026-09-02

## Release position

The code path for free, offline-follow-up, and Stripe-hosted Event registration is ready for staging rollout. Public Trivia registration now uses the same relational Event Studio transaction. Production activation still requires the environment gates listed below; this audit does not claim that live Stripe credentials, the production webhook, staging migrations, or physical event-night devices were exercised from this workstation.

## Production risks closed

| Risk | Resolution | Evidence |
|---|---|---|
| Browser/network retry created duplicate orders, guests, seats, and emails | Public registration requires an idempotency key. A deterministic unique order number and normalized request fingerprint make identical retries return the existing order; changed payloads with the same key fail with `IDEMPOTENCY_KEY_REUSED`. Replays reuse Stripe's idempotent checkout and skip duplicate email. | `server/src/routes/events.ts`, `PublicEventRegistrationForm.tsx`, `tests/smoke/events-crud.test.ts` |
| Legacy Trivia signup could oversell or lose a team through non-atomic state writes | Linked legacy pages redirect to the published Event Studio page. Unlinked legacy pages fail closed with `TRIVIA_REGISTRATION_MIGRATION_REQUIRED`; the unsafe write path was removed. | `server/src/routes/trivia.ts`, `TriviaPublicRegistrationPage.tsx`, `trivia-event-night-source.test.ts` |
| Closed/cancelled/draft events could still accept a published-page registration | The server accepts registrations only while the Event is `PUBLISHED` or `REGISTRATION_OPEN`, in addition to checking active/public state and deadline. | `server/src/routes/events.ts` |
| Sold-out options looked selectable | Zero-availability tickets are visibly marked sold out and disabled; an all-unavailable state gives organizer guidance. The server remains authoritative. | `PublicEventRegistrationForm.tsx` |
| Registration failures lacked a support correlation | Registration responses carry `x-request-id`; persistence and Stripe failures log the same reference, and the browser includes it in actionable errors. The proxy preserves request, retry, and correlation headers. | Event registration API route and proxy |
| Next-origin proxy collapsed production rate limiting onto the proxy address | The production proxy forwards the platform-provided client address to the explicitly hop-limited API proxy configuration. Development avoids forwarding to prevent false proxy-validation warnings. | `app/api/events/public/page/[pageSlug]/register/route.ts`, `server/src/index.ts` |

## Verified gates

- Prisma client generation: passed.
- Web and server TypeScript: passed.
- ESLint: passed with zero errors (111 pre-existing warnings; no warnings introduced by this pass remain).
- Focused Event/Trivia/public registration/Stripe/TableLink/isolation regression: 97/97 passed.
- Database-backed Events CRUD and retry replay coverage: passed.
- Production Next.js build: passed; 188 static pages generated and dynamic Event/Trivia routes compiled.
- Browser public page registration E2E: passed at 1366×900, including publish, load, consent, submit, receipt, and overflow check.

## Required environment gates before public launch

1. Apply the checked-in Prisma migrations to staging and verify legacy Trivia import counts before production migration.
2. Configure Test and Live Stripe keys and webhook secrets; complete one sandbox proof and one low-dollar live proof, confirming exact-amount settlement and duplicate webhook handling.
3. Run two-browser event-night concurrency rehearsal across builder, host, scorekeeper, check-in, projector, recovery, and reconnect behavior.
4. Run physical-device and accessibility QA at phone/tablet/desktop, 200% zoom, keyboard-only registration, projector output, and degraded network conditions.
5. Set and verify `TRUST_PROXY_HOPS` against the real production proxy chain; confirm per-client rate-limit behavior from two external networks.
6. Define the operational policy for abandoned paid reservations (manual follow-up/cancellation today). Automated Stripe-session expiry and inventory release remain a follow-up before high-volume limited-capacity sales.

