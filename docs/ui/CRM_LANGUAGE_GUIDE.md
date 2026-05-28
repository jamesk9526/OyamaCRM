# CRM Language Guide

Last updated: 2026-05-14

This guide defines preferred staff-facing language for OyamaCRM.
Use it as a default for product copy, not as a hard ban on technical or internal documentation wording.

## Style Principles

- Prefer plain language over technical language.
- Name the user action clearly.
- Explain outcomes and risk level in short sentences.
- Use nonprofit domain terms consistently.
- Avoid internal engineering terms in UI copy.

## Preferred Terms

| Concept | Preferred term | Avoid in staff UI | Notes |
|---|---|---|---|
| Donor person record | Donor (or Constituent where mixed audience is required) | Entity, contact object | Use Donor in donor-first pages; use Constituent when volunteers/members are included. |
| Client record | Client | Case entity, record object | Compassion module should remain client-first language. |
| Task planning item | Task | Work item (unless in technical admin docs) | A task is planned work. |
| Completed interaction | Activity | Event log line, action artifact | An activity is something that already happened. |
| Outbound message | Communication | Message payload | Use communication for cross-channel context. |
| Fundraising initiative | Campaign | Pipeline object, deal stage | Campaign language should remain fundraising-specific. |
| Printable outreach | Letter | Generated artifact | Use letter/printable in donor communication flows. |
| Alert for user action | Notification | Signal event | Notification text should include who/what/when. |
| AI assistant output | Suggestion or Draft | Artifact, model output | Keep human review language explicit. |
| Multi-step automation | Steward Path | Automation entity | Keep stewardship intent visible. |
| Analytical output | Report | Data extract, query output | Use report in user-facing screens. |
| CSV ingest | Import | Payload ingest | Import language should include mapping and validation context. |
| Data file output | Export | Data dump | Include scope and record count in export actions. |

## Plain-Language Replacements

| Avoid | Use instead |
|---|---|
| Mutation failed | The update could not be saved. |
| Invalid payload | Please check the required fields and try again. |
| Execute | Run or Start |
| Entity | Record |
| Artifact | Draft, report, file, or letter (choose specific term) |
| Not implemented | In development |
| Partial implementation | Partially working |

## Confirmation Copy Pattern

Use this structure for risky actions:

1. What will happen
2. How many records are affected
3. Whether it can be undone
4. Clear action button label

Example:

- Title: Delete Campaign
- Body: "This will permanently delete Spring Appeal and remove its campaign-level settings. This cannot be undone."
- Button: "Delete Campaign"

## Error Message Pattern

Use this structure for staff-facing errors:

1. What failed
2. Why (if known)
3. What to do next

Example:

- "The donation could not be saved. Please choose a donor before saving."

## Scope Notes

- DonorCRM uses donor and fundraising terminology.
- Compassion CRM uses client and care terminology.
- Events CRM uses event-first terminology and event-scoped routes.
- Avoid mixing donor financial terms into Compassion pages unless there is an explicit, permission-aware linked-record use case.
