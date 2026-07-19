# Markdown Documentation Audit

Date: 2026-05-13 (historical inventory)
Scope: every `*.md` file in repository (excluding `.git` and `node_modules`).

> Superseded for cleanup decisions by `docs/status/audit-artifacts/2026-07-19-documentation-and-agent-instructions-audit.md`. The inventory below is retained as a historical snapshot and therefore may name files that no longer exist.

Total markdown files audited: 220

## Consolidation Summary

- Canonical master plan authority moved to `docs/MASTER_PLAN.md`.
- Competing plan authority removed from root/PLAN_FILES by moving plan files to `docs/plans/` and `docs/backlog/`.
- Root README now points into docs; full narrative preserved at `docs/PROJECT_OVERVIEW.md`.
- Office guide moved to `docs/howto/HOW_TO_USE.md`.
- Agent docs retained at root (`AGENTS.md`, `CLAUDE.md`).
- `dist/*` markdown files classified as duplicate archival snapshots (non-canonical).

## Full Inventory

| Current path | Purpose | Condition | Recommended destination | Decision | Linked from (sample) |
|---|---|---|---|---|---|
| AGENTS.md | Agent instructions | current | (keep current path) | retain at root (required) | CLAUDE.md; dist/oyamacrm-demo-20260509-213851/docs/status/reference-software-audit.md; dist/oyamacrm-demo-20260509-213916/docs/status/reference-software-audit.md; +16 more |
| CLAUDE.md | Agent instructions | current | (keep current path) | retain at root (required) | docs/audits/markdown-documentation-audit.md |
| Desktopapp/README.md | Desktop app local doc | current | (keep current path) | retain as module-local README | - |
| dist/oyamacrm-demo-20260509-213851/docs/audits/production-readiness-audit-2026-05-08.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/audits/source-of-truth-audit-2026-05-09.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/IMPLEMENTATION_STATUS.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/plans/events-crm-plan.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/compassion-crm-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/compassion-crm.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/demo-seed-system.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/events-crm-status.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/events-reporting-donor-sync.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/features.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/import-tools.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/merge-workflow.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/oyama-watchdog.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/oyama-webmaster.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213851/docs/status/reference-software-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/audits/production-readiness-audit-2026-05-08.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/audits/source-of-truth-audit-2026-05-09.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/IMPLEMENTATION_STATUS.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/plans/events-crm-plan.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/compassion-crm-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/compassion-crm.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/demo-seed-system.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/events-crm-status.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/events-reporting-donor-sync.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/features.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/import-tools.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/merge-workflow.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/oyama-watchdog.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/oyama-webmaster.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213916/docs/status/reference-software-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/audits/production-readiness-audit-2026-05-08.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/audits/source-of-truth-audit-2026-05-09.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/IMPLEMENTATION_STATUS.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/plans/events-crm-plan.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/compassion-crm-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/compassion-crm.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/demo-seed-system.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/events-crm-status.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/events-reporting-donor-sync.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/features.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/import-tools.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/merge-workflow.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/oyama-watchdog.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/oyama-webmaster.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213920/docs/status/reference-software-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/audits/production-readiness-audit-2026-05-08.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/audits/source-of-truth-audit-2026-05-09.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/IMPLEMENTATION_STATUS.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/plans/events-crm-plan.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/compassion-crm-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/compassion-crm.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/demo-seed-system.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/events-crm-status.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/events-reporting-donor-sync.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/features.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/import-tools.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/merge-workflow.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/oyama-watchdog.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/oyama-webmaster.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213930/docs/status/reference-software-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/AGENTS.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/CLAUDE.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/audits/production-readiness-audit-2026-05-08.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/audits/source-of-truth-audit-2026-05-09.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/IMPLEMENTATION_STATUS.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/plans/events-crm-plan.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/compassion-crm-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/compassion-crm.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/demo-seed-system.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/events-crm-status.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/events-reporting-donor-sync.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/features.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/import-tools.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/merge-workflow.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/oyama-watchdog.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/oyama-webmaster.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/docs/status/reference-software-audit.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| dist/oyamacrm-demo-20260509-213951/README.md | Generated build snapshot docs | duplicate | (keep in dist snapshot) | retain as historical build artifact | - |
| docs/AI_TOOL_REGISTRY.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/audits/crm-trust-audit.md | Audit artifact/report | archival | (keep current path) | retain as dated audit record | - |
| docs/audits/events-crm-galasoft-adaptation-audit-2026-05-10.md | Audit artifact/report | archival | (keep current path) | retain as dated audit record | - |
| docs/audits/markdown-documentation-audit.md | Audit artifact/report | archival | (keep current path) | retain as dated audit record | README.md |
| docs/audits/mobile-readiness-audit-2026-05-12.md | Audit artifact/report | archival | (keep current path) | retain as dated audit record | docs/plans/mobile-readiness-master-plan.md |
| docs/audits/production-readiness-audit-2026-05-08.md | Audit artifact/report | archival | (keep current path) | retain as dated audit record | - |
| docs/audits/source-of-truth-audit-2026-05-09.md | Audit artifact/report | archival | (keep current path) | retain as dated audit record | - |
| docs/backlog/master-plan-backlog.md | Backlog tracking | current | (keep current path) | moved from PLAN_FILES and retained as backlog | docs/plans/oyamacrm-agent-audit-and-next-steps.md; docs/plans/oyamacrm-compassion-agent-plan.md; docs/plans/oyamacrm-onboarding-and-settings-setup-plan.md; +4 more |
| docs/CLIENT_CRM_AUDIT.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/MASTER_PLAN.md |
| docs/CLIENT_CRM_IMPORTER_PLAN.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/CLIENT_CRM_TASKS.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/CRM_SIDEBAR_NAVIGATION.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/DONOR_CRM_SIDEBAR_NAVIGATION.md |
| docs/DONOR_CRM_AUDIT.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; +1 more |
| docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/howto/HOW_TO_USE.md; +3 more |
| docs/DONOR_CRM_EMAIL_BUILDER.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; +1 more |
| docs/DONOR_CRM_EMAIL_COMPLIANCE.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/status/features.md |
| docs/DONOR_CRM_EMAIL_SYSTEM_AUDIT.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md |
| docs/DONOR_CRM_FORM_LETTER_EDITOR.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/howto/HOW_TO_USE.md; +1 more |
| docs/DONOR_CRM_GRANTS_AUDIT.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; +1 more |
| docs/DONOR_CRM_GRANTS_RESEARCH_WORKSPACE.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; +1 more |
| docs/DONOR_CRM_LETTERS_PRINTABLES_PRODUCTION_PLAN.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/howto/HOW_TO_USE.md; +1 more |
| docs/DONOR_CRM_LETTERS_PRINTABLES.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; +1 more |
| docs/DONOR_CRM_PRINT_QUEUE.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/howto/HOW_TO_USE.md; +1 more |
| docs/DONOR_CRM_SIDEBAR_NAVIGATION.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/CRM_SIDEBAR_NAVIGATION.md; docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; +1 more |
| docs/DONOR_CRM_SITE_EMBEDS.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/DONOR_CRM_STEWARDSHIP_COMMAND_CENTER.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; docs/status/production-readiness-checklist.md |
| docs/DONOR_ENGAGEMENT_SYSTEM.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md; docs/howto/HOW_TO_USE.md; +4 more |
| docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/MASTER_PLAN.md; docs/status/features.md; docs/status/production-readiness-checklist.md |
| docs/HELP_APP.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/HOSTINGER_DEPLOY_README.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/howto/HOW_TO_USE.md | Operator how-to guide | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/audits/markdown-documentation-audit.md; docs/audits/production-readiness-audit-2026-05-08.md; +2 more |
| docs/IMPLEMENTATION_STATUS.md | Project documentation | merged | docs/MASTER_PLAN.md | retired after consolidation into canonical status docs | docs/MASTER_PLAN.md; docs/status/features.md |
| docs/LETTERS_PRINTABLES_WORKSPACE.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md |
| docs/MASTER_PLAN.md | Canonical master plan and reality audit | current | (keep current path) | rewritten as canonical source | docs/audits/markdown-documentation-audit.md; docs/backlog/master-plan-backlog.md; docs/plans/phase-index.md; +1 more |
| docs/OGENTIC_PLAN.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/operations/PRODUCTION_BUILD_MANAGER.md | Operational guide | current | (keep current path) | retain; links updated as needed | - |
| docs/OYAMA_HRM.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/OYAMA_TRIVIA_ADDON_PLAN.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/OYAMA_TRIVIA_README.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/OYAMA_WEBMASTER_CRM_INTEGRATION.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/PROJECT_OVERVIEW.md; docs/status/production-readiness-checklist.md |
| docs/OYAMA_WEBMASTER_DATA_SAFETY.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/PROJECT_OVERVIEW.md; docs/status/production-readiness-checklist.md |
| docs/OYAMA_WEBMASTER_PUBLISHING_ARCHITECTURE.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/PROJECT_OVERVIEW.md; docs/status/production-readiness-checklist.md |
| docs/OYAMA_WEBMASTER_REBUILD_PLAN.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/PROJECT_OVERVIEW.md; docs/status/production-readiness-checklist.md |
| docs/OYAMA_WEBMASTER_SITE_TYPES.md | Project documentation | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/PROJECT_OVERVIEW.md; docs/status/production-readiness-checklist.md |
| docs/plans/events-crm-plan.md | Planning packet | current | (keep current path) | retain; links updated as needed | dist/oyamacrm-demo-20260509-213851/docs/status/reference-software-audit.md; dist/oyamacrm-demo-20260509-213916/docs/status/reference-software-audit.md; dist/oyamacrm-demo-20260509-213920/docs/status/reference-software-audit.md; +3 more |
| docs/plans/mobile-readiness-master-plan.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/Opportunity_Engine.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/oyamacrm-agent-audit-and-next-steps.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/oyamacrm-compassion-agent-plan.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/oyamacrm-onboarding-and-settings-setup-plan.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-00-setup-onboarding-settings.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-01-foundation-and-auth.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-02-constituents-and-timeline.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-03-donations-funds-campaigns.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-04-receipts-tasks-communications.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-05-dashboard-and-reports.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-06-groups-segments-automation.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-07-events-and-gala.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-08-security-integrations-ai-ops.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-09-compassion-workspace.md | Planning packet | current | (keep current path) | retain; links updated as needed | docs/audits/production-readiness-audit-2026-05-08.md |
| docs/plans/phase-index.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/phase-rollout-plan.md | Planning packet | current | (keep current path) | retain; links updated as needed | docs/backlog/master-plan-backlog.md |
| docs/plans/pregnancy-care-center-donor-crm-api-plan.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/STEWARD_AI_AGENT_PLAN.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/plans/STEWARD_SIGNALS_PLAN.md | Planning packet | current | (keep current path) | retain; links updated as needed | - |
| docs/PROJECT_OVERVIEW.md | Project documentation | stale | (keep current path) | created from prior root README content | docs/audits/markdown-documentation-audit.md; README.md |
| docs/status/build-and-typecheck-audit-2026-05-12.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; docs/status/features.md; +2 more |
| docs/status/compassion-crm-audit.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | - |
| docs/status/compassion-crm.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | docs/status/compassion-crm-audit.md |
| docs/status/crm-organization-map.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | docs/status/features.md |
| docs/status/crm-readiness-report-2026-05-12.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | - |
| docs/status/demo-seed-system.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | - |
| docs/status/e2e-coverage-audit-2026-05-12.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; docs/status/features.md; +3 more |
| docs/status/events-crm-status.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | dist/oyamacrm-demo-20260509-213851/docs/status/reference-software-audit.md; dist/oyamacrm-demo-20260509-213916/docs/status/reference-software-audit.md; dist/oyamacrm-demo-20260509-213920/docs/status/reference-software-audit.md; +4 more |
| docs/status/events-reporting-donor-sync.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | - |
| docs/status/features.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/backlog/master-plan-backlog.md; docs/DONOR_CRM_STEWARDSHIP_COMMAND_CENTER.md; +5 more |
| docs/status/import-tools.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | AGENTS.md; dist/oyamacrm-demo-20260509-213951/AGENTS.md; docs/MASTER_PLAN.md |
| docs/status/merge-workflow.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | - |
| docs/status/oyama-watchdog.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | - |
| docs/status/oyama-webmaster.md | Status and readiness tracking | merged | docs/OYAMA_WEBMASTER_REBUILD_PLAN.md | retired after Webmaster status consolidation | docs/OYAMA_WEBMASTER_REBUILD_PLAN.md; docs/MASTER_PLAN.md |
| docs/status/production-readiness-checklist.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | AGENTS.md; docs/audits/production-readiness-audit-2026-05-08.md; docs/CLIENT_CRM_AUDIT.md; +10 more |
| docs/status/readiness-audit-2026-05-12.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; docs/status/crm-readiness-report-2026-05-12.md; +2 more |
| docs/status/reference-software-audit.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | - |
| docs/status/smoke-coverage-audit-2026-05-12.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; docs/status/features.md; +2 more |
| docs/status/testing-coverage-audit-2026-05-12.md | Status and readiness tracking | current | (keep current path) | retain; links updated as needed | docs/howto/HOW_TO_USE.md; docs/PROJECT_OVERVIEW.md; docs/status/features.md; +2 more |
| docs/STEWARD_AI_WORKSPACE_PLAN.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| docs/STEWARD_PATHS_ENGAGEMENT_SEQUENCES.md | Project documentation | current | (keep current path) | retain; links updated as needed | docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md |
| docs/VISUAL_DOCUMENTATION_REFRESH_SUMMARY.md | Project documentation | current | (keep current path) | retain; links updated as needed | - |
| README.md | Repository entrypoint | current | (keep current path) | reduced to short docs index | docs/audits/markdown-documentation-audit.md; docs/VISUAL_DOCUMENTATION_REFRESH_SUMMARY.md; REFERANCE_SOFTWARE/GalaSoft/README.md |
| REFERANCE_SOFTWARE/GalaSoft/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260222-103523/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260222-105103/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260222-105640/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260225-000557/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260225-152336/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260225-152622/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260225-193701/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260225-212809/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-021902/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-022113/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-022227/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-022451/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-023341/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-023945/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-101138/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-154857/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-204543/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260226-210951/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260304-194750/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260304-225708/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260305-010413/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260314-204756/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260314-211024/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260316-104627/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260319-103627/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260319-111406/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260319-114622/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260319-125005/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260319-131344/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260319-144529/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260319-144909/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260324-142611/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260324-143632/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260327-185321/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260327-190639/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260327-193353/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260328-154727/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260328-155401/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260328-155909/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260328-161112/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260328-171039/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260328-171506/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/gala-deploy-20260406-154007/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/dist/Galasoft.stablebuild-WORKING/deploy/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/docs/sponsor-table-checkin.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/laragon/instructions.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/TODO.MD | Project documentation | stale | docs/ | move to docs or archive | - |
| REFERANCE_SOFTWARE/GalaSoft/vite-project/e2e/README.md | Project documentation | stale | docs/ | move to docs or archive | - |
