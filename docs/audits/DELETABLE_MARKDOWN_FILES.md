# Deletable Markdown Files (Candidate List)

Date: 2026-07-19
Scope: Candidate markdown cleanup targets only. No automatic deletion in this file.

## Policy

This is a candidate list, not a delete-now list.
Each item must pass the deletion checklist in `AGENTS.md` before removal.

## Resolution

The root planning files, `report-e2e.md`, `CLAUDE.md`, and the duplicate `docs/howto/USER_GUIDE.md` were removed on 2026-07-19. Current code and the canonical workspace/status documentation superseded their unique operational value. See `docs/status/audit-artifacts/2026-07-19-documentation-and-agent-instructions-audit.md`.

## Historical Candidate Buckets

### High Confidence (Merge then remove)

| File | Reason | Proposed Action | Risk |
|---|---|---|---|
| `report-e2e.md` | Root-level tactical report duplicates testing/audit reporting patterns in `docs/testing` and `docs/status`. | Merge relevant findings into canonical testing docs, then remove root file. | Low |
| `Emailworkspace-plan.md` | Root-level long-form implementation plan should live under `docs/plans`. | Move/merge into a canonical plan path under `docs/plans`, then remove root copy. | Low |
| `Oyamaletters-uiplan.md` | Root-level planning draft duplicates formal planning structure under `docs/plans` and module docs. | Merge into `docs/plans` or module docs, then remove root copy. | Low |
| `Paths_V2plan.md` | Root-level stewardship planning draft duplicates formal plans. | Merge into canonical Steward Paths plan docs, then remove root copy. | Low |
| `Steward_Paths_V2_Workspace_Plan.md` | Root-level plan overlaps with existing Steward Paths V2 planning docs. | Consolidate into one canonical Steward Paths V2 plan doc under `docs/plans`, then remove duplicate. | Low |

### Medium Confidence (Consolidate and keep one canonical owner)

| File(s) | Reason | Proposed Action | Risk |
|---|---|---|---|
| `docs/audits/responsive-ui-audit.md` and `docs/status/responsive-ui-audit.md` | Same subject, different roles (policy vs generated status output). | Keep one canonical audit owner and convert the other into a pointer file if both are required. | Medium |
| `docs/testing/full-app-test-audit.md` and `docs/audits/full-app-testing-audit.md` | Overlapping full-app testing audit narratives. | Keep detailed canonical in one location; make the second a short index/pointer. | Medium |
| `docs/howto/USER_GUIDE.md` and `docs/howto/HOW_TO_USE.md` | Overlapping office usage guidance. | Merge into one canonical office operations guide with clear audience sections. | Medium |
| `docs/STATUS.md` | Broad status narrative overlaps with `docs/MASTER_PLAN.md` and `docs/status/*`. | Convert to index/pointer or retire after content migration. | Medium |

### Needs Owner Confirmation

| File | Reason | Proposed Action | Risk |
|---|---|---|---|
| `docs/MICROSOFT_325_SMTP_UI_INTEGRATION_GUIDE.md` | Appears to be a typo-version integration draft next to multiple Microsoft 365 SMTP docs. | Confirm ownership; likely merge into 365 SMTP canonical docs and remove. | Medium |
| `CLAUDE.md` | Tooling/assistant instruction files can be consumed by external workflows. | Do not delete without explicit owner confirmation of unused status. | High |

## Suggested Canonical Structure

1. `docs/MASTER_PLAN.md` for project-wide plan and top-level status.
2. `docs/status/*` for readiness and operational status artifacts.
3. `docs/audits/*` for dated deep audits.
4. `docs/plans/*` for implementation plans and phase docs.
5. Minimal root markdown: `README.md`, `LICENSE.md`, `AGENTS.md`, and only repo-critical policy files.

## Deletion Checklist

1. Confirm a canonical replacement path exists.
2. Migrate/merge unique content.
3. Run reference scan (`rg <filename or key heading>`).
4. Update inbound links.
5. Record migration in an audit note.
6. Delete file in a separate, reversible commit or PR slice.
