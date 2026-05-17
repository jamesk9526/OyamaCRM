# Multi-List & Multi-Segment Email Sending

## Overview

The email campaign system now supports sending emails to **multiple lists and/or multiple segments simultaneously**. This feature allows campaigns to reach combined audiences while maintaining recipient deduplication and compliance checking.

## Feature Capabilities

### Send Modes

1. **CAMPAIGN_AUDIENCE** (existing) - Send to a default campaign audience
2. **SEGMENT** (existing) - Send to a single segment (Active, Lapsed, New, Major, Volunteers)
3. **SAVED_LIST** (existing) - Send to a single saved recipient list
4. **MULTI_SEGMENT** (new) - Send to multiple segments simultaneously
5. **MULTI_LIST** (new) - Send to multiple saved lists simultaneously
6. **LIST** (existing) - Send to one-time list of email addresses
7. **INDIVIDUAL** (existing) - Send to a single email address

### Key Features

- **Recipient Deduplication**: When combining multiple lists or segments, duplicate email addresses are automatically removed
- **Compliance Checking**: All selected recipients go through the same email compliance evaluation as single-mode sends
- **Audience Preview**: Combined recipient count displayed before sending
- **Provider Aware**: Works with all configured email providers (SMTP, Microsoft 365 SMTP, Microsoft Graph)

## User Interface Changes

### Send Mode Selection

The send mode selector now includes two new modes:

```
┌─────────────────────────────────────────────────────┐
│ Saved Audience  │ Segment         │ Multi Segment   │
│ Saved List      │ Multi List      │ One-time List   │
│ Individual      │                 │                 │
└─────────────────────────────────────────────────────┘
```

### Multi-Segment Selection

When "Multi Segment" mode is selected:

```
Select multiple segments to include in send:

☐ Active Donors
☑ Lapsed Donors
☐ New Donors
☑ Major Donors
☐ Volunteers

(Checkboxes allow selecting 1+ segments)
```

### Multi-List Selection

When "Multi List" mode is selected:

```
Select multiple saved lists to combine and send to. 
Recipients will be deduplicated.

☑ Newsletter Subscribers (450)
☐ Board Members (12)
☑ Event Attendees (89)
☐ Major Donors (23)

(Checkboxes allow selecting 1+ lists)
```

## Backend Implementation

### Type Definitions

```typescript
type CampaignSendMode = 
  | "CAMPAIGN_AUDIENCE"
  | "SEGMENT"
  | "SAVED_LIST"
  | "LIST"
  | "INDIVIDUAL"
  | "MULTI_SEGMENT"      // NEW
  | "MULTI_LIST";        // NEW

interface CampaignSendOptions {
  sendMode?: CampaignSendMode;
  audienceFilter?: AudienceFilter | { types?: string[] };
  recipientListId?: string;
  recipientListIds?: string[];      // NEW - array for multi-list
  recipientEmails?: string[];
}
```

### New Functions

#### `resolveMultiSavedListRecipients()`

Loads multiple saved recipient lists and combines their recipients with automatic deduplication.

**Parameters:**
- `listIds`: Array of saved list IDs to combine
- `organizationId`: Organization scope

**Returns:** Combined recipients, list names, and IDs

**Deduplication:** Uses a Set to ensure each email appears only once regardless of how many lists it appears in.

#### `getMultiSegmentConstituents()`

Gets all constituents matching multiple segment types and combines with deduplication.

**Parameters:**
- `types`: Array of segment type strings (e.g., ["active", "lapsed"])
- `organizationId`: Organization scope

**Returns:** Array of unique constituents across all selected segments

**Deduplication:** Uses a Map keyed by constituent ID to prevent duplicates.

### Resolution Logic

The `resolveRecipientPlan()` function now handles:

1. **MULTI_LIST** - Combines multiple saved lists, evaluates compliance, returns merged recipients
2. **MULTI_SEGMENT** - Combines multiple segments, evaluates compliance, returns merged recipients
3. All existing modes - Unchanged behavior

## API Payload Examples

### Multi-Segment Send Request

```json
{
  "sendMode": "MULTI_SEGMENT",
  "audienceFilter": {
    "types": ["active", "lapsed", "major"]
  }
}
```

Response includes:
- Combined recipient count
- Suppression count (if any)
- Final send count
- Audience type: `"multi-segments: active, lapsed, major"`

### Multi-List Send Request

```json
{
  "sendMode": "MULTI_LIST",
  "recipientListIds": [
    "list-1-id",
    "list-2-id",
    "list-3-id"
  ]
}
```

Response includes:
- Combined recipient count from all lists
- Suppression count (if any)
- Final send count
- Audience type: `"multi-lists: Newsletter, Board Members, Event Attendees"`

## Compliance & Safety

1. **Email Validation** - All combined recipients validated before send
2. **Suppression Enforcement** - Unsubscribed addresses automatically excluded
3. **Do-Not-Email Respect** - Constituent do-not-email flags honored
4. **Deduplication** - No double-sends to same recipient
5. **Category Compliance** - Email category rules applied to combined audience
6. **Audit Logging** - Each multi-send recorded with list/segment breakdown

## Testing Scenarios

### Test Case 1: Multi-Segment Send

**Setup:**
1. Create 2 segments: Active Donors (50 people) and Lapsed Donors (30 people)
2. Create 10 people who are in BOTH segments
3. Draft a campaign

**Action:**
1. Select "Multi Segment" mode
2. Check "Active Donors" and "Lapsed Donors"
3. Preview audience

**Expected:**
- Final send count: 70 (50 + 30 - 10 duplicates)
- Audience type shown: "multi-segments: active, lapsed"

### Test Case 2: Multi-List Send

**Setup:**
1. Create 3 saved lists:
   - Newsletter: 100 people
   - Board: 12 people
   - Event: 89 people
2. 15 people in multiple lists
3. Draft a campaign

**Action:**
1. Select "Multi List" mode
2. Check all 3 lists
3. Preview audience

**Expected:**
- Final send count: 186 (100 + 12 + 89 - 15 duplicates)
- List names shown in UI: "Newsletter (100), Board (12), Event (89)"

### Test Case 3: Multi-Segment with Suppression

**Setup:**
1. Create segment: Active Donors (50)
2. Create segment: Major Donors (12)
3. 5 people in both AND suppressed
4. Segment overlap: 3 people

**Action:**
1. Select Multi Segment mode
2. Check both segments
3. Review compliance preview

**Expected:**
- Total matched: 59 (50 + 12 - 3 duplicates)
- Suppressed: 5
- Final send count: 54

## File Changes

### Frontend
- `app/components/communications/CampaignSendWorkspace.tsx` - Added MULTI_SEGMENT and MULTI_LIST modes, checkbox selection UI

### Backend
- `server/src/routes/email-campaigns.ts` - Added `resolveMultiSavedListRecipients()`, `getMultiSegmentConstituents()`, updated `resolveRecipientPlan()` to handle new modes

## Limitations & Future Work

1. **Mixed Mode** - Currently cannot combine list + segment in single send (can send to multiple segments OR multiple lists, not both)
2. **Audience Preview** - Multi-segment preview not real-time (loads on-demand)
3. **List Editing** - Cannot edit combined multi-list on send - must modify lists in Contacts Manager first

## Related Features

- **Email Sending System** - Uses provider-aware email routing (SMTP, Microsoft 365 SMTP, Microsoft Graph)
- **Compliance System** - Enforces unsubscribe, do-not-email, category opt-outs
- **Contacts Manager** - Creates and manages saved lists used in Multi List mode
- **Campaign Analytics** - Tracks delivery, opens, clicks for multi-recipient sends

## Status

**Production Ready**: ✅ 
- Type-safe implementation (TypeScript compiled successfully)
- Builds without errors (169 pages)
- Tested mode switching and recipient resolution logic
- Compatible with existing email provider routing
