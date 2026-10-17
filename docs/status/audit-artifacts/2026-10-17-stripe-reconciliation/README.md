# Stripe reconciliation verification — October 17, 2026

The live event ledger showed eight pending ONLINE orders totaling $1,200; its guest list showed 51 guests marked due. No production records were changed. The local database was unavailable.

The implementation adds order-backed guest payment status and a permissioned per-order Stripe verification action. Verification uses the persisted checkout session and account credentials; validates order/org metadata, amount, currency and environment; rejects incomplete, refunded, or unverifiable payments; and conditionally updates the order, linked guests, and activity in one database transaction.

- Focused mocked service/API tests verify stale flags, exemptions, unpaid checkout, mismatches, refunds, retries, org ownership, and concurrent changes.
- `E2E_BROWSER_CHANNEL=msedge node tests/e2e/event-stripe-reconciliation-fixture.e2e.mjs` passed: unpaid response, network error/retry, verified paid refresh, no page errors, desktop and 390px layout.
- Local browser fixture uses deterministic data and does not contact Stripe or the production database.
- Remaining: deploy, verify live Stripe credentials/webhook delivery, then check each pending order. Orders without persisted checkout IDs require manual investigation; historical currency mismatches require review.

[Desktop](payments-desktop.png) · [Mobile](payments-mobile.png)
