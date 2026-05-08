# Compassion CRM — Status

_Last updated: 2025-07-14_

## What Exists

### Shell & Navigation

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Blue sidebar | `app/components/layout/CompassionSidebar.tsx` | ✅ Working | Blue-600 active state, all nav sections |
| Compassion layout | `app/compassion/layout.tsx` | ✅ Working | Auth-gated; uses TopBar + CompassionSidebar |
| AppShell bypass | `app/components/layout/AppShell.tsx` | ✅ Working | `/compassion` in PUBLIC_PATHS; no double shell |
| Module switcher | `app/components/layout/TopBar.tsx` | ✅ Working | Green/blue pill; route switch dropdown |

### Routes

| Route | Status | Notes |
|-------|--------|-------|
| `/compassion/dashboard` | ✅ Working | Static placeholder data; donut charts, schedule, tasks, alerts |
| `/compassion/clients` | 🟡 Placeholder | Shell page only |
| `/compassion/families` | 🟡 Placeholder | Shell page only |
| `/compassion/cases` | 🟡 Placeholder | Shell page only |
| `/compassion/assessments` | 🟡 Placeholder | Shell page only |
| `/compassion/care-plans` | 🟡 Placeholder | Shell page only |
| `/compassion/appointments` | 🟡 Placeholder | Shell page only |
| `/compassion/activities` | 🟡 Placeholder | Shell page only |
| `/compassion/communications` | 🟡 Placeholder | Shell page only |
| `/compassion/tasks` | 🟡 Placeholder | Shell page only |
| `/compassion/follow-ups` | 🟡 Placeholder | Shell page only |
| `/compassion/reports` | 🟡 Placeholder | Shell page only |
| `/compassion/dashboards` | 🟡 Placeholder | Shell page only |
| `/compassion/data-tools` | 🟡 Placeholder | Shell page only; DonorCRM tools not ported |
| `/compassion/settings` | 🟡 Placeholder | Shell page only |

## What Is Missing

| Item | Priority |
|------|----------|
| All Prisma/DB models for Client, Case, Assessment, CarePlan, Appointment | Critical |
| Backend REST API for all Compassion CRM entities | Critical |
| Compassion workspace/permission checks (`TODO` comments in place) | High |
| Client CRUD UI | High |
| Case management UI | High |
| Appointment scheduling | Medium |
| Care plan builder | Medium |
| Compassion-specific reports | Medium |
| Linking donor ↔ client records (shared person layer) | Low |
| Role-based access for Compassion module | High |

## Design Decisions

- Compassion CRM uses **blue-600** (`#2563eb`) as its accent color (vs green-600 for DonorCRM)
- Content area background is `bg-blue-50/30` for subtle visual separation
- Sensitive client data is intentionally siloed from DonorCRM views
- All Compassion routes are under the `/compassion/` prefix for clean separation

## Next Steps

1. Define Prisma schema: `Client`, `Case`, `CaseNote`, `Assessment`, `CarePlan`, `Appointment`
2. Implement REST endpoints: `GET/POST /api/compassion/clients`, etc.
3. Build Clients CRUD page with the same table/form pattern as Constituents
4. Wire the dashboard to live API data
5. Implement workspace permissions (staff should only see their assigned clients)
6. Add `useCompassionPermission()` hook and enforce in the layout
