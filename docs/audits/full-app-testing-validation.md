# Full App Testing Validation

Date: 2026-05-13

| Command | Result | Status | Notes |
|---|---|---|---|
| `pnpm lint` | Failed (`50 problems: 16 errors, 34 warnings`) | Broken | Pre-existing lint violations remain in untouched areas. |
| `pnpm typecheck` | Passed | Working | Web and server TypeScript checks both exited `0`. |
| `pnpm test:unit` | Passed (`23 files`, `250 tests`) | Working | Core helper/domain unit lanes are green. |
| `pnpm test:api` | Passed (`2 files`, `7 tests`) | Working | Auth + Watchdog API guard coverage passed. |
| `pnpm test:regression` | Passed (`1 file`, `2 tests`) | Working | E2E contract regression assertions passed. |
| `pnpm test:smoke` | Passed (`14 files`, `159 tests`) | Working | Expanded smoke lane passed after Watchdog store-unavailable guard handling. |
| `pnpm test` | Passed (`40 files`, `418 tests`) | Working | Combined suite passed end-to-end. |
| `pnpm test:coverage` | Passed (`40 files`, `418 tests`) | Working | Coverage run exited `0`; overall statement coverage reported `32.85%`. |
| `pnpm test:e2e` | Passed | Working | Executed with live local stack; route sweep completed without failures. |
| `pnpm test:e2e:livecom` | Passed | Working | Executed with live local stack; LiveCom UI smoke completed without failures. |
| `pnpm test:e2e:mobile` | Passed (warn-only report) | Partially Working | Run completed with `0` fails but `75` warn findings across audited mobile routes. |
| `pnpm build` | Passed | Working | `next build` completed successfully and generated all app routes. |

## Notes

This validation file now reflects direct command evidence from the latest rerun pass.

Remaining release blockers from this validation set:

- Lint lane remains Broken.
- Mobile lane is operational but still warns across all audited routes and needs follow-up assertions/remediations.
