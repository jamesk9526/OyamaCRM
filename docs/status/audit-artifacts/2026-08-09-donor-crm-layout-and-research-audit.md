# Donor CRM layout and individual/public-research audit — 2026-08-09

## Outcome

The Donor CRM now has a distinct `/donor-research` workspace for reviewable public and licensed external evidence. It is intentionally separate from Steward Signals: Steward analyzes internal CRM patterns, while Donor Research records externally sourced facts or labeled vendor estimates with provenance, match confidence, and a staff verification state.

The same pass corrected the highest-impact responsive and navigation issues found in the mounted constituent and report workflows:

- phone and tablet constituent cards retain selection and research actions;
- the dense desktop constituent table no longer replaces cards until the large breakpoint;
- constituent directory errors show the actual server/permission message instead of always claiming the API is offline;
- Add Constituent, Import, and Donor Research are visible together at the directory entry point;
- Reports moved out of System navigation and into the primary Overview group;
- the new top-level route is reserved from public event-slug handling, so it inherits Donor CRM authentication and shell navigation;
- the report library has live search, a readable 2/3/4-column layout, and non-hover-dependent run actions;
- generic report output switches to labeled record cards below the large breakpoint instead of forcing a wide spreadsheet onto phones and tablets.

## Individual and public-source research

| Source | Current decision | Useful disclosed data | Constraint |
|---|---|---|---|
| [ProPublica Nonprofit Explorer API v2](https://projects.propublica.org/nonprofits/api/) | Implemented | IRS-linked nonprofit/foundation identity, EIN, location, filing facts, reported revenue/assets when present | Entity research only; API is described as a work in progress and is not individual net-worth data. |
| [SEC EDGAR data APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | Implemented when `SEC_EDGAR_USER_AGENT` is configured | Filer identity, CIK, ticker/exchange, industry, and filing history | CIK lookup does not prove that the filer is the constituent or disclose a person's total wealth. SEC requires compliant automated access. |
| [IRS TEOS and bulk downloads](https://www.irs.gov/charities-non-profits/tax-exempt-organization-search-bulk-data-downloads) | Next bulk-data option | Monthly organization-status datasets and public 990-series filings | Large XML/delimited datasets need a scheduled indexed import, freshness tracking, and operational storage planning. |
| [WealthEngine API documentation](https://apidocs.wealthengine.com/documentation.html) and [address-lookup example](https://apidocs.wealthengine.com/example.html) | Implemented when licensed/configured | Individual name/address or email matching plus vendor-estimated net-worth and gift-capacity bands when returned | Requires `WEALTHENGINE_API_KEY`, permitted-use/vendor review, and a production endpoint setting. Sandbox data is synthetic and cannot be saved. Bands are labeled estimates, not verified assets or ask recommendations. |
| [DonorSearch wealth and philanthropic screening](https://www.donorsearch.net/wealth-and-philanthropic-screening/) | Evaluated alternative; not integrated | Individual real estate, business/stock affiliation, political-contribution, charitable-giving, and affinity indicators | Commercial terms and an approved API/data-access design are required before an adapter can be represented as available. |

Political-contribution enrichment, people-search scraping, county-assessor scraping, and unlicensed data-broker imports are excluded from the default product path. Public availability does not make an attribute necessary, correctly matched, or appropriate for automated prioritization.

## Implemented safety boundary

1. A user explicitly selects one existing constituent.
2. A source lookup is run on demand; raw provider payloads and unmatched result lists are not persisted. Licensed individual screening additionally requires constituent edit permission and an explicit authorization confirmation before identity leaves Oyama.
3. A candidate result opens a match-review form at low confidence.
4. The user records a specific match rationale and saves the result as `UNVERIFIED`.
5. A user with constituent edit permission verifies or dismisses the finding; both decisions remain in the durable record and audit log.
6. Disclosed amounts retain source labels such as “Reported nonprofit total assets.” Licensed net-worth/gift-capacity bands remain labeled vendor estimates and are never copied into a verified-asset field or used to recommend an ask.
7. WealthEngine sandbox responses are labeled synthetic and cannot be saved. Production responses receive a short-lived signed evidence token bound to the organization and constituent, preventing browser edits or cross-record attachment before save.

This follows the FTC's data-minimization guidance to keep only information needed for a legitimate purpose, limit access, and avoid indefinite collection: [Protecting Personal Information: A Guide for Business](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business).

## Data and API design

- `DonorResearchFinding` stores organization and constituent scope, provider, record identifier, HTTPS source URL, signal type, disclosed amount/label, publication date, match rationale/confidence, review status, creator/reviewer, and timestamps.
- `GET /api/donor-research/providers` reports provider readiness and limitations.
- `POST /api/donor-research/lookup` performs transient, server-side normalized lookups.
- `POST /api/donor-research/lookup-person` screens one server-loaded CRM individual through configured WealthEngine name/address or email matching.
- `GET/POST /api/donor-research/findings` reads or creates organization-scoped evidence.
- `PATCH /api/donor-research/findings/:id` verifies, dismisses, or returns a finding to unverified.
- Public lookup requires `view:constituents`; individual screening and durable create/review require `edit:constituents`.
- Provider-specific source-domain validation prevents a client from claiming arbitrary URLs are ProPublica, SEC, or WealthEngine evidence. Licensed results also require a valid, unexpired, constituent-bound server signature.

## Remaining release work

- Reconcile the local migration-history drift first: the current database records `20260509110045_add_compassion_crm_models`, but that migration directory is missing from this checkout. After restoring/reconciling that migration safely, apply `20260809143000_add_donor_research_findings`.
- Configure `SEC_EDGAR_USER_AGENT` with the application name and a monitored organization contact email before enabling SEC lookup.
- Complete the WealthEngine contract/permitted-use review, configure `WEALTHENGINE_API_KEY`, and change `WEALTHENGINE_API_BASE_URL` from sandbox to `https://api.wealthengine.com` before production individual screening. Never use sandbox samples as donor facts.
- Complete privacy/legal review for the operating jurisdiction, publish an internal research/retention policy, and define who may verify findings.
- Complete the remaining authenticated phone/tablet donor-directory and report-result matrix with real data. The Donor Research workspace itself passed 1440px and 390px browser checks with no horizontal overflow, and the browser check also caught and closed its initial public-route classification gap.
- If another commercial provider is selected later, build it behind the same normalized, review-first contract; never map opaque scores directly to outreach automation.

## Validation evidence

- Web and server TypeScript checks passed.
- Focused ESLint passed with zero warnings or errors.
- The original 134 focused donor identity, reporting, visual-source, public-research, and database-backed report smoke tests passed. The WealthEngine follow-up then passed 10/10 focused adapter and product-wiring tests. The report suite required its normal 30-second server-startup hook allowance.
- Prisma schema validation and client generation passed.
- The production Next.js build passed and generated 186 routes, including `/donor-research`.
- Browser checks confirmed the Donor Research page at 1440×900 and 390×844 without horizontal overflow, then confirmed the unauthenticated route redirects to `/login` after its reserved-route fix.
