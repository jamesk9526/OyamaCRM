# Events public registration and payment review — 2026-09-22

Traced the published page payload, browser signup and return, API registration transaction, Stripe Checkout creation, signed webhook settlement, and PIN-protected reservation lookup.

## Corrected

- Identical registration retries now reach the existing order even after the ticket sells out. Capacity and inventory remain checked inside the serializable creation transaction.
- Public quantities and seat counts are rejected when outside the ticket limits or the 50-seat registration ceiling. The browser uses the published ticket limits and availability instead of silently changing the requested order.
- Invalid ticket prices fail closed before creating a public order.
- A retry of a settled order no longer creates another Checkout session or overwrites its payment transaction reference. The response reports the order as confirmed.
- Separate successful Stripe events for the same order no longer create repeated payment activity or change the first settled transaction. Webhook event records remain independently processed.
- A saved payment return remains visible when the current public ticket list is sold out.

## Still requires operational work

- Abandoned paid orders hold inventory indefinitely. Define an expiry and release policy, including treatment of delayed Stripe payments, before high-volume limited-capacity sales.
- The initial email describes a paid order as reserved and links to Checkout. The signed webhook updates order and guest status, but does not send a separate paid receipt; registrants can verify payment on the return page or through reservation access.
- The cancellation screen reuses the original Checkout URL. An expired session has no public self-service renewal path; event staff must assist. Refunds and chargebacks are not reconciled into event order and guest payment state by this webhook.
- Complete sandbox and low-dollar live Stripe payment proofs with the deployed webhook and both browser return paths. This review did not conduct provider-account transactions.
- Run database-backed public registration and payment regression tests when the project test executables and MySQL are available in this checkout. The web and API TypeScript checks passed here; Vitest and ESLint executables were unavailable.
