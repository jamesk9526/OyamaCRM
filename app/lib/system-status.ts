/**
 * System status metadata for the Settings system and readiness pages.
 * This file centralizes safe build/version values and the audit-backed feature matrix.
 */

export type FeatureStatus = "Working" | "Partial" | "Placeholder" | "Not Started" | "Needs Review";

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

export const AUDIT_DATE = "2026-05-09";
export const OVERALL_READINESS_SCORE = 68;

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
export function getFeatureStatusCounts(items: FeatureReadinessItem[] = FEATURE_READINESS) {
  return items.reduce<Record<FeatureStatus, number>>(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    {
      Working: 0,
      Partial: 0,
      Placeholder: 0,
      "Not Started": 0,
      "Needs Review": 0,
    }
  );
}

export const SYSTEM_STATUS_SECTIONS: SystemStatusSection[] = [
  {
    title: "Application Version",
    status: "Working",
    summary: "Version, build, release channel, and audit date are now surfaced in Settings.",
  },
  {
    title: "Database Status",
    status: "Partial",
    summary: "Health probes exist, but smoke tests still fail locally when DATABASE_URL is missing.",
  },
  {
    title: "API Status",
    status: "Working",
    summary: "Express routes and health probes are wired with core donor CRM endpoints available.",
  },
  {
    title: "Authentication Status",
    status: "Working",
    summary: "Login, refresh rotation, logout, /me, and setup gating are implemented.",
  },
  {
    title: "Permission / RBAC Status",
    status: "Partial",
    summary: "Auth and admin protections are broadly in place, but granular scope/workspace authorization is still incomplete.",
  },
  {
    title: "Audit Log Status",
    status: "Working",
    summary: "Audit persistence and settings viewer are implemented; coverage depth still needs expansion.",
  },
  {
    title: "Donor CRM Feature Status",
    status: "Working",
    summary: "Core constituent, donation, campaign, and setup flows have working UI/API paths.",
  },
  {
    title: "Compassion Workspace Feature Status",
    status: "Partial",
    summary: "Compassion module shell and placeholder routes exist, but production data models and APIs are not implemented.",
  },
  {
    title: "Communication / Email Builder Status",
    status: "Partial",
    summary: "Builder, campaign CRUD, preview, test-send, and audience preview exist; media uploads and timeline logging do not.",
  },
  {
    title: "Scheduling Status",
    status: "Placeholder",
    summary: "Scheduling appears in settings plans, but no calendar or booking workflow is implemented.",
  },
  {
    title: "Reports Status",
    status: "Partial",
    summary: "Summary/report endpoints exist, but advanced widgets, exports, and freshness tracking remain incomplete.",
  },
  {
    title: "Steward Paths Status",
    status: "Partial",
    summary: "Steward Paths records, presets, and trigger-driven execution are wired for core donor workflows (donation/constituent events).",
  },
  {
    title: "Events / Gala Status",
    status: "Partial",
    summary: "Core event operations (orders, guests, tables, check-in, reports) are live; ticketing/sponsor/public registration remain partial.",
  },
  {
    title: "Integrations Status",
    status: "Placeholder",
    summary: "Integrations settings route exists only as a placeholder with no provider connections.",
  },
  {
    title: "AI / GPU Status",
    status: "Not Started",
    summary: "AI appears in plans only; no provider integration or guarded AI workflows are implemented.",
  },
];

export const FEATURE_READINESS: FeatureReadinessItem[] = [
  {
    feature: "Auth & Setup",
    workspace: "Core",
    status: "Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Login, refresh, logout, /me, setup status and completion flow, login redirect to /setup.",
    missingPieces: "Scope-based RBAC and broader protected-route enforcement.",
    nextAction: "Finish permission middleware adoption across write and sensitive read endpoints.",
    linkedPlanFile: "PLAN_FILES/phase-01-foundation-and-auth.md",
  },
  {
    feature: "Settings Workspace",
    workspace: "Core",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Dedicated settings layout/sidebar, organization settings form, new system/system-status pages.",
    missingPieces: "Users, roles, audit viewer, security, integrations, and workspace settings are still placeholders.",
    nextAction: "Implement user/role management and audit log viewer with server-side permissions.",
    linkedPlanFile: "PLAN_FILES/oyamacrm-onboarding-and-settings-setup-plan.md",
  },
  {
    feature: "Constituents",
    workspace: "OyamaCRM",
    status: "Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "List, search, create, edit, detail, timeline activity writes, household panel.",
    missingPieces: "CSV import, dedupe, custom fields, bulk edit, segment builder.",
    nextAction: "Build import and dedupe workflows before broader production rollout.",
    linkedPlanFile: "PLAN_FILES/phase-02-constituents-and-timeline.md",
  },
  {
    feature: "Donations & Campaigns",
    workspace: "OyamaCRM",
    status: "Working",
    lastVerified: AUDIT_DATE,
    workingPieces: "Donation CRUD, campaign CRUD, designation support, recurring flags, summary reporting hooks.",
    missingPieces: "Receipt generation, pledges UI, refunds/chargebacks, in-kind valuation, soft credits.",
    nextAction: "Implement receipt and acknowledgment workflows tied to communication history.",
    linkedPlanFile: "PLAN_FILES/phase-03-donations-funds-campaigns.md",
  },
  {
    feature: "Tasks & Stewardship",
    workspace: "OyamaCRM",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Task list, create, complete, delete, and activity logging on PATCH.",
    missingPieces: "Inline editing, templates, bulk creation, workflow automation from segments.",
    nextAction: "Add stewardship task templates and inline task editing.",
    linkedPlanFile: "PLAN_FILES/phase-04-receipts-tasks-communications.md",
  },
  {
    feature: "Communications & Email Builder",
    workspace: "OyamaCRM",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Email builder route, block canvas, campaign CRUD, preview/test send/schedule/cancel, audience preview and suppression logic.",
    missingPieces: "Media library, attachments, merge fields, hosted video workflow, timeline logging, provider tracking, permissions.",
    nextAction: "Implement media/upload infrastructure and campaign-to-constituent communication history.",
    linkedPlanFile: "PLAN_FILES/phase-04-receipts-tasks-communications.md",
  },
  {
    feature: "Dashboard & Reports",
    workspace: "OyamaCRM",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Dashboard shell, summary endpoint, top-donor and giving trend style report endpoints.",
    missingPieces: "Export workflows, cache freshness, advanced widgets, retention drilldowns.",
    nextAction: "Add data freshness metadata and export endpoints with permission checks.",
    linkedPlanFile: "PLAN_FILES/phase-05-dashboard-and-reports.md",
  },
  {
    feature: "Steward Paths",
    workspace: "OyamaCRM",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Steward Path records, preset install, toggle, manual runs, run-history API/UI, and action execution for donation/constituent/task-due/pledge-timeline triggers.",
    missingPieces: "Retry/backoff strategy, richer filtering/export for run history, and segment-driven triggers.",
    nextAction: "Add retry queues and expose worker diagnostics/actions in settings for operations teams.",
    linkedPlanFile: "PLAN_FILES/phase-06-groups-segments-automation.md",
  },
  {
    feature: "Events & Gala",
    workspace: "OyamaCRM",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Event CRUD plus orders, guests, tables, check-in, dashboard summary, and report endpoints.",
    missingPieces: "Public ticket registration pages, ticket type management, sponsor workflows, and several scaffold-only module pages.",
    nextAction: "Implement ticket type CRUD and public registration flows, then replace scaffolded Events workspace pages.",
    linkedPlanFile: "PLAN_FILES/phase-07-events-and-gala.md",
  },
  {
    feature: "Security & Ops Hardening",
    workspace: "Core",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "bcrypt hashing, JWT auth, refresh token rotation, rate limiting, health endpoint, PM2 config.",
    missingPieces: "CSRF review, permission coverage, audit viewer, backup/restore docs, and richer queue monitoring/alerts.",
    nextAction: "Complete RBAC rollout and document deployment/backup procedures.",
    linkedPlanFile: "PLAN_FILES/phase-08-security-integrations-ai-ops.md",
  },
  {
    feature: "User Management & Scopes",
    workspace: "Core",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Users API and settings user-management UI with create/update/status/password reset.",
    missingPieces: "Granular scopes matrix editor and workspace assignment controls.",
    nextAction: "Implement roles/scopes matrix editor and workspace-level permission assignments.",
    linkedPlanFile: "PLAN_FILES/oyamacrm-onboarding-and-settings-setup-plan.md",
  },
  {
    feature: "Compassion Workspace",
    workspace: "Compassion",
    status: "Partial",
    lastVerified: AUDIT_DATE,
    workingPieces: "Compassion route group, module shell, and placeholder dashboard/routes.",
    missingPieces: "Client-care models, API routes, real dashboard data, and workspace-specific authorization.",
    nextAction: "Build core Compassion schema and CRUD APIs, then replace placeholder routes incrementally.",
    linkedPlanFile: "PLAN_FILES/phase-09-compassion-workspace.md",
  },
  {
    feature: "Integrations & AI",
    workspace: "Core",
    status: "Not Started",
    lastVerified: AUDIT_DATE,
    workingPieces: "Settings placeholders and planning docs.",
    missingPieces: "Payment integrations, multi-provider email abstraction, AI provider abstraction, durable queue retries/history, webhook handling.",
    nextAction: "Choose first integration targets and add guarded provider abstractions.",
    linkedPlanFile: "PLAN_FILES/phase-08-security-integrations-ai-ops.md",
  },
];

export const PRODUCTION_READINESS_CHECKLIST: ReadinessChecklistItem[] = [
  { item: "Authentication is stable", status: "Working", note: "JWT login, refresh rotation, logout, and /me are implemented." },
  { item: "RBAC is enforced server-side", status: "Partial", note: "Auth/admin enforcement is broadly applied, but granular scopes/workspace policy checks are still incomplete." },
  { item: "Workspace permissions are enforced", status: "Not Started", note: "No donor/compassion workspace enforcement exists yet." },
  { item: "API response envelope is consistent", status: "Partial", note: "Some routes return `{ data }`, while others return raw payloads." },
  { item: "Input validation exists on all write endpoints", status: "Partial", note: "Some write routes validate basics; many rely on Prisma errors." },
  { item: "Audit logs cover sensitive actions", status: "Working", note: "Audit log route/viewer are live; continue broadening entity coverage as new modules ship." },
  { item: "Database migrations are clean", status: "Partial", note: "Migrations directory is present; consistency and rollback verification still need expansion." },
  { item: "Seed data is reliable", status: "Partial", note: "Seed script exists, but smoke tests depend on DATABASE_URL being configured." },
  { item: "Error handling is consistent", status: "Partial", note: "Global handlers exist, though many routes still return mixed response shapes." },
  { item: "Frontend loading/error states exist", status: "Partial", note: "Core forms/pages include loading states, but many placeholders remain." },
  { item: "No placeholder buttons remain in core flows", status: "Placeholder", note: "Settings, reports, events, and data tools still use placeholder routes." },
  { item: "Sensitive data is protected", status: "Partial", note: "Core auth exists, but scope-based access and compassion separation are unfinished." },
  { item: "Client/donor data separation is enforced", status: "Not Started", note: "Compassion workspace is planned only." },
  { item: "Email sending has approval safeguards", status: "Partial", note: "Audience preview and test-send exist; approval workflows and unsubscribe compliance do not." },
  { item: "Bulk sends respect opt-outs", status: "Working", note: "Audience preview/send paths exclude opt-outs, missing emails, and duplicates." },
  { item: "File uploads are permission-gated", status: "Not Started", note: "Media/file upload flows are not implemented yet." },
  { item: "Public endpoints are rate-limited", status: "Working", note: "Global and auth-specific rate limiting are configured in Express." },
  { item: "Payment/webhook endpoints are idempotent", status: "Not Started", note: "Payment/webhook integrations are not implemented." },
  { item: "Background jobs have retry/failure handling", status: "Partial", note: "In-process email queue worker dispatches scheduled campaigns, but durable retries and failure runbooks are still incomplete." },
  { item: "Reports are permission-gated", status: "Partial", note: "Reports exist, but no scope-specific backend guards are enforced." },
  { item: "Exports are permission-gated", status: "Not Started", note: "Export features are not implemented." },
  { item: "Tests cover critical workflows", status: "Partial", note: "Good unit coverage exists; smoke tests require DATABASE_URL and there is no E2E suite." },
  { item: "Deployment scripts are documented", status: "Partial", note: "PM2 config exists, but production runbook and recovery notes are missing." },
  { item: "Environment variables are documented", status: "Partial", note: "A new `.env.example` documents required variables, but deployment docs remain light." },
  { item: "Backup/restore process is documented", status: "Not Started", note: "No backup or restore instructions were found." },
  { item: "Version info is visible in the app", status: "Working", note: "Settings → System and Settings → System Status now surface version metadata." },
];
