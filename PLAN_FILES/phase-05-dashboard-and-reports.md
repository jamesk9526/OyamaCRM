# Phase 05 — Dashboard and Reports

## Goal

Provide actionable daily visibility with fast dashboard loading and core fundraising reports.

## Scope

- Dashboard summary endpoint + cache snapshot strategy
- Revenue/retention/new/lapsed/monthly reports
- Campaign and fund rollups
- Export foundation (CSV/PDF placeholders where needed)

## Manageable steps

1. Define dashboard payload contract and widget ownership.
2. Add snapshot table/service for cached dashboard metrics.
3. Trigger refreshes on donation/task/event changes.
4. Implement report endpoints and shared query layer.
5. Build report UI placeholders and result tables.
6. Add export endpoints with role checks.
7. Track freshness metadata (last refreshed + status).

## Exit criteria

- Dashboard loads from one optimized request.
- Core reports are queryable and exportable.
- Data freshness is transparent to staff.

