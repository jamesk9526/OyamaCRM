# DonorCRM Site Embeds

DonorCRM Site Embeds provides a secure, tokenized way to install OyamaCRM widgets on external nonprofit websites.

Current working embeddables:
- LiveCom floating messenger
- Campaign Progress Meter
- Donation Widget
- Event Card
- Volunteer Signup
- Newsletter Signup
- Impact Counter
- CTA Block

## Goals

- Give admins a single workspace to generate copy-ready install snippets.
- Keep private CRM credentials off public websites.
- Enforce domain allow-lists per connected website.
- Support future multi-widget architecture through one embed registry.

## Admin UI Location

- Settings route: `/settings/site-embeds`
- Supporting links:
  - Settings sidebar: Site Embeds
  - Settings overview card: Site Embeds
  - LiveCom workspace install action points to Site Embeds manager

## Backend API Surface

Base route:
- `/api/site-embeds`

Public endpoints (no auth; token + domain validated):
- `GET /api/site-embeds/loader.js`
  - Serves runtime loader script for a specific `token`.
- `GET /api/site-embeds/public/ping`
- `POST /api/site-embeds/public/ping`
  - Script health signal for connection diagnostics.
- `POST /api/site-embeds/public/livecom`
  - Accepts public website LiveCom messages and writes Activity records.
- `GET /api/site-embeds/public/livecom-thread`
  - Returns the visitor's current LiveCom thread for the same token, site, conversation, and browser session.
  - Uses no-store cache headers so CRM replies can refresh quickly in the public widget.
- `GET /api/site-embeds/public/widget-data`
  - Returns public-safe payloads for inline embed widgets.
- `POST /api/site-embeds/public/widget-submit`
  - Captures website widget submissions as CRM activity records.

Admin endpoints (require auth + admin role):
- `GET /api/site-embeds/config`
  - Returns site config, registry, selected site snippets.
- `POST /api/site-embeds/sites`
  - Creates additional connected site entries.
- `PUT /api/site-embeds/config`
  - Updates one selected site and widget config.
- `POST /api/site-embeds/regenerate-token`
  - Rotates token for selected site.
- `POST /api/site-embeds/test-connection`
  - Evaluates config and ping health.

## Storage Model

Configuration uses existing plugin JSON storage:
- Prisma model: `PluginSetting`
- `pluginKey`: `site_embeds`
- `config`: `SiteEmbedsConfig` object

This avoids schema churn while allowing future widget expansion.

## Security Model

### 1) Tokenized Public Access

Public scripts and message ingestion use one generated embed token.

- Tokens are generated server-side.
- Token rotation invalidates old installs.
- No private API credentials are exposed in snippets.

### 2) Domain Allow-List

Every public request validates domain origin against the configured site:
- Primary domain
- Allowed domain list
- Wildcard subdomain support (for example `*.example.org`)
- Optional full wildcard support (`*`) for broad external website testing across multiple hosts

If the domain is not allowed:
- Loader returns warning JS with 403
- Ping/livecom endpoints return 403 JSON

Production guidance:
- Prefer explicit domains in production.
- Use `*` only when temporarily testing embed behavior across many external websites.
- Donation forms are stricter: at least one exact domain or scoped wildcard is required, and unrestricted `*` is rejected.
- In Stripe Giving, install the loader and donation block, open the real donation page, then use **Save and verify domain**. A passing result confirms both allow-list access and a recent loader check-in that included the donation widget from that exact hostname.

### 3) Public-Safe Loader Config

`loader.js` receives only public-safe fields:
- site identity
- active widget flags
- display settings needed by runtime UI

Sensitive CRM data is never embedded.

### 4) Audit Logging

Admin mutations and public message ingestion are audit logged.

## LiveCom Ingestion Behavior

`POST /api/site-embeds/public/livecom`:

- Validates token + active site + allowed domain.
- Requires `message`.
- Finds constituent by email when available.
- Creates a `PROSPECT` constituent when no match exists.
- Creates `Activity` row with metadata source `livecom` and channel `WEB_CHAT`.
- Stores `conversationId`, `visitorSessionId`, and public site metadata so CRM replies can flow back to the same widget session.
- Creates staff notifications for new visitor messages.
- Updates script-load status to reflect active public traffic.

CRM staff replies use `/api/livecom/conversations/:id/messages`.

- Public replies are visible to the visitor widget.
- Internal notes stay CRM-only.
- Resolve, archive, and reopen lifecycle events stay CRM-only and are not displayed in the visitor widget.
- The public widget polls the thread every 3 seconds and keeps the current thread visible during reconnects.

## Inline Widget Behavior

`GET /api/site-embeds/public/widget-data` and `POST /api/site-embeds/public/widget-submit` are tokenized and domain-gated.

- Campaign Meter: Returns campaign raised/goal/progress values.
- Donation Widget: Uses Stripe Embedded Checkout. Signed `checkout.session.completed` and recurring `invoice.paid` webhooks create completed CRM Donation records; checkout-start activity alone is never treated as a paid gift.
- Event Card: Displays featured event summary and revenue/guest metrics.
- Volunteer Sign-up: Records volunteer interest into CRM activity logs.
- Newsletter Sign-up: Records newsletter sign-up submissions.
- Impact Counter: Returns public-safe organization impact metrics.
- CTA Block: Renders configurable CTA copy and tracks CTA interactions.

## Setup Workflow (Admin)

1. Open Stripe Giving at `/integrations/stripe` for Stripe connection and donation-form setup. Use Settings > Site Embeds for the wider multi-widget website integration.
2. Select or create website connection.
3. Set primary domain and allowed domains.
4. Configure LiveCom settings (enabled, label, button position, greeting).
5. Enable desired inline widgets (campaign meter, event, volunteer, newsletter, impact, CTA). Configure the donation form in Stripe Giving.
6. Save connection.
7. Copy head or footer snippet.
8. Install snippet on public website.
9. Use Test Connection to validate ping health and config.

For Stripe launch, register the webhook URL shown in Stripe Giving and subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, and `invoice.payment_failed`. The async events prevent delayed payment methods from being recorded before settlement, while recurring failures remain visible to staff without creating a completed CRM gift.

Stripe Giving now includes four install-ready donation-form variants (standard, compact, campaign spotlight, and warm community). The saved form configuration controls the content, permitted preset/custom amounts, min/max safeguards, recurring-gift availability, required donor data, button text, and default presentation. Per-placement `data-oyama-style` and `data-oyama-width` attributes can select a library presentation without weakening the server-side payment rules.

Stripe Giving can also publish a standalone OyamaCRM-hosted URL at `/give/{embedToken}`. This public page requires no website HTML installation and is intended for email buttons, social posts, QR codes, text messages, and nonprofits without direct website editing access. The hosted form uses semantic HTML labels and fieldsets, responsive layouts, the same saved content/payment constraints, Stripe Embedded Checkout, and the same verified webhook-to-CRM ledger pipeline as external embeds. Hosted-only forms may be published without an external domain; external embeds still fail closed unless their exact/scoped-wildcard domain configuration passes.

Stripe Giving stores sandbox/test and live credentials independently, encrypted at rest. Test keys begin with `pk_test_` and `sk_test_`; live keys begin with `pk_live_` and `sk_live_`. Each Stripe webhook destination has its own `whsec_` signing secret, so save both the test and live secrets in their matching credential panels. Switching the active donation environment does not overwrite either set.

The Connection screen can test either saved account independently. Its **Open sandbox form** action creates a real Stripe Embedded Checkout using only the saved test keys. Sandbox preview payments cannot charge real cards and intentionally omit the public site token, so they do not create CRM gifts or alter giving totals. Use the public installed form for the separate end-to-end webhook test that should create a test-mode CRM donation.

## Public Website Install

Use snippets generated by Settings > Site Embeds.

Recommended:
- Place head snippet in global website head template.

Alternative:
- Place footer snippet before `</body>`.

Do not hardcode tokens by hand; always use generated snippets.

## Test Strategy

Minimum checks for rollout:

- Admin config retrieval succeeds for authenticated admin.
- Save updates persist widget/domain config.
- Token regeneration invalidates previous token.
- Loader returns JS for valid token + domain.
- Loader blocks invalid domain.
- Ping endpoint updates connection status.
- LiveCom public ingestion creates Activity (and constituent when needed).

## Troubleshooting

### Loader returns warning script

Likely causes:
- Missing token
- Inactive site connection
- Domain not in allow-list

Fix:
- Verify domain format in Site Embeds manager.
- Ensure site is marked active.
- Reinstall fresh snippet after token rotation.

### Loader placeholder stays empty or URL contains `/api/api/`

The canonical loader URL contains exactly one API segment: `https://crm.example.org/api/site-embeds/loader.js?token=...`. OyamaCRM now normalizes configured values ending in `/api` (including accidental repeated `/api/api`) before generating loader, callback, checkout-return, and Stripe webhook URLs. Re-save the donation form and copy the regenerated loader snippet after upgrading.

Domain matching is intentionally exact. If donors may use both `example.org` and `www.example.org`, add both hostnames to the allow-list. Preview and localhost domains must also be added explicitly for embed testing; the OyamaCRM-hosted `/give/{token}` page does not require an external embed domain.

### Connection test reports stale ping

Likely cause:
- Snippet not installed on active pages
- Browser blocked script request

Fix:
- Confirm snippet is present in rendered HTML.
- Check browser network tab for `loader.js` and `public/ping` calls.

### LiveCom messages not appearing

Likely causes:
- LiveCom widget disabled
- Domain validation failure
- Token mismatch after rotation

Fix:
- Enable LiveCom in settings.
- Re-copy snippet after any token change.
- Confirm website domain matches allow-list.
- Use `/livecom/embed-test` to mount the widget locally with the selected token.
- Open `/livecom/inbox` in a second tab, send a CRM reply, and verify the public widget refreshes without reloading.
- Check that visitor messages and staff replies share the same `conversationId` and `visitorSessionId`.

## Future Architecture Notes

- Embed registry is already in place on backend and admin UI.
- Future widgets should be added to `SITE_EMBED_REGISTRY` and runtime loader branching.
- Keep public runtime tokenized and domain-gated for every new widget.
- Avoid direct CRM data reads in browser runtime without explicit public-safe API contracts.
