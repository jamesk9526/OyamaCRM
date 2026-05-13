# DonorCRM Grants Research Workspace

Last updated: 2026-05-12

## Purpose

DonorCRM Grants is a grant research, writing, deadline, and case-file workspace.

It is not a donation ledger.

## Core Boundary

- Grants Workspace tracks opportunities, research, requirements, reminders, writing tasks, resources, submission, and decision notes.
- Donations tracks money actually received, accounting fields, and revenue reporting.
- A grant may hand off to Donations, but grants never auto-create donation records.

## Workspace Navigation

Current Grants workspace tabs:

- Research Board
- Grant Library
- Deadlines
- My Grant Tasks
- Funders

## Grant Detail Case File

Current grant detail tabs:

- Overview
- Research
- Requirements
- Reminders
- Writing Tasks
- Resources
- Writing
- Decision
- Activity

These tabs provide a grant-specific operating workflow:

1. Capture opportunity and funder context.
2. Record eligibility and research notes.
3. Track requirements checklist items.
4. Schedule reminders and due dates.
5. Assign writing/review/submission tasks.
6. Store resource links and submission references.
7. Draft narrative sections.
8. Track decision and reporting follow-up.
9. Hand off awarded money recording to Donations.

## Case-File Data Model (Current Implementation)

Grant case-file items are persisted through grant activity metadata and exposed as first-class API endpoints:

- GET /api/grants/workspace/case-items
- GET /api/grants/:id/case-items
- POST /api/grants/:id/case-items
- PATCH /api/grants/:id/case-items/:itemId

Supported kinds:

- REMINDER
- TASK
- RESOURCE
- REQUIREMENT

Supported fields include:

- title
- description
- status
- priority
- taskType
- reminderType
- resourceType
- dueAt
- remindAt
- assignedToId
- assignedToName
- url
- pinned

## Permission Model

Grant-specific permission keys:

- grants.view
- grants.create
- grants.edit
- grants.delete
- grants.manage_funders
- grants.manage_tasks
- grants.manage_resources
- grants.manage_deadlines
- grants.record_decision
- grants.link_received_award

Route enforcement now uses these grant permissions for funders, grants, and case-file item operations.

## Add Grant Workflow

Add Grant now captures case-file context, including:

- Funder
- Grant opportunity name
- Program/purpose
- Assigned grant writer
- Primary reminder date
- Application portal URL
- Requested amount
- Awarded amount (optional)
- LOI/application/reporting deadlines
- Eligibility notes
- Research notes
- Required documents (seeded as requirement items)

Security rule:

- Do not store portal passwords or secrets in grant notes/resources.

## Donations Handoff

Grant detail includes a handoff action:

- Record Award As Received Grant

This opens Donations new-record flow with grant-aware prefill messaging. Donations remains the financial source-of-truth.

## Operational Metrics Language

Grant metrics should be interpreted as operational, not revenue-booked:

- Applications In Progress
- Submitted Awaiting Decision
- Upcoming Deadlines
- Reports Due
- Renewals Coming Up
- Requested Amount (potential)
- Awarded Amount (decision tracked)

Requested amount is never equivalent to received donation revenue.

## Current Status

- Core research/workspace framing: Working
- Grant case-file tabs and endpoints: Working
- Grant calendar visualization depth: Partially Working
- Advanced requirement completeness reporting: Partially Working
