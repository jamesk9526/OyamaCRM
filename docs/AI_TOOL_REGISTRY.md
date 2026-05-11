# AI Tool Registry

Last updated: 2026-05-10

## Architecture
AI actions are mediated through a controlled internal tool registry instead of direct unrestricted data access.
Each tool declares category, risk level, approval requirement, and execution schema contracts.

## Risk Levels
- safe: read/summarize/draft; no confirmation required.
- review_required: confirmation required before save-like operations.
- sensitive: explicit confirmation plus permission checks.
- destructive: blocked in initial implementation.

## Approval Rules
- Safe actions may run automatically.
- Review-required actions require user confirmation before commit.
- Sensitive actions require explicit user confirmation and role checks.
- Destructive actions are not available in the first implementation.

## Initial Tool Inventory
- donor.searchDonors (safe, stub)
- donor.findLapsedDonors (safe, stub)
- communication.draftEmail (safe, stub)
- communication.saveEmailDraft (review_required, stub)
- spreadsheet.createSpreadsheetView (safe, stub)
- reporting.generateBoardReport (safe, stub)
- task.createTaskList (review_required, stub)
- system.exportDonorData (sensitive, stub)

## Input/Output Notes
Tool schemas are declared as structured placeholders and will be tightened with real validators as backend routes are connected.
All current tools are explicitly marked stub until backend endpoints are wired.

## Safety Boundaries
- No destructive actions are exposed.
- No automatic sending workflows are exposed.
- Draft outputs remain draft-only until explicit approval pathways are implemented.
