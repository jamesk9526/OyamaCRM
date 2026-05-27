# Merge Fields

Last updated: May 27, 2026

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

## Partial

Conditional blocks and repeated sections are not implemented in the server merge renderer yet:

```txt
{{#if constituent.hasEmail}}...{{/if}}
{{#each donations}}...{{/each}}
```

Templates should avoid these constructs until the renderer supports them.
