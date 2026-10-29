# Donor controls and settings review — October 29, 2026

The donor desktop header now exposes the shared calendar/fiscal reporting period directly. Its account dialog contains profile, appearance, Settings, Help, support, and sign-out; it no longer repeats the administrative navigation or reporting control. Mobile retains its existing Workspace tools period control. Both surfaces use the same stored reporting-year mode.

The donor navigation keeps one Settings destination and one Data Tools destination. Notification access remains in the header; imports remain in Data Tools. Custom field configuration lives at `/settings/custom-fields`, with a compatible redirect from `/custom-fields`. The legacy routes for all other tools remain intact.

Relocating Custom Fields revealed a real display defect: `apiFetch` already unwraps `{data: fields}`, but the manager unwrapped it a second time and rendered an empty list. The manager now renders the returned array, reports loading failures with Retry, and surfaces field activation/deletion errors. Busy activation controls prevent repeated submissions. On mobile, entity tabs and the full field table scroll within their containers so actions remain reachable.

## Verification

- `pnpm exec vitest run tests/unit/crm-sidebar-navigation.test.ts tests/unit/navigation-boundaries.test.ts`: 21 tests passed.
- Targeted ESLint for donor account/navigation, topbar, settings sidebar/routes, and CustomFieldsManager: passed.
- `QA_BASE_URL=http://localhost:3652 node tests/e2e/donor-navigation-canonical.e2e.mjs`: seven real-browser checks passed with zero runtime errors and zero data writes. Synthetic responses tested nonempty fields, unavailable/retry behavior, direct period switching, account-dialog Escape/focus restoration, route compatibility, and 390px mobile navigation/table action access.
- The nonempty-field assertion was first run against the previous manager behavior and failed; it passed after fixing the response handling.
- `git diff --check` on changed controls/settings files: passed.

Browser verification used an isolated local development server on port 3652. The existing port 3651 serves an earlier production build and was not restarted. No production deployment, data migration, provider delivery, or persistent donor write occurred. Shared project typecheck/build is coordinated by the parent donor task.
