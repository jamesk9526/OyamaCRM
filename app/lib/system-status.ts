/**
 * System status metadata for the Settings readiness pages.
 * This file is the audit-backed source for feature and release-health labels.
 */

export type FeatureStatus = "Working" | "Partially Working" | "Demo Only" | "Broken" | "Not Implemented";

/** Safe public build metadata surfaced in the web app and health views. */
export interface PublicBuildInfo {
  appName: string;
  version: string;
  buildDate: string;
  gitCommit: string;
  releaseChannel: string;
  environment: string;
  lastAuditDate: string;
}

/** Summary row used by the system status overview cards. */
export interface SystemStatusSection {
  title: string;
  status: FeatureStatus;
  summary: string;
}

/** Detailed readiness row shown in the admin feature matrix. */
export interface FeatureReadinessItem {
  feature: string;
  workspace: string;
  status: FeatureStatus;
  lastVerified: string;
  workingPieces: string;
  missingPieces: string;
  nextAction: string;
  linkedPlanFile: string;
  priority?: "P0" | "P1" | "P2";
  successCriteria?: string;
  copilotPrompt?: string;
}

/** One production-readiness checkpoint and its current audit-backed state. */
export interface ReadinessChecklistItem {
  item: string;
  status: FeatureStatus;
  note: string;
}

export const AUDIT_DATE = "2026-05-12";
export const OVERALL_READINESS_SCORE = 76;

/**
 * Returns safe build metadata for UI display.
 * Environment variables are optional and fall back to repo-known defaults.
 */
export function getPublicBuildInfo(env: NodeJS.ProcessEnv = process.env): PublicBuildInfo {
  return {
    appName: env.NEXT_PUBLIC_APP_NAME ?? env.APP_NAME ?? "OyamaCRM",
    version: env.NEXT_PUBLIC_APP_VERSION ?? env.APP_VERSION ?? "0.1.0",
    buildDate: env.NEXT_PUBLIC_BUILD_DATE ?? env.BUILD_DATE ?? AUDIT_DATE,
    gitCommit: env.NEXT_PUBLIC_GIT_COMMIT ?? env.GIT_COMMIT ?? "local-dev",
    releaseChannel: env.NEXT_PUBLIC_RELEASE_CHANNEL ?? env.RELEASE_CHANNEL ?? "development",
    environment: env.NEXT_PUBLIC_APP_ENV ?? env.NODE_ENV ?? "development",
    lastAuditDate: env.NEXT_PUBLIC_LAST_AUDIT_DATE ?? env.LAST_AUDIT_DATE ?? AUDIT_DATE,
  };
}

/** Aggregates the feature matrix into counts for the readiness summary cards. */
export function getFeatureStatusCounts(items: FeatureReadinessItem[] = FEATURE_READINESS): Record<FeatureStatus, number> {
  return items.reduce<Record<FeatureStatus, number>>(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    {
      Working: 0,
      "Partially Working": 0,
      "Demo Only": 0,
      Broken: 0,
      "Not Implemented": 0,
    }
  );
}

export const SYSTEM_STATUS_SECTIONS: SystemStatusSection[] = [
  {
    title: "Application Version",
    status: "Working",
    summary: "Version, build, release channel, and audit date are surfaced in settings and health responses.",
  },
  {
    title: "Database Status",
    status: "Working",
    summary: "Health probes and Prisma connectivity checks are wired for runtime visibility.",
  },
  {
    title: "API Status",
    status: "Working",
    summary: "Core donor, compassion, events, HRM, and settings routes are mounted behind shared middleware.",
  },
  {
    title: "Authentication Status",
    status: "Working",
    summary: "Login, refresh rotation, logout, and setup gating are implemented.",
  },
  {
    title: "Permission / RBAC Status",
    status: "Partially Working",
    summary: "Role and fine-grained permission controls exist, but full workspace and scope enforcement is still in progress.",
  },
  {
    title: "Audit Log Status",
    status: "Partially Working",
    summary: "Audit persistence and viewer are live, while complete coverage across all routes is still being expanded.",
  },
  {
    title: "Donor CRM Feature Status",
    status: "Working",
    summary: "Core constituent, donation, campaign, task, and dashboard workflows run on real API and database data.",
  },
  {
    title: "Compassion Workspace Feature Status",
    status: "Partially Working",
    summary: "Client and appointment workflows are real-data backed, with deeper care-plan and privacy controls still incomplete.",
  },
  {
    title: "Communication / Email Builder Status",
    status: "Partially Working",
    summary: "Campaign CRUD and queue dispatch exist; media pipeline, approval safeguards, and delivery telemetry remain incomplete.",
  },
  {
    title: "Scheduling Status",
    status: "Partially Working",
    summary: "Compassion appointments and HRM scheduling flows are live; unified calendar and policy hardening are not complete.",
  },
  {
    title: "Reports Status",
    status: "Partially Working",
    summary: "Report endpoints and dashboards are functional, while export jobs and freshness controls remain in progress.",
  },
  {
    title: "Steward Paths Status",
    status: "Partially Working",
    summary: "Automation triggers and worker processing are wired, with retry strategy and operations diagnostics still pending.",
  },
  {
    title: "Events / Gala Status",
    status: "Partially Working",
    summary: "Event operations (orders, guests, tables, check-in) are live; ticketing and sponsor/public registration remain partial.",
  },
  {
    title: "Integrations Status",
    status: "Partially Working",
    summary: "QuickBooks, site embeds, SMTP, and AI settings are implemented; payments and webhook providers are not yet integrated.",
  },
  {
    title: "AI Runtime Status",
    status: "Partially Working",
    summary: "Steward AI configuration and provider switching are available, but runtime validation and governance hardening are ongoing.",
  },
  {
    title: "Validation Pipeline Status",
    status: "Broken",
    summary: "Build and smoke lanes are passing, while typecheck still fails and lint lane needs scoped stabilization for release confidence.",
  },
];

export const FEATURE_READINESS: FeatureReadinessItem[] = [
  {
    feature: "Auth & Setup",
    workspace: "Core",
    status: "Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Login, refresh, logout, setup completion flow, and protected route guardrails are implemented.",
    missingPieces: "Scope-based workspace enforcement and broader policy checks are still not fully standardized.",
    nextAction: "Finish permission middleware adoption for sensitive read and write endpoints.",
    linkedPlanFile: "PLAN_FILES/phase-01-foundation-and-auth.md",
  },
  {
    feature: "Settings Workspace",
    workspace: "Core",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Organization, users, audit logs, AI, plugins, site embeds, and system readiness pages are functional.",
    missingPieces: "Role/scope matrix editing and workspace-level assignment controls are still incomplete.",
    nextAction: "Complete persisted role/scope editor and enforce module workspace policy checks.",
    linkedPlanFile: "PLAN_FILES/oyamacrm-onboarding-and-settings-setup-plan.md",
    priority: "P1",
    successCriteria: "Admins can edit role/scope matrix in UI and changes are enforced server-side for module workspace access.",
    copilotPrompt: "Implement persisted role and scope matrix management for Settings Workspace. Use app/settings/roles/page.tsx and server/src/routes/users.ts as anchors. Build real CRUD endpoints and replace placeholder matrix UI with editable controls. Enforce module workspace assignment checks in middleware for donor, compassion, events, and apps routes. Add audit events for role/scope changes. Add tests for allow and deny paths across at least one route per module.",
  },
  {
    feature: "Constituents",
    workspace: "DonorCRM",
    status: "Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "List/search/create/edit/detail and timeline activity writes run on real API data.",
    missingPieces: "Advanced dedupe automation and bulk segment management need more polish.",
    nextAction: "Expand import history and merge tooling with explicit conflict review.",
    linkedPlanFile: "PLAN_FILES/phase-02-constituents-and-timeline.md",
  },
  {
    feature: "Donations & Campaigns",
    workspace: "DonorCRM",
    status: "Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Donation and campaign CRUD, recurring flags, designation support, and summary reporting hooks are live.",
    missingPieces: "Receipt automation, pledge UX depth, and refund/chargeback handling remain open.",
    nextAction: "Ship receipt and acknowledgment workflows tied to communication history.",
    linkedPlanFile: "PLAN_FILES/phase-03-donations-funds-campaigns.md",
  },
  {
    feature: "Tasks & Stewardship",
    workspace: "DonorCRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Task list/create/complete/delete, stewardship templates, bulk reassignment actions, and timeline logging are implemented.",
    missingPieces: "Segment-driven bulk task generation and approvals for advanced stewardship playbooks are still limited.",
    nextAction: "Add segment-based bulk task creation and assignment guardrails by team capacity.",
    linkedPlanFile: "PLAN_FILES/phase-04-receipts-tasks-communications.md",
    priority: "P2",
    successCriteria: "Users can generate tasks from a selected segment with preview and capacity guardrails before commit.",
    copilotPrompt: "Add segment-driven bulk task creation for stewardship. Extend app/tasks/page.tsx and server/src/routes/tasks.ts with a new endpoint that accepts segment criteria, previews impacted constituents, and supports assignment guardrails by team capacity. Persist timeline activity rows per created task and include dry-run mode. Add smoke tests covering preview and commit workflows.",
  },
  {
    feature: "Communications & Email Builder",
    workspace: "DonorCRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Campaign builder, preview, test-send, schedule/cancel, media uploads, and recipient timeline writeback are live.",
    missingPieces: "Merge-field completeness and deeper compliance workflows (unsubscribe/legal policy automation) remain in progress.",
    nextAction: "Complete merge-field coverage and add compliance policy controls for send approvals.",
    linkedPlanFile: "PLAN_FILES/phase-04-receipts-tasks-communications.md",
    priority: "P1",
    successCriteria: "Campaign sends validate merge fields and enforce compliance policy checks before send/schedule.",
    copilotPrompt: "Harden email builder compliance and merge-field coverage. Extend app/components/email-builder/EmailBuilderApp.tsx and server/src/routes/email-campaigns.ts to validate required merge fields and block send if unresolved placeholders remain. Add policy checks for unsubscribe footer/legal content and approval gate metadata before dispatch. Write tests for pass/fail send validation paths and preserve existing timeline writeback behavior.",
  },
  {
    feature: "Dashboard & Reports",
    workspace: "DonorCRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Dashboard summaries, core report endpoints, freshness markers, and permission-gated server CSV exports are running with real data.",
    missingPieces: "Scheduled export delivery and deeper drilldown cross-filtering are still incomplete.",
    nextAction: "Add scheduled report delivery and saved drilldown views.",
    linkedPlanFile: "PLAN_FILES/phase-05-dashboard-and-reports.md",
    priority: "P2",
    successCriteria: "Staff can schedule recurring report deliveries and reopen saved drilldown filters.",
    copilotPrompt: "Implement scheduled report delivery and saved drilldown views. Use app/reports/page.tsx and server/src/routes/reports.ts as anchors. Add server-side schedule CRUD for report exports with org scope and permission checks. Add saved filter presets and restore flow in reports UI. Ensure exports remain permission-gated and add audit events for schedule create/update/delete.",
  },
  {
    feature: "Steward Paths",
    workspace: "DonorCRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Automation records, preset install/toggle, manual runs, run-history filters, retry controls, and diagnostics endpoints are implemented.",
    missingPieces: "Automated backoff tuning and long-term failure trend dashboards still need hardening.",
    nextAction: "Add adaptive retry backoff policies and long-window diagnostics visualization.",
    linkedPlanFile: "PLAN_FILES/phase-06-groups-segments-automation.md",
    priority: "P2",
    successCriteria: "Retry behavior uses adaptive backoff and operators can view 30-day failure trends.",
    copilotPrompt: "Add adaptive retry backoff and long-window diagnostics for steward paths. Extend server/src/routes/automations.ts diagnostics endpoints and worker retry logic to support configurable backoff strategies and max retry thresholds. Update app/automations/page.tsx with 7/30-day failure trend cards and filters. Keep existing retry endpoint behavior and add tests for retry state transitions.",
  },
  {
    feature: "Events & Gala",
    workspace: "Events CRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Event CRUD plus orders, guests, tables, check-in, and reports are live.",
    missingPieces: "Ticket types, sponsors, and public registration workflows are not fully complete.",
    nextAction: "Finish ticket type CRUD and public registration routes.",
    linkedPlanFile: "PLAN_FILES/phase-07-events-and-gala.md",
    priority: "P1",
    successCriteria: "Ticket types and sponsors are fully API-backed in UI, and public registration flow is functional end-to-end.",
    copilotPrompt: "Complete Events CRM partial workflows with real data. Wire sponsors and public registration end-to-end using existing events route structure. Ensure routes under app/events/* no longer rely on scaffold-only views for tickets/sponsors/registration surfaces. Add API handlers in server/src/routes/events.ts (or dedicated events modules) with org and event scoping, then connect UI pages and add smoke coverage for create/list/update happy paths.",
  },
  {
    feature: "Security & Ops Hardening",
    workspace: "Core",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "JWT auth, refresh rotation, rate limiting, and runtime health endpoints are implemented.",
    missingPieces: "CSRF review, full permission coverage, backup/restore runbooks, and alerting remain open.",
    nextAction: "Complete release hardening checklist and publish recovery procedures.",
    linkedPlanFile: "PLAN_FILES/phase-08-security-integrations-ai-ops.md",
    priority: "P0",
    successCriteria: "Security hardening checklist is complete with validated CSRF/RBAC coverage and documented backup/restore operations.",
    copilotPrompt: "Execute production hardening pass for security and operations. Verify and enforce permission coverage on sensitive write/read routes, document CSRF strategy and compensating controls, and add backup/restore runbook docs in docs/status. Add alerting diagnostics hooks for critical failures. Update docs/status/production-readiness-checklist.md with evidence and only allowed status labels.",
  },
  {
    feature: "User Management & Scopes",
    workspace: "Core",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Users API and settings user-management UI support create/update/status/password reset flows.",
    missingPieces: "Granular matrix editing and workspace-level assignment enforcement are still partial.",
    nextAction: "Ship role/scope matrix editor and workspace permission assignment controls.",
    linkedPlanFile: "PLAN_FILES/oyamacrm-onboarding-and-settings-setup-plan.md",
    priority: "P1",
    successCriteria: "Scope assignments are editable and enforced with clear allow/deny behavior in all module shells.",
    copilotPrompt: "Finish user scopes and workspace assignment enforcement. Build editable role/scope controls in settings, persist values, and enforce in shared layout guards and server middleware. Add explicit TODO removal where permission checks are now implemented. Include tests for unauthorized access to compassion and events module routes.",
  },
  {
    feature: "Compassion Workspace",
    workspace: "Compassion CRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Client and appointment workflows plus public scheduling endpoints are implemented.",
    missingPieces: "Deep client-service tabs, stricter privacy enforcement, and wider test coverage are still in progress.",
    nextAction: "Complete client-scoped service tabs and enforce workspace permission checks.",
    linkedPlanFile: "PLAN_FILES/phase-09-compassion-workspace.md",
    priority: "P1",
    successCriteria: "Client service tabs are fully client-scoped with privacy guards and passing happy-path tests.",
    copilotPrompt: "Complete Compassion CRM partial areas with privacy-first guards. Use app/compassion/clients/[clientId] and server/src/routes/compassion.ts as anchors. Ensure each service tab is scoped by clientId, remove scaffold warnings only after endpoint + UI + happy-path test exist, and enforce workspace permissions. Preserve donor/client separation rules and keep SSN stripping behavior intact.",
  },
  {
    feature: "HRM Workspace",
    workspace: "HRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Dashboard, people, scheduling, locations, messages, and settings are API-backed and persisted.",
    missingPieces: "Payroll, time-off policy automation, and richer workforce analytics are not yet implemented.",
    nextAction: "Expand HRM planning scope with payroll/time-off milestones.",
    linkedPlanFile: "docs/OYAMA_HRM.md",
    priority: "P2",
    successCriteria: "HRM has documented and tracked milestones for payroll and time-off automation with initial API contracts.",
    copilotPrompt: "Create implementation-ready HRM milestones for payroll and time-off automation. Update docs/OYAMA_HRM.md with phased deliverables, API contracts, and status labels. Scaffold backend endpoints with TODO backend markers where needed and wire minimal UI placeholders that clearly indicate in-development state.",
  },
  {
    feature: "Integrations Workspace",
    workspace: "Core",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "QuickBooks plugin, site-embed manager, AI runtime settings, and SMTP configuration are wired.",
    missingPieces: "Payment provider connectors, webhook idempotency flows, and unified integration observability are incomplete.",
    nextAction: "Implement first payment/webhook provider with idempotent handlers.",
    linkedPlanFile: "PLAN_FILES/phase-08-security-integrations-ai-ops.md",
    priority: "P0",
    successCriteria: "At least one payment webhook flow is idempotent with replay protection, audit logs, and operator diagnostics.",
    copilotPrompt: "Implement first idempotent payment webhook integration. Add server endpoints with signature verification, idempotency key storage, replay-safe handling, and audit logging. Surface webhook processing status in integrations settings UI. Include failure diagnostics and retry-safe behavior tests.",
  },
  {
    feature: "Validation Pipeline",
    workspace: "Core",
    status: "Broken",
    lastVerified: AUDIT_DATE,
    workingPieces: "Unit coverage and many route-level checks are available.",
    missingPieces: "Typecheck currently fails in tests/smoke/hrm-api-smoke.test.ts and lint lane is too noisy/slow because reference software artifacts are included.",
    nextAction: "Fix the two TypeScript errors and scope lint excludes for reference software artifacts before re-running release gates.",
    linkedPlanFile: "docs/status/production-readiness-checklist.md",
    priority: "P0",
    successCriteria: "pnpm typecheck, pnpm build, and pnpm test:smoke pass together, and lint completes with a bounded project scope.",
    copilotPrompt: "Stabilize release-gate validation lanes. Fix TypeScript errors in tests/smoke/hrm-api-smoke.test.ts where unknown is passed to APIs expecting string or object. Update ESLint scope or ignore config so large reference software build artifacts under REFERANCE_SOFTWARE do not dominate lint runs. Re-run pnpm typecheck, pnpm build, and pnpm test:smoke and update readiness docs with exact outcomes.",
  },
];

export const PRODUCTION_READINESS_CHECKLIST: ReadinessChecklistItem[] = [
  { item: "Authentication is stable", status: "Working", note: "JWT login, refresh rotation, logout, and /me are implemented." },
  { item: "RBAC is enforced server-side", status: "Partially Working", note: "Role and permission checks exist, but coverage is not complete on every sensitive route." },
  { item: "Workspace permissions are enforced", status: "Not Implemented", note: "Module-level workspace policy checks are not yet consistently enforced." },
  { item: "API response envelope is consistent", status: "Partially Working", note: "Most routes use a shared shape, but legacy endpoints still mix response envelopes." },
  { item: "Input validation exists on all write endpoints", status: "Partially Working", note: "Validation exists on many writes, while some routes still rely on database/runtime errors." },
  { item: "Audit logs cover sensitive actions", status: "Partially Working", note: "Audit logging is broadly used, but not every sensitive mutation is fully covered yet." },
  { item: "Database migrations are clean", status: "Partially Working", note: "Migration workflow is active, but rollback and drift verification process is still maturing." },
  { item: "Seed data is reliable", status: "Partially Working", note: "Seed scripts exist and run in dev, but production-safe seed strategy is still in progress." },
  { item: "Error handling is consistent", status: "Partially Working", note: "Global handlers exist, but per-route error consistency is not complete." },
  { item: "Frontend loading/error states exist", status: "Partially Working", note: "Core pages have loading/error handling, while some older workflows still need polish." },
  { item: "No demo-only controls remain in core workflows", status: "Demo Only", note: "Some module surfaces still include scaffold or in-development controls." },
  { item: "Sensitive data is protected", status: "Partially Working", note: "Core auth and module boundaries exist, with additional hardening still required." },
  { item: "Client and donor data separation is enforced", status: "Partially Working", note: "Data models are separated by module, but stronger workspace enforcement is still pending." },
  { item: "Email sending has approval safeguards", status: "Partially Working", note: "Campaign scheduling and suppression checks exist; full approval governance is not complete." },
  { item: "Bulk sends respect opt-outs", status: "Working", note: "Audience suppression removes duplicates, missing emails, and opt-out recipients." },
  { item: "File uploads are permission-gated", status: "Not Implemented", note: "Unified upload permission policy is not implemented across modules." },
  { item: "Public endpoints are rate-limited", status: "Working", note: "Global and auth-specific rate limiting are configured for API protection." },
  { item: "Payment/webhook endpoints are idempotent", status: "Not Implemented", note: "Payment provider webhooks and idempotent replay handling are not yet implemented." },
  { item: "Background jobs have retry/failure handling", status: "Partially Working", note: "In-process workers exist, but durable retries and operations runbooks are incomplete." },
  { item: "Reports are permission-gated", status: "Partially Working", note: "Report routes are active, but deeper scope-level authorization is still in progress." },
  { item: "Exports are permission-gated", status: "Not Implemented", note: "Export workflows and export authorization layer are not complete." },
  { item: "Tests cover critical workflows", status: "Partially Working", note: "Current smoke and e2e checks pass, but broader regression depth and consistency still need expansion." },
  { item: "Lint/type/build pipelines are green", status: "Broken", note: "Build and smoke pass, but typecheck currently fails in tests/smoke/hrm-api-smoke.test.ts and lint scope requires stabilization." },
  { item: "Deployment scripts are documented", status: "Partially Working", note: "PM2 and setup guidance exist, but full release runbook coverage is incomplete." },
  { item: "Environment variables are documented", status: "Partially Working", note: "Env documentation exists, but deployment-grade docs need expansion." },
  { item: "Backup/restore process is documented", status: "Not Implemented", note: "Backup and restore runbooks are still missing." },
  { item: "Version info is visible in the app", status: "Working", note: "Version/build metadata appears in settings and health diagnostics." },
];
