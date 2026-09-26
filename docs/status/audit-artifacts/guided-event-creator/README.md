# Guided Event Creator verification

The creator supports new Standard/Trivia events and saved unpublished drafts using the existing event, ticket, and page configuration stores. Published events keep their existing editing routes. No schema migration is required.

Verification commands:

```text
pnpm typecheck
node node_modules/vitest/vitest.mjs run tests/api/event-creation.api.test.ts tests/unit/event-creation-readiness.test.ts tests/unit/event-draft-save-queue.test.ts tests/unit/event-page-sections.test.ts tests/unit/event-registry.test.ts
node --import tsx tests/e2e/events-guided-creator.e2e.mjs
```

The browser suite runs the real Next/React interface with isolated network fixtures. It verifies Standard/free and Trivia/paid-table creation; initial event persistence; safe ticket retry after a later payment write fails; page save failure retention, including recovery from a conflicting suggested public address; page and registration preview; disabled preview submission; Escape/focus restoration; explicit publish failure and recovery; mobile draft resume; unsaved navigation warnings; and no page overflow. Screenshots beside this document show desktop details, mobile registration, and registration preview. The global release banner is absent.

API tests exercise the real Events router with isolated persistence/gateway dependencies: organization isolation, actionable readiness, publication rejection, free registration, Stripe setup rejection, non-registration page compatibility, reserved/conflicting addresses, ticket validation, and atomic Standard/Trivia creation. Queue tests exercise debounce flushing, ordered writes, edits arriving during a save, and failed-write retry. Section hydration tests verify custom order/content and disabled sections survive editing.

Live database verification is pending: the Events CRUD smoke suite could not connect to MySQL at `localhost:3306`. Fixture tests do not prove database persistence or actual Stripe/webhook/SMTP delivery. The existing public-mobile and Trivia source-contract suites also contain failing string assertions in code outside this creator change; those failures are not treated as live behavior verification.
