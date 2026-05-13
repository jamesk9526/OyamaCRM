# OyamaWebMaster Site Types

Last updated: 2026-05-13

## Purpose

Define canonical site types used by OyamaWebMaster for organization, filtering, and CRM-aware publishing workflows.

## Canonical Site Types

| Site Type | Description | Typical Owner | Typical Lifecycle |
|---|---|---|---|
| `MAIN_SITE` | Primary organization website | Marketing/admin | Long-lived |
| `LANDING_SITE` | Single-goal campaign page set | Fundraising/comms | Medium-lived |
| `TEMPORARY_SITE` | Seasonal or one-off microsite | Program staff | Time-boxed |
| `EVENT_SITE` | Event-specific public pages | Events team | Event lifecycle |
| `DONATION_SITE` | Giving-focused flow pages | Development team | Long-lived |
| `CAMPAIGN_SITE` | Multi-page campaign presence | Development/comms | Campaign lifecycle |
| `PARTNER_PORTAL` | External partner access site | Partnerships | Long-lived |
| `CLIENT_RESOURCE_SITE` | Public resource pages for client services | Compassion team | Long-lived |
| `INTERNAL_SITE` | Staff-only documentation/extranet site | Operations/IT | Long-lived |
| `MICROSITE` | Lightweight branded mini-site | Marketing/comms | Medium-lived |
| `BLOG_SITE` | Content publishing and archives | Communications | Long-lived |

## Connected Module Mapping

`connected_module` values:

- `donor`
- `events`
- `compassion`
- `communications`
- `webmaster`
- `platform`

Use `connected_record_id` to hold a non-owning reference key to the module entity (for example campaign ID or event ID).

## Site Status Model

Site status uses:

- `DRAFT`
- `ACTIVE`
- `ARCHIVED`

Launch status uses:

- `NOT_READY`
- `REVIEW_READY`
- `READY_TO_LAUNCH`
- `LIVE`

These two statuses are intentionally separate:

- `site_status` controls lifecycle and visibility.
- `launch_status` expresses readiness quality.

## Operations Policy

- Duplicate creates a draft clone and never mutates source records.
- Archive is soft and reversible.
- Restore returns archived sites to drafting workflows.
- Site type should be set at creation and changed only by intentional admin action.
