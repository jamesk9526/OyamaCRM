# Phase 03 — Donations, Funds, Campaigns

## Goal

Make gift entry and attribution trustworthy, fast, and report-ready.

## Scope

- Donations CRUD and donor attribution
- Funds/designations, campaigns, appeals
- Recurring gifts and pledge linkage baseline
- Donation-side timeline events

## Manageable steps

1. Finalize donation field contract and validation rules.
2. Complete donation list/new/edit/detail flows.
3. Implement funds/designations CRUD and selectors.
4. Implement campaign and appeal relationships.
5. Add recurring donation flags and schedule metadata.
6. Add pledge-reference support where applicable.
7. Ensure donation writes trigger summary/timeline hooks.

## Exit criteria

- Staff can enter and find gifts with full attribution.
- Campaign/fund reporting dimensions are stored correctly.
- Recurring and pledge-linked cases are modeled safely.

## Audit snapshot — 2026-05-08

- [x] Donation CRUD is working — verified in `app/donations/*` and `server/src/routes/donations.ts`.
- [x] Campaign CRUD is working — verified in `app/campaigns/page.tsx` and `server/src/routes/campaigns.ts`.
- [x] Designation support exists in schema, forms, and API — `prisma/schema.prisma`, `server/src/routes/designations.ts`.
- [~] Pledge data model exists, but no usable pledge management workflow was found.
- [ ] Receipt generation, refunds/chargebacks, in-kind workflows, and soft credits are not started in usable code.
