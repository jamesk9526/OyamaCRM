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
}

/** One production-readiness checkpoint and its current audit-backed state. */
export interface ReadinessChecklistItem {
  item: string;
  status: FeatureStatus;
  note: string;
}

export const AUDIT_DATE = "2026-05-11";
export const OVERALL_READINESS_SCORE = 74;

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
    summary: "Latest readiness audit still includes failing build/lint lanes that block a production-ready claim.",
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
    workingPieces: "Task list/create/complete/delete plus timeline logging are implemented.",
    missingPieces: "Template management, bulk assignment, and deeper segment-driven workflows are incomplete.",
    nextAction: "Add stewardship task templates and bulk assignment actions.",
    linkedPlanFile: "PLAN_FILES/phase-04-receipts-tasks-communications.md",
  },
  {
    feature: "Communications & Email Builder",
    workspace: "DonorCRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Campaign builder, preview, test-send, schedule/cancel, and audience suppression checks are live.",
    missingPieces: "Media pipeline, merge-field completeness, and recipient-level compliance workflow depth are missing.",
    nextAction: "Implement media uploads plus communication timeline writeback per recipient.",
    linkedPlanFile: "PLAN_FILES/phase-04-receipts-tasks-communications.md",
  },
  {
    feature: "Dashboard & Reports",
    workspace: "DonorCRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Dashboard summaries and core report endpoints are running with real data.",
    missingPieces: "Export pipelines, drilldowns, and freshness metadata are not complete.",
    nextAction: "Add permission-gated export endpoints and freshness markers.",
    linkedPlanFile: "PLAN_FILES/phase-05-dashboard-and-reports.md",
  },
  {
    feature: "Steward Paths",
    workspace: "DonorCRM",
    status: "Partially Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Automation records, preset install/toggle, manual runs, and worker-based trigger execution are implemented.",
    missingPieces: "Retry/backoff strategy, richer run-history filtering, and support diagnostics are still pending.",
    nextAction: "Add retry queue controls and operations diagnostics.",
    linkedPlanFile: "PLAN_FILES/phase-06-groups-segments-automation.md",
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
  },
  {
    feature: "Validation Pipeline",
    workspace: "Core",
    status: "Broken",
    lastVerified: AUDIT_DATE,
    workingPieces: "Unit coverage and many route-level checks are available.",
    missingPieces: "Lint and build lanes are not all green in the latest release-gate run.",
    nextAction: "Resolve failing suites and restore a clean release-gate matrix before production claim.",
    linkedPlanFile: "docs/status/production-readiness-checklist.md",
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
  { item: "Lint/type/build pipelines are green", status: "Broken", note: "Latest readiness matrix still includes blocking lint/type/build issues." },
  { item: "Deployment scripts are documented", status: "Partially Working", note: "PM2 and setup guidance exist, but full release runbook coverage is incomplete." },
  { item: "Environment variables are documented", status: "Partially Working", note: "Env documentation exists, but deployment-grade docs need expansion." },
  { item: "Backup/restore process is documented", status: "Not Implemented", note: "Backup and restore runbooks are still missing." },
  { item: "Version info is visible in the app", status: "Working", note: "Version/build metadata appears in settings and health diagnostics." },
];
