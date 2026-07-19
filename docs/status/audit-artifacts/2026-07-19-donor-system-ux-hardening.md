# Donor System UX Hardening Evidence — 2026-07-19

## Scope

- Donor dashboard workload truthfulness and navigation
- Donation acknowledgment queue filtering and UX
- OyamaLetters search and recipient-accurate print preview
- OyamaEmail rich-text, CTA, and Smart HTML link editing
- Focused gap and regression review across donor communications

## Corrected gaps

1. The dashboard previously counted unacknowledged gifts from only the 20 most recent completed donations. It now requests the server-filtered total and routes staff into that exact queue.
2. Existing dashboard links used `?acknowledgment=pending`, but the donation ledger and API ignored that parameter. Both list and stats queries now apply the filter, and the UI exposes the active scope and a clear action.
3. The Letter print route could silently substitute the most recently updated eligible constituent for the test constituent selected in the builder. The selected constituent now travels through the print URL and is validated inside the organization before merge rendering.
4. Letter Find and three OyamaEmail link workflows used blocking browser prompts/alerts. They now use keyboard-accessible in-app controls with inline feedback and safe-URL validation.
5. A source smoke assertion referenced retired repository-instruction headings. The test now verifies the current real-data and working-action governance language.

## Validation evidence

- `pnpm typecheck` — passed (web and server)
- Focused unit/source Vitest lane — 84/84 passed
- Database-backed donor, Letters, and Email API/source lane — 60/60 passed
- Targeted ESLint — 0 errors; 23 existing warnings in the large Letters/Email workspace files
- `pnpm build` — passed; production compilation, TypeScript, and generation of 198 routes completed
- Local Laragon MySQL was started to run the persistence-backed API verification.

## Remaining release boundaries

- Module-wide workspace permission enforcement remains incomplete and is still a production release blocker in the canonical checklist.
- Exact mixed inline typography parity in server-rendered Letter PDFs remains partial.
- Automated inbox screenshot coverage across major Gmail/Outlook clients remains an operational QA dependency.
