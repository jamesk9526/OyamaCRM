# OYAMADonorPROFILE specification and readiness

Last reviewed: 2026-08-17

Owner: OyamaCRM

Status: Foundation implementation in progress; not production-ready for automated wealth or property research.

## Product definition

OYAMADonorPROFILE is OyamaCRM's proprietary, evidence-first public wealth, philanthropy, and prospect-intelligence subsystem. It aggregates legally usable public information through independent connectors, preserves provenance, resolves identity before combining records, and separates capacity from affinity.

It must never describe an estimate as verified net worth. Approved language includes “Estimated Capacity,” “Public Wealth Indicators,” “Verified Public Assets,” “Estimated Giving Capacity,” “Philanthropic Indicators,” and “Publicly Identified Giving.”

## Non-negotiable safeguards

- [x] FEC contributor information is prohibited for solicitation, prospect ranking, and fundraising enrichment.
- [x] Sensitive-trait collection and inference are prohibited.
- [x] Employment, housing, credit, lending, insurance, benefits, and other eligibility uses are prohibited.
- [x] Identity matching is deterministic and explainable; records below 70 confidence cannot auto-merge.
- [x] Public evidence remains transient until a staff member records match rationale and saves it for review.
- [x] Saved findings retain source URL, source record ID, dates, confidence, reviewer, and verification status.
- [x] Estimates remain distinct from verified public facts.
- [ ] Add constituent-level “Do Not Research” and “Suppress Public Profile” controls before scheduled or bulk research.
- [ ] Add profile deletion, source exclusion, and removal-request workflows before public launch.
- [ ] Add dedicated `steward.profile.*` permissions before bulk research or export.

## Architecture specification

Each source implements the OYAMA provider contract:

- source metadata and declared capabilities;
- `supports(query)`;
- `search(query)`;
- `normalize(response)`;
- evidence provenance;
- source-use, automation, attribution, and terms-review controls.

Capabilities are `IDENTITY`, `PROPERTY`, `BUSINESS`, `SECURITIES`, `FOUNDATION`, `PHILANTHROPY`, `GEOGRAPHY`, `PROFESSIONAL`, and `INTERNAL_RELATIONSHIP`.

Core services:

- Identity Resolver
- Research Query Planner
- Source Registry and Source Request Manager
- Evidence Store
- Property, Business, SEC, Foundation, Philanthropy, and Geographic Intelligence
- Deterministic Capacity Engine
- Separate Affinity and Relationship Strength engines
- Review Queue, Snapshots, Research Jobs, and Audit Log

## Current implementation inventory

| Area | State | Evidence / limitation |
| --- | --- | --- |
| Canonical product workspace | In progress | `/donor-profile` is the new canonical route; `/donor-research` remains a compatibility redirect. |
| First-party provider SDK | Foundation complete | Typed provider, source, capability, and compliance contracts exist in `server/src/services/oyama-donor-profile.ts`. |
| Identity resolver | Foundation complete | Deterministic weighted scoring, confidence bands, explanations, and the 70-point merge floor are unit tested. It is not yet persisted as a profile-match record. |
| Evidence review | Working after existing migration | Existing `DonorResearchFinding` storage provides provenance and human verify/dismiss states. It is an interim table, not the final evidence schema. |
| ProPublica / IRS-linked nonprofit lookup | Working | Organization and foundation lookup only; it is not a nationwide individual donor database. |
| SEC EDGAR connector | Working when configured | Requires `SEC_EDGAR_USER_AGENT`; a filer record alone does not prove a person match or wealth. |
| WealthEngine | Retired from active product | OYAMADonorPROFILE no longer exposes vendor screening as a live source. Historical saved records remain readable. |
| Census geocoder and ACS context | Not started | Must label neighborhood context as non-individual data. |
| Missouri property connectors | Not started | Start with approved county assessor/GIS sources after terms review. |
| Missouri business connector | Not started | Preserve the exact public legal role; registered agent must not be treated as owner. |
| IRS 990-PF foundation index | Partial | Current organization lookup is not yet a person-to-foundation relationship index. |
| Capacity / affinity / Steward Score | Not started | Must be deterministic, componentized, versioned, and independently displayed. |
| Bulk research and scheduled refresh | Blocked | Requires suppression controls, dedicated permissions, queueing, source rate limits, and audit coverage. |

## Delivery stages

### Stage 0 — Product replacement and guardrails

- [x] Establish OYAMADonorPROFILE name and canonical route.
- [x] Remove licensed vendor screening from the active workspace and API provider catalog.
- [x] Preserve existing public-source evidence review and historical records.
- [x] Encode FEC, sensitive-data, and eligibility-use prohibitions in server policy.
- [x] Create this specification/readiness ledger.
- [ ] Complete authenticated desktop/mobile visual regression on the renamed workspace.

Exit criterion: users encounter OYAMADonorPROFILE—not a vendor-led Donor Research screen—and no active control transmits identity to WealthEngine.

### Stage 1 — Evidence-first Missouri MVP

- [x] Provider SDK foundation.
- [x] Explainable identity-score foundation.
- [ ] Final `donor_profiles`, sources, evidence, matches, scores, snapshots, jobs, reviews, and audit schema.
- [ ] Source registry admin UI and source health telemetry.
- [ ] Central request manager with rate limiting, cache, backoff, and request identification.
- [ ] Census geocoder and ACS area context.
- [ ] Missouri Secretary of State connector after legal/terms review.
- [ ] First approved Missouri county property provider.
- [ ] IRS 990-PF person/foundation relationship ingestion.
- [x] SEC entity lookup foundation.
- [ ] Research progress UI and durable research jobs.
- [ ] Manual match confirmation/rejection using numeric identity confidence.
- [ ] Deterministic capacity components with visible reasons and model version.

Exit criterion: one Missouri person can be researched end-to-end with source-dated evidence, reviewable identity matches, suppression, audit history, and no unsupported net-worth claim.

### Stage 2 — Philanthropy and relationship intelligence

- [ ] Approved annual-report/document ingestion for PDF, HTML, CSV, XLSX, XML, JSON, and TXT.
- [ ] Recognition-tier parser that preserves ranges rather than inventing exact gifts.
- [ ] Public Giving Evidence index.
- [ ] Household intelligence with individual provenance.
- [ ] Relationship graph foundation.
- [ ] Separate capacity, affinity, and relationship-strength scores.
- [ ] Prospect lists and opportunity matrix.
- [ ] Scheduled refresh with freshness warnings.
- [ ] Permissioned, rate-limited bulk research.

Exit criterion: public philanthropy and CRM relationship signals can be explored without cross-person attribution or opaque scoring.

### Stage 3 — OYAMA Public Intelligence Index

- [ ] Reusable public-source index for people, properties, businesses, foundations, nonprofits, public gifts, relationships, and evidence.
- [ ] Strict tenant isolation for private CRM data.
- [ ] Provider-response minimization, hashing, expiration, and deletion.
- [ ] Geographic prospect queries operate on the local index, not live source fan-out.
- [ ] Cross-organization reuse policy receives privacy and legal approval.

Exit criterion: approved public evidence is reused safely without becoming an unnecessary warehouse of personal data.

### Stage 4 — OYAMA Network Graph

- [ ] Explainable person/household/business/foundation/property graph.
- [ ] Evidence-backed edges with source, date, and confidence.
- [ ] Shared relationship discovery for authorized staff, board members, volunteers, and donors.
- [ ] Accessible graph and non-graph alternatives.

Exit criterion: every relationship is traceable and ambiguous edges remain reviewable.

## Production-readiness gate

The product is ready for general production use only when every item below is checked:

- [ ] Database migrations are reconciled and applied successfully in production.
- [ ] Dedicated profile permissions are enforced server-side and tested by role.
- [ ] Do Not Research, suppression, deletion, and source exclusion work across manual, scheduled, and bulk paths.
- [ ] Each enabled connector has a recorded terms review, allowed use, automation decision, attribution rule, and rate limit.
- [ ] Provider credentials are server-only and secret rotation is documented.
- [ ] Identity candidates below 70 never merge automatically; all merge/reject actions are audited.
- [ ] Every displayed fact includes source, source date, retrieved date, and confidence.
- [ ] Capacity, affinity, and relationship strength remain separate and explainable.
- [ ] No sensitive-trait, FEC prospecting, eligibility-decision, or private-financial data path exists.
- [ ] Bulk and scheduled jobs honor suppression and source limits.
- [ ] Data retention, removal requests, cache expiration, backups, and tenant isolation pass review.
- [ ] Loading, failure, empty, stale-source, partial-result, and contradiction states are tested.
- [ ] Keyboard, screen-reader, mobile, tablet, desktop, zoom, and overflow checks pass.
- [ ] Focused unit/integration tests, server and web typechecks, lint, and authenticated browser smoke tests pass.

## Immediate next build sequence

1. Reconcile the production Prisma migration history before adding the final profile schema.
2. Add suppression fields and dedicated permissions.
3. Add source registry tables and the centralized request manager.
4. Persist identity candidates and numeric confidence explanations.
5. Implement Census and one terms-approved Missouri property connector.
6. Replace the interim findings view with the evidence-first profile overview and evidence drawer.

