# Merge Workflow — Status

_Last deep audit: 2026-05-09_

## What Exists

### Client-Side Duplicate Detection (`app/data-tools/merge/MergeWorkflow.tsx`)

| Feature | Status | Notes |
|---------|--------|-------|
| Find duplicates button | ✅ Working | Scans loaded constituents; max 50 pairs |
| Email-based matching | ✅ Working | Exact email match (case-insensitive) |
| Name-based matching | ✅ Working | Same last name + first name contains check |
| Duplicate pair list | ✅ Working | Click to open side-by-side comparison |
| Side-by-side comparison | ✅ Working | All fields shown; cells differ highlighted |
| Field-level radio selection | ✅ Working | Pick Record A or B value for each field |
| Merge preview | ✅ Working | Shows final merged record before confirming |
| Skip / "Not a duplicate" | ✅ Working | Dismisses a pair from the list |
| Backend merge | ❌ Not implemented | `TODO` comment in place; no API call |

## What Is Missing

| Item | Priority | Notes |
|------|----------|-------|
| `POST /api/constituents/merge` backend endpoint | High | Merge two records server-side; soft-delete the loser |
| Audit log for merges | High | Record who merged, what changed, when |
| Merge history / undo | Medium | Allow reverting a merge within N hours |
| Confidence scoring | Low | Weight name similarity for smarter pair ranking |
| Batch merge (merge all) | Low | Apply a default rule to merge many pairs at once |
| Block false-positives | Low | Permanently mark a pair as "not a duplicate" |

## Rules (Do Not Violate)

- **Never silently overwrite data.** Always show the user the before and after.
- **Dry-run mode must be preserved.** The current implementation is effectively always dry-run.
- **Audit log every merge.** Once the backend is wired, every merge must write an audit entry.

## Next Steps

1. Implement `POST /api/constituents/merge` with `{ keepId, discardId, fieldChoices }` payload.
2. Soft-delete the discarded record; attach its donation history to the kept record.
3. Write an audit log entry: `{ action: "merge", userId, keepId, discardId, timestamp }`.
4. Wire `MergeWorkflow.tsx` `handleMerge` to call the endpoint and show a real success state.
5. Add merge history tab to the Data Tools page.
