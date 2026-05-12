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
- Internal communication records and workflows

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

Current pattern:

- `User` = login/access identity and role/permission source
- `CompassionStaff` = staff assignment and scheduling profile (with optional linked user)
- HRM people directory = merged `User` + unlinked `CompassionStaff` records
- HRM module settings/location/message entities = `HrmSetting`, `HrmLocation`, `HrmMessage`

## Compassion CRM Integration Direction

Planned integration direction:

- Compassion staff assignment pickers should use active HRM people
- Only HRM profiles marked assignable should be available for new assignments
- Appointment availability should consume HRM schedule inputs

Current status:

- HRM shell plus dashboard/people/scheduling APIs are live
- People and schedule data are sourced from persisted user, staff, meeting, and appointment records

## Locations And Communication

Planned HRM location and communication support:

- Location records with timezone and operational status
- Staff assignment by location
- Location-to-location internal messaging
- Announcements and priority notices

Current status:

- Persisted location CRUD is live through `/api/hrm/locations`
- Persisted internal message workflows are live through `/api/hrm/messages`
- Persisted HRM module policy settings are live through `/api/hrm/settings`

## Permissions

Current implementation:

- HRM module is blocked for `report_viewer` role in shell-level guard
- HRM APIs enforce granular permission keys (`hrm.view`, `hrm.locations.manage`, `hrm.messages.manage`, `hrm.settings.manage`)

Planned permission keys:

- `hrm.view`
- `hrm.people.manage`
- `hrm.schedules.manage`
- `hrm.locations.manage`
- `hrm.messages.manage`
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
- Dashboard and route surfaces: Working
- People directory (live API-backed): Working
- Scheduling and conflict detection (live API-backed): Working
- Location CRUD persistence: Working
- Internal messaging persistence: Working
- HRM settings persistence: Working
- Cross-module assignment integration: Partially Working
- Backend HRM data models and migrations: Working
