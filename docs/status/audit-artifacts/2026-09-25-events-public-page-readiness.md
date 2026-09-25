# Event public page readiness review — 2026-09-25

## Traced paths

- Event page builder configuration, published slug lookup, public payload, registration, payment handoff, and mobile registration action.
- TableLink host sign-in/roster and guest invite completion pages.
- Trivia public registration route and its EventSTUDIO redirect behavior.

## Changes

- Public slug lookup now requires an active, public event. Publishing a page for a private or inactive event is rejected with a clear error.
- The public renderer calculates the full countdown from the event start, uses actual registration and revenue goals, excludes sold-out tickets from advertised starting prices, and hides the mobile registration action when signup is closed.
- Optional sections without actual copy, data, media, or a working destination are not rendered to visitors. Builder previews retain guidance so staff can finish them. Donation and appeal blocks no longer show fixed dollar choices that did not start a donation; document links no longer point back to the event page. The builder now exposes the missing action URL controls.
- Public event links and media reject unsafe URL schemes in the renderer. Published event content renders on the server before hydration and receives event-specific title, description, and sharing metadata. The application-wide `robots.txt` disallows crawler indexing; this pass preserves that policy.
- Public registration states explain closed deadlines, cancelled events, and unavailable tickets. Public TableLink access now sends the short-lived token to the matched host email, returns a generic response, and limits request attempts; it no longer grants access to someone who merely knows the host email and table key. TableLink host and invite forms use visible labels and larger controls; successful guest invite submission remains confirmed even if a subsequent refresh is unavailable.

## Validation and open gates

- Passed: `pnpm typecheck:web`, `pnpm typecheck:server`, `pnpm build`, `git diff --check`.
- Could not run: focused Vitest and ESLint because their executables are missing from this checkout.
- Still needed before a production payment launch: database-backed public registration/TableLink/Trivia tests (the local MySQL port `localhost:3306` did not accept connections), a deployed HTTPS origin configured through `NEXT_PUBLIC_APP_URL` or `FRONTEND_ORIGIN`, a real TableLink SMTP delivery and link proof, sandbox and live Stripe checkout plus signed webhook and browser return proofs, and the inventory expiry and refund handling noted in the earlier [payment review](2026-09-22-events-public-registration-payment-review.md). This pass did not send email or make provider-account transactions.
