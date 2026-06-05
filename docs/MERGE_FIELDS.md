# Merge Fields

Last updated: June 5, 2026

## Engine

Server source: `server/src/services/letters-merge.ts`

Core functions:

- `collectMergeFieldKeys(...)`
- `unsupportedMergeFieldKeys(keys)`
- `renderMergeFields(template, values, options)`
- `resolveLetterMergeContext(...)` in `server/src/services/letters-execution.ts`

## Supported Field Families

- `{{constituent.firstName}}`, `{{constituent.lastName}}`, `{{constituent.fullName}}`, `{{constituent.email}}`, `{{constituent.phone}}`, `{{constituent.addressBlock}}`
- `{{donor.firstName}}`, `{{donor.lastName}}`, `{{donor.fullName}}`, `{{donor.email}}`, `{{donor.addressBlock}}`
- `{{constituent.displayName}}`, `{{constituent.organizationName}}`, `{{constituent.entityKind}}`, `{{constituent.organizationCategory}}`
- `{{constituent.contactFirstName}}`, `{{constituent.contactLastName}}`, `{{constituent.contactFullName}}`, `{{constituent.contactTitle}}`
- `{{donor.displayName}}`, `{{donor.organizationName}}`, `{{donor.entityKind}}`, `{{donor.organizationCategory}}`
- `{{donor.contactFirstName}}`, `{{donor.contactLastName}}`, `{{donor.contactFullName}}`, `{{donor.contactTitle}}`
- `{{donation.amount}}`, `{{donation.date}}`, `{{donation.designation}}`, `{{donation.receiptNumber}}`
- `{{gift.amount}}`, `{{gift.date}}`, `{{gift.fund}}`, `{{gift.campaign}}`
- `{{year.totalGiving}}`, `{{year.firstGiftDate}}`, `{{year.lastGiftDate}}`, `{{year.numberOfGifts}}`
- `{{campaign.name}}`, `{{event.name}}`, `{{household.name}}`
- `{{organization.name}}`, `{{organization.email}}`
- `{{staff.fullName}}`, `{{staff.title}}`, `{{staff.email}}`

## Filters

Implemented:

- `{{constituent.firstName | fallback:"Friend"}}`
- `{{donation.amount | currency}}`
- `{{donation.date | date:"MM/dd/yyyy"}}`

Missing supported fields are highlighted as:

`Missing: {{field.name}}`

Unsupported fields remain visible as `{{custom.field}}`.

## Compatibility Rules

- Existing templates that use `{{donor.firstName}}` or `{{constituent.firstName}}` continue to work for organizations by returning the organization display name.
- For organizations, `{{donor.fullName}}` and `{{constituent.fullName}}` return organization display name, while last-name fields resolve to blank.
- `{{donor.salutation}}` and `{{constituent.salutation}}` use `Dear {displayName},` for organizations and keep person behavior for individuals.

## Partial

Conditional blocks and repeated sections are not implemented in the server merge renderer yet:

```txt
{{#if constituent.hasEmail}}...{{/if}}
{{#each donations}}...{{/each}}
```

Templates should avoid these constructs until the renderer supports them.
