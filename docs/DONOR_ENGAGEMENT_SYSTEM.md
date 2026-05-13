# Donor Engagement System

Last updated: 2026-05-13

## Purpose

This document defines how DonorCRM letters, communications, email builder, steward paths, tasks, activities, donations, dashboard queues, and reports operate as one connected donor engagement system.

## Scope

The donor engagement system spans:

- Donations and campaign context
- Communications workspace and email campaigns
- Email Builder authoring experience
- Letters and printables generation and fulfillment
- Steward Paths orchestration
- Tasks and human follow-up
- Activity timeline records
- Dashboard attention queues and reporting

## Architecture

### System responsibilities

- Communications: central outreach workspace and campaign lifecycle control
- Email Builder: visual authoring surface for campaign draft content
- Letters and Printables: print/PDF/mail workflows and letter-template management
- Steward Paths: sequence orchestration that creates or advances work in the other tools
- Tasks: manual follow-up and assignment workflow
- Activities: timeline source of truth for donor touchpoints
- Dashboard and reports: operational queues and aggregate outcomes

### Donor Engagement Item (conceptual)

A Donor Engagement Item is currently represented across existing models rather than a new table. The working concept maps to:

- EmailCampaign
- GeneratedLetter
- StewardPathEmailDraft
- Task
- Activity

No new communication-item model was added in this pass. Existing persisted models are used and linked where available.

## Shared Status Language

Use these cross-channel statuses in UI messaging and docs:

- Draft
- Needs Review
- Approved
- Scheduled
- Sent
- Generated
- Printed
- Mailed
- Completed
- Failed
- Canceled
- Archived

Channel-specific states may still exist in backend enums, but user-facing language should map to the shared set.

## Current Workflow Map

### Donation thank-you workflow

Status: Partially Working

Working:

- Donation record creation is persisted.
- Steward paths can trigger on completed donations.
- Donation quick actions now support letter generation, email-draft entry path, task/path launches, and Mark Thanked.
- Mark Thanked now persists acknowledgment timestamp through donation API.

Partially Working:

- Automated, end-to-end acknowledgment orchestration across all channels is not fully centralized.

### Letter-to-email bridge

Status: Working

Working:

- GeneratedLetter supports create-email-draft flow.
- Letter-driven email draft creation persists EmailCampaign drafts.
- Activity/audit records are written.

### Email builder to communications workflow

Status: Partially Working

Working:

- Email builder edits persist campaign body/template JSON.
- Builder includes campaign metadata fields (name/subject/preview) and test-send control.
- Builder now uses campaign-studio workflow cues (Audience/Design/Personalize/Review/Schedule).
- Review checklist tab now surfaces compliance/readiness checks before broad send.
- Donor-specific stewardship blocks (thank-you/receipt/giving summary/CTA/welcome/signature/footer) are available in Block Library.

Partially Working:

- Full version history and advanced merge validation are not implemented.

### Steward paths orchestration

Status: Partially Working

Working:

- Sequence engine supports generate letter, draft email, create task, notes, and timeline events.
- Legacy automations and sequence APIs are active.

Partially Working:

- Full visual builder with branching/advanced controls remains in progress.

## UI Integration Delivered In This Pass

- Communications workspace upgraded into tabbed engagement hub:
  - Overview
  - Email Campaigns
  - Email Drafts
  - Letters
  - Templates
  - Segments
  - Send Queue
  - Communication Log
  - Settings
- Donation list quick actions and persisted acknowledgment updates
- Constituent header quick actions for communications, letters, paths, tasks, and meetings
- Campaign-level quick actions for outbound follow-up workflows
- Steward paths page visual language improvements (shared status legend and sequence cards)

## Safety Rules

- Draft-first by default for outbound email work
- No implicit auto-send behavior introduced
- Existing recipient opt-out checks remain enforced in campaign send paths
- Activity and audit write-backs are preserved for key workflow transitions

## Implementation Status Summary

| Area | Status |
|---|---|
| Communications hub architecture | Partially Working |
| Letters and printables integration | Partially Working |
| Email builder campaign authoring flow | Partially Working |
| Steward paths orchestration links | Partially Working |
| Donation acknowledgment quick action persistence | Working |

## Next Steps

1. Add deeper communication-log filtering and export.
2. Add stronger merge-field validation warnings before send/generate.
3. Expand steward path visual builder controls beyond current sequence cards.
4. Expand dashboard/report queues for failed sends, path due steps, and acknowledgment backlog.
