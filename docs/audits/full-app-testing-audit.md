# Full App Testing Audit

Date: 2026-05-13

Canonical detailed audit: `docs/testing/full-app-test-audit.md`.

## Summary

- Existing baseline: strong Vitest smoke/unit foundation, weaker E2E reliability contract.
- Main reliability defects addressed in this pass:
  - E2E web base mismatch (3650 -> 3000 default)
  - Mobile auth endpoint mismatch (now API-base auth)
  - Missing dedicated lane scripts (`test:unit`, `test:api`, `test:regression`, `test:ci`)
- New artifacts added:
  - Shared auth helpers
  - Fixture set for importer and Watchdog
  - New API and regression test files
  - New E2E auth/routes/watchdog scripts

## Current Audit Result

Overall automated testing status: Partially Working

Reason:

- Core lanes now have clearer separation and stronger baseline coverage.
- Full cross-module E2E and mobile workflow depth is still incomplete.
- Existing repository lint errors remain a blocking release signal until resolved.
