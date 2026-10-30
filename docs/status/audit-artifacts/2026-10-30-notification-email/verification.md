# Personal notification email and sign-in verification

- Web and server TypeScript checks passed.
- 46 focused tests passed: notification lifecycle/inbox regression, personal-email worker, and subscription API.
- Targeted ESLint passed for login, settings page, worker, and notification routes.
- Prisma client generation passed; no migration was applied.
- Browser fixtures verified opt-in, custom subject save, confirmation and desktop/mobile overflow with intercepted APIs only. The isolated sign-in fixture verified visible invalid-MFA feedback and responsive layout. Earlier combined runs encountered local dev-server login-loading timeouts; no broad authentication regression sign-off is claimed.
- Delivery uses the existing organization SMTP/provider service. No real email, enrollment, deployment or production data mutation was performed.
- MySQL migration application and real provider delivery remain unverified. Claims are never automatically retried because a network failure can occur after provider acceptance. A SENDING record can therefore mean an interrupted/unknown outcome, not an actively running send. SENT means provider acceptance, not guaranteed inbox placement.
- Email subscriptions apply only to each active administrator's own future notifications. Existing alerts are not backfilled. Subscription history is scoped to the authenticated user's organization. Priority filters are evaluated at scan time; changes may include still-eligible alerts created since enrollment.
- The API process owns the 30-second delivery worker; multiple processes share durable unique claims. No browser is needed for delivery.
