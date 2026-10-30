# Admin community and professional profiles

- Web and server type checks passed.
- 56 focused API/unit tests passed, including community, profiles and notification-email regression checks.
- Targeted ESLint passed without warnings.
- Community API tests cover organization isolation, active admin checks, pagination/input bounds, own-content edits/removal, optimistic editing, duplicate request handling, reply notification targeting, deleted-thread locks, reaction desired-state semantics, and schema drift errors.
- Profile API tests cover scoped identity, non-authorization field updates and profile input validation.
- Synthetic browser checks passed: publish update, like, reply, directory, save professional profile, desktop (1440px) and mobile (390px) horizontal overflow. Screenshots accompany this file. Browser APIs were intercepted; no live writes or sends occurred.
- Prisma schema validation/client generation passed. MySQL migration application, real database transaction/concurrency behavior and live notification email delivery remain unverified.
- Migration: `20261031010000_admin_community`; apply prerequisite pending migrations through the normal deployment process. No migration, deployment, live enrollment or outbound communication was performed here.
- Content is plain text rendered through React. Directory returns explicit profile fields, not credentials or account activity. External profile photos must use HTTPS and are loaded without a referrer; initials are the fallback.
- Initial feature scope: shared admin feed, one-level reply threads, likes, own-content management and directory. No attachments, private messages, mentions, moderation console or live feed streaming. Use Refresh feed for new posts. Soft-deleted content remains in the database but is excluded from the community APIs.
