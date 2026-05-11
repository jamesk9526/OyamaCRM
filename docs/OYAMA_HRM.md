# OyamaHRM

Last updated: 2026-05-11

## What OyamaHRM Is

OyamaHRM is the internal people-and-operations workspace for OyamaCRM. It is designed to become the source of truth for staff profiles, board members, departments, locations, schedule availability, and internal communication workflows.

Current module route: `/hrm`

## CRM Switcher Placement

OyamaHRM is available in the top CRM switcher as:

- Name: OyamaHRM
- Label/helper: HRM
- Route: `/hrm`
- Theme: teal-accented shell and sidebar

## Data Ownership

OyamaHRM owns:

- Internal people profiles (staff, employees, board members, internal volunteers)
- Internal role and assignment metadata
- Internal location metadata
- Internal availability/scheduling intent
- Internal communication scaffolding

OyamaHRM does not own:

- Donor records, giving records, or donor financial history
- Compassion client/case sensitive records
- Event attendee records and event revenue source data

## Data Boundary Rules

- Cross-module integrations must use safe IDs/references.
- HRM should provide staff references and schedule availability to other CRMs.
- HRM must not expose donor/client sensitive detail by default.
- HRM must not merge staff records into donor/client records without explicit designed relationships.

## Users And HRM Profiles

Authentication remains in the shared `User` account model.

Target pattern:

- `User` = login/access identity
- `HrmPerson` (planned) = HRM internal profile
- A profile may exist without login
- A user may exist without full HRM profile

## Compassion CRM Integration Direction

Planned integration direction:

- Compassion staff assignment pickers should use active HRM people
- Only HRM profiles marked assignable should be available for new assignments
- Appointment availability should consume HRM schedule inputs

Current status:

- HRM shell and people/scheduling scaffolding is live
- Full backend model integration is not yet complete

## Locations And Communication

Planned HRM location and communication support:

- Location records with timezone and operational status
- Staff assignment by location
- Location-to-location internal messaging
- Announcements and priority notices

Current status:

- UI and route scaffolding is live
- Persistence/API workflows are in active build

## Permissions

Current implementation:

- HRM module is blocked for `report_viewer` role in shell-level guard
- Additional granular permission checks are TODO

Planned permission keys:

- `hrm.view`
- `hrm.people.manage`
- `hrm.schedules.manage`
- `hrm.locations.manage`
- `hrm.messages.manage`
- `hrm.board.manage`
- `hrm.reports.view`
- `hrm.settings.manage`

## Extension Guidance

When extending OyamaHRM:

1. Keep module routes under `/hrm/*`.
2. Preserve strict boundary separation from donor/client/event sensitive records.
3. Reuse shared auth and role infrastructure.
4. Reuse shared task and audit patterns where possible.
5. Mark incomplete areas with explicit in-development messaging.

## Status Snapshot

- Module shell and switcher integration: Working
- Dashboard and starter routes: Working
- People directory scaffold: Partially Working
- Scheduling/availability scaffold: Partially Working
- Internal messaging persistence: Not Implemented
- Cross-module assignment integration: Not Implemented
- Backend HRM data models and migration plan: Not Implemented
