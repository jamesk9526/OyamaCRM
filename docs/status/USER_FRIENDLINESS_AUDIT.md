# User Friendliness Audit

Last updated: 2026-05-14

This audit reviews OyamaCRM from the perspective of real nonprofit staff users.

## Roles Reviewed

- Executive Director
- Development Director
- Office Admin
- Donor Relations Staff
- Event Coordinator
- Client Services Staff
- Volunteer
- Board Member (read-only reviewer)

## Role Workflow Audit

| Role | Daily work | Weekly work | Should not access | Confusing pages/workflows | Too many choices | Guided help needed | Features to hide by role |
|---|---|---|---|---|---|---|---|
| Executive Director | Review revenue progress, overdue follow-ups, campaign status, major donor risks | Review reporting packet and donor retention trends | Deep system admin, importer mapping internals, destructive settings | Reports workspace wording and scope controls can feel technical | Reports filters + export modes | Dashboard quick interpretation and report definitions | Advanced data-tools operations, raw import mapping, technical settings |
| Development Director | Manage campaigns, review communications, assign follow-ups | Plan campaign calendar, review stewardship outcomes | Watchdog security operations, webmaster internal tools | Communications wizard path is still maturing and can be unclear for first-time users | Campaign + communication + letters paths overlap | Campaign review checklist and send readiness guidance | Internal platform tooling, low-level admin routes |
| Office Admin | Record donations, update donor records, process thank-you actions | Batch cleanups and acknowledgment progress checks | Permission/role management, security vault, high-risk admin actions | Donation and acknowledgment handoff across modules | Multiple routes for similar outreach actions | Donation-entry confirmation language and acknowledgment next-step prompts | Role and security administration surfaces |
| Donor Relations Staff | Donor record review, relationship notes, tasks, outreach drafts | Stewardship plan follow-up, lapsed donor list review | System settings and schema-level tools | Steward suggestions and communication handoffs can feel fragmented | Multiple outreach entry points (communications/letters/steward) | Clear next-best-action cues on donor and campaign pages | Raw system settings, plugin infrastructure |
| Event Coordinator | Track events, guests, tables, check-in workflows | Sponsor and registration reconciliation | Donor admin settings and client-service private records | Event context can be lost if event scoping is unclear across pages | Event tools plus global event tools without clear hierarchy | Event workspace selector usage and context preservation | Donor/compassion internals not needed for event operations |
| Client Services Staff | Client lookup, appointments, follow-ups, case notes | Outcomes review and service planning | Donor financial internals and events operations | Compassion module has partial pages and permission TODOs | Multiple in-development compassion tabs | Clear in-development warnings + approved workflow path | Any donor finance and unrelated module tools |
| Volunteer | Limited task completion, event support, basic lookup | Event shift prep and assigned follow-ups | Financial exports, donor data management, permissions | Navigation can expose more system options than needed | Sidebar breadth for limited-role users | Simple task completion guidance and safe action confirmations | Most admin, settings, and cross-module controls |
| Board Member (read-only) | View high-level metrics and curated reports | Board packet review | Any write actions, imports, user/role controls | Report depth and technical filter language | Full CRM navigation instead of read-only lens | Read-only dashboard/report orientation and glossary | All create/edit/delete and operational tooling |

## Highest Priority Findings

1. Start point clarity is inconsistent for non-technical users.
2. Action safety language is inconsistent across delete/send/clone flows.
3. Cross-workspace overlap (campaigns, communications, letters, steward) still creates decision friction.
4. Compassion routes include partial surfaces that need either completion or strict nav suppression.
5. Technical terms still leak into staff-facing interfaces in several modules.

## Priority Remediation Queue

| ID | Area | Status | Next action | Owner lane |
|---|---|---|---|---|
| UF-001 | Main dashboard first-action clarity | In Progress | Add Start Here guided cards and plain-language work snapshot cards | Donor dashboard UX |
| UF-002 | Contextual inline guidance | In Progress | Introduce shared `WorkspaceHelpTip` component and reuse in high-traffic pages | Shared UI |
| UF-003 | Confirmation safety language | In Progress | Replace browser-native dialogs with explicit modal confirmations in priority routes | Campaigns + Communications |
| UF-004 | Role-based visibility tightening | Open | Continue hiding placeholder and non-role-essential surfaces from primary navigation | IA + permissions |
| UF-005 | Staff-friendly vocabulary consistency | Open | Publish CRM language guide and migrate technical labels over time | UX content |

## Notes

- This audit complements production hardening work in `docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md` and `docs/status/PRODUCTION_READINESS_MATRIX.md`.
- No role should be forced to learn technical implementation details to complete common daily workflows.
