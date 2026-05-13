# OyamaWebMaster CRM Integration

Last updated: 2026-05-13

## Integration Principle

OyamaWebMaster is the publishing layer for CRM-driven web experiences, but module systems remain source-of-truth for business data.

## Module Boundaries

- DonorCRM data ownership stays in donor models and APIs.
- Compassion CRM data ownership stays in client-service models and APIs.
- Events data ownership stays in events models and APIs.
- OyamaWebMaster stores presentation metadata and linked references only.

## Linking Pattern

Site-level fields:

- `connected_module`
- `connected_record_id`

These fields indicate context links, for example:

- campaign website linked to donor campaign ID
- event microsite linked to event ID
- client resource site linked to approved compassion resource collection

## Permissions and Privacy

- Site management actions require authenticated staff role access.
- Data-rich module content should be fetched through module APIs with normal permission checks.
- Sensitive Compassion data must not be embedded in public pages unless explicitly approved and permission-safe.

## Suggested Next Integration Features

1. Module-aware block catalog in builder.
2. Permission-gated preview contexts for module content.
3. Linked-record health check to detect deleted or archived source records.
4. Activity/audit hooks when publishing module-connected sites.

## Current Status

- Module reference metadata on sites: Working
- Lifecycle APIs with audit events: Working
- Module data block embedding pipeline: Not Implemented
- Permission-aware cross-module preview rendering: Not Implemented
