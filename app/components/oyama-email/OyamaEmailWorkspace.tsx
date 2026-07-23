"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import OyamaEmailBuilderWorkspace from "@/app/components/oyama-email/OyamaEmailBuilderWorkspace";
import { InfoTooltip, WorkspaceHint } from "@/app/components/workspace/WorkspaceHelp";
import type {
  OyamaEmailCampaign,
  OyamaEmailConstituent,
  OyamaEmailRecipientList,
  OyamaEmailStats,
  OyamaEmailView,
  OyamaEmailWorkspaceProps,
} from "@/app/components/oyama-email/types";

const SIDEBAR_ITEMS: Array<{ label: string; href: string; view?: OyamaEmailView; matchPrefix?: string }> = [
  { label: "Templates", href: "/oyama-email/templates", view: "templates" },
  { label: "Campaign Workflow", href: "/oyama-email/campaigns", view: "campaigns" },
  { label: "Email Queue", href: "/oyama-email/queue", view: "queue" },
  { label: "Calendar", href: "/oyama-email/calendar", view: "callender", matchPrefix: "/oyama-email/cal" },
  { label: "Docs & Walkthroughs", href: "/oyama-email/docs", view: "docs" },
  { label: "Settings", href: "/oyama-email/settings", view: "settings" },
];

type CampaignWorkspaceTab = "overview" | "audience" | "queue" | "analytics" | "activity" | "settings";

const CAMPAIGN_WORKSPACE_TABS: Array<{ id: CampaignWorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "audience", label: "Audience" },
  { id: "queue", label: "Queue" },
  { id: "analytics", label: "Analytics" },
  { id: "activity", label: "Activity Log" },
  { id: "settings", label: "Settings" },
];

const CAMPAIGN_FILTER_CHIPS = [
  "ALL",
  "DRAFT",
  "NEEDS_REVIEW",
  "READY",
  "SCHEDULED",
  "QUEUED",
  "SENDING",
  "SENT",
  "FAILED",
  "CANCELLED",
  "ARCHIVED",
] as const;

const CAMPAIGN_SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "updatedAt", label: "Updated Date" },
  { value: "scheduledAt", label: "Scheduled Date" },
  { value: "sentAt", label: "Sent Date" },
  { value: "openRate", label: "Open Rate" },
  { value: "clickRate", label: "Click Rate" },
  { value: "audienceSize", label: "Audience Size" },
];

const CAMPAIGN_EMAIL_TYPE_OPTIONS = [
  "Marketing / Newsletter",
  "Fundraising Appeal",
  "Event Email",
  "Donor Stewardship",
  "Receipt / Acknowledgment",
  "Transactional / Relationship",
  "Internal Test",
] as const;

const CAMPAIGN_AUDIENCE_SOURCES = [
  "Saved Lists",
  "Segments",
  "Tags",
  "Donor Status",
  "Campaign Donors",
  "Event Attendees",
  "Monthly Donors",
  "Lapsed Donors",
  "Major Donors",
  "Steward Path Enrollment",
  "Manual Recipients",
  "Individual Search",
] as const;

const PRIMARY_CAMPAIGN_AUDIENCE_SOURCES: Array<(typeof CAMPAIGN_AUDIENCE_SOURCES)[number]> = [
  "Saved Lists",
  "Individual Search",
  "Monthly Donors",
  "Lapsed Donors",
];

const ADVANCED_CAMPAIGN_AUDIENCE_SOURCES: Array<(typeof CAMPAIGN_AUDIENCE_SOURCES)[number]> = CAMPAIGN_AUDIENCE_SOURCES.filter(
  (source) => !PRIMARY_CAMPAIGN_AUDIENCE_SOURCES.includes(source),
);

const CAMPAIGN_AUDIENCE_SOURCE_HELP: Record<(typeof CAMPAIGN_AUDIENCE_SOURCES)[number], string> = {
  "Saved Lists": "Use a reusable list when this audience should stay consistent across future sends.",
  "Segments": "Use CRM-defined segment logic when the send should follow a live donor grouping.",
  "Tags": "Use constituent tags when staff already curates the group with tags.",
  "Donor Status": "Target donors by CRM lifecycle or status buckets.",
  "Campaign Donors": "Use donors linked to prior campaign activity.",
  "Event Attendees": "Use event-linked recipients.",
  "Monthly Donors": "Fast path for recurring monthly donors.",
  "Lapsed Donors": "Fast path for re-engagement outreach.",
  "Major Donors": "Fast path for high-touch giving audiences.",
  "Steward Path Enrollment": "Use a stewardship-program audience rather than one-off picks.",
  "Manual Recipients": "Paste exact email addresses when you already know the send list.",
  "Individual Search": "Search and check specific constituents when this is a one-off or temporary audience.",
};

interface DeliveryEventRow {
  id: string;
  recipientEmail: string;
  eventType: string;
  eventAt: string;
  metadata?: Record<string, unknown> | null;
}

interface DeliveryEventsPayload {
  summary: {
    eligibleRecipients: number;
    processedRecipients: number;
    sendProgressPercent: number;
    queued: number;
    sending: number;
    accepted: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    suppressed: number;
    unsubscribed: number;
    cancelled: number;
    remaining: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  diagnostics?: {
    providerWebhookConfigured?: boolean;
    lastEventAt?: string | null;
    totalEvents?: number;
    uniqueRecipients?: number;
  };
  events: DeliveryEventRow[];
}

interface TemporaryEmailSegment {
  name: string;
  recipientEmails: string[];
  donationIds?: string[];
  createdAt?: string;
  source?: string;
}

type WorkflowHelpTopic = "email-workflow" | "email-audience" | "letters-recipients";

interface CampaignQueueRow {
  recipientLabel: string;
  email: string;
  status: string;
  lastEvent: string;
  attemptCount: string;
  providerResponse: string;
  queuedAt: string;
  sendingStartedAt: string;
  sentAt: string;
  deliveredAt: string;
  openedAt: string;
  clickedAt: string;
  bouncedAt: string;
  unsubscribedAt: string;
  failureReason: string;
}

interface CampaignLiveSnapshot {
  campaignId: string;
  delivery: DeliveryEventsPayload | null;
  activity: CampaignActivityRow[];
  queueRows: CampaignQueueRow[];
}

interface CampaignActivityRow {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface CampaignAudiencePreviewResponse {
  audience: {
    totalMatched: number;
    validEmail: number;
    missingEmail: number;
    optedOut: number;
    duplicateEmails: number;
    suppressionCount: number;
    categoryOptOut: number;
    doNotContact: number;
    invalidEmail: number;
    suppressed: number;
    finalSendCount: number;
  };
}

interface CampaignValidationResponse {
  valid: boolean;
  checks: Array<{
    key: string;
    label: string;
    passed: boolean;
    detail: string;
    blocking: boolean;
  }>;
  blockers: string[];
  audience: CampaignAudiencePreviewResponse["audience"];
}

type CampaignActionDialogKind =
  | "schedule"
  | "unschedule"
  | "sendNow"
  | "sendTest"
  | "archive"
  | "cancelRemaining";

interface CampaignActionDialogState {
  kind: CampaignActionDialogKind;
  email: string;
  scheduledAt: string;
}

interface CampaignCalendarEvent {
  id: string;
  campaignId: string;
  campaignName: string;
  status: string;
  at: string;
  kind: "scheduled" | "sent";
  draggable: boolean;
}

interface CampaignCalendarDraft {
  campaignId: string;
  campaignName: string;
  subject?: string | null;
  status: string;
  updatedAt: string;
  audienceCount: number;
}

interface CampaignCalendarResponse {
  range: {
    from: string | null;
    to: string | null;
  };
  events: CampaignCalendarEvent[];
  unscheduledDrafts: CampaignCalendarDraft[];
}

const BUILDER_PLACEHOLDER_HTML = [
  "<section style=\"padding:24px 24px 18px;border-bottom:1px solid #dbe5df;background:#f4faf6;\">",
  "<h1 style=\"margin:0;font-size:34px;line-height:1.2;color:#0d3b2a;\">Thank You, {{ donor.firstName }}!</h1>",
  "<p style=\"margin:14px 0 0;font-size:16px;line-height:1.6;color:#1f4335;\">Because of friends like you, we are able to continue practical care and lasting hope in our community.</p>",
  "</section>",
  "<section style=\"padding:24px;\">",
  "<p style=\"font-size:16px;line-height:1.7;color:#243d32;\">Your generosity changes lives. Thank you for standing with us.</p>",
  "<p style=\"margin-top:22px;font-size:16px;line-height:1.7;color:#243d32;\">With gratitude,<br />Oyama Team</p>",
  "</section>",
].join("");

interface BuilderDraft {
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  bodyHtml: string;
  status: string;
  preparationStatus: "NOT_STARTED" | "DRAFT" | "READY";
}

const EMPTY_DRAFT: BuilderDraft = {
  name: "",
  subject: "",
  previewText: "",
  fromName: "",
  fromEmail: "",
  replyToEmail: "",
  bodyHtml: BUILDER_PLACEHOLDER_HTML,
  status: "DRAFT",
  preparationStatus: "DRAFT",
};

const SOURCE_OPTIONS = [
  "Individual Recipients",
  "Saved Search / List",
  "Segments / Tags",
  "Campaign Donors",
  "Event Attendees",
  "Monthly Donors",
  "Lapsed Donors (12+ months)",
  "Steward Path Enrollment",
] as const;

const WIZARD_STEPS: Array<{ step: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { step: 1, label: "Template" },
  { step: 2, label: "Audience" },
  { step: 3, label: "Details" },
  { step: 4, label: "Review" },
  { step: 5, label: "Send" },
];

export default function OyamaEmailWorkspace({ view = "templates", templateId, campaignId }: OyamaEmailWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [campaigns, setCampaigns] = useState<OyamaEmailCampaign[]>([]);
  const [templates, setTemplates] = useState<OyamaEmailCampaign[]>([]);
  const [stats, setStats] = useState<OyamaEmailStats | null>(null);
  const [lists, setLists] = useState<OyamaEmailRecipientList[]>([]);
  const [constituents, setConstituents] = useState<OyamaEmailConstituent[]>([]);
  const [focusedCampaign, setFocusedCampaign] = useState<OyamaEmailCampaign | null>(null);

  const [builderDraft, setBuilderDraft] = useState<BuilderDraft>(EMPTY_DRAFT);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [sourceOption, setSourceOption] = useState<(typeof SOURCE_OPTIONS)[number]>("Individual Recipients");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testSendDialogOpen, setTestSendDialogOpen] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");

  const normalizedView: OyamaEmailView = view === "send" || view === "audience" || view === "analytics"
    ? "campaigns"
    : view;

  const initialCampaignTab: CampaignWorkspaceTab = useMemo(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab && CAMPAIGN_WORKSPACE_TABS.some((tab) => tab.id === queryTab)) {
      return queryTab as CampaignWorkspaceTab;
    }
    if (view === "audience") return "audience";
    if (view === "queue") return "queue";
    if (view === "analytics") return "analytics";
    return "overview";
  }, [searchParams, view]);

  const wizardPageMode = pathname.startsWith("/oyama-email/campaigns/new");
  const openCampaignWizard = wizardPageMode || searchParams.get("mode") === "new" || view === "send";
  const preferredTemplateId = searchParams.get("templateId") || null;
  const temporarySegmentId = searchParams.get("temporarySegmentId") || null;

  const targetCampaignId = templateId || campaignId || searchParams.get("templateId") || null;
  const templateRows = templates;
  const sendRecordRows = useMemo(() => campaigns.filter((row) => !isReusableEmailTemplate(row)), [campaigns]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignRows, templateRowsResponse, statsRow, listRows, constituentRows] = await Promise.all([
        apiFetch<OyamaEmailCampaign[]>("/api/email-campaigns?limit=100"),
        apiFetch<OyamaEmailCampaign[]>("/api/oyama-email/templates?limit=100"),
        apiFetch<OyamaEmailStats>("/api/email-campaigns/stats").catch(() => null),
        apiFetch<OyamaEmailRecipientList[]>("/api/email-campaigns/lists").catch(() => []),
        apiFetch<OyamaEmailConstituent[]>("/api/constituents?limit=all").catch(() => []),
      ]);
      setCampaigns(campaignRows);
      setTemplates(templateRowsResponse);
      setStats(statsRow);
      setLists(listRows);
      setConstituents(constituentRows);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load OyamaEmail workspace.");
      setCampaigns([]);
      setTemplates([]);
      setStats(null);
      setLists([]);
      setConstituents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTemplateRows = useCallback(async () => {
    try {
      setTemplates(await apiFetch<OyamaEmailCampaign[]>("/api/oyama-email/templates?limit=100"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to refresh email templates.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!targetCampaignId) {
      setFocusedCampaign(null);
      setBuilderDraft((prev) => ({
        ...prev,
        fromName: prev.fromName || "Oyama Ministries",
      }));
      return;
    }

    const fromCollection = templates.find((row) => row.id === targetCampaignId)
      ?? campaigns.find((row) => row.id === targetCampaignId)
      ?? null;
    if (fromCollection) {
      setFocusedCampaign(fromCollection);
      return;
    }

    let cancelled = false;
    void apiFetch<OyamaEmailCampaign>(`/api/email-campaigns/${targetCampaignId}`)
      .then((row) => {
        if (!cancelled) setFocusedCampaign(row);
      })
      .catch(() => {
        if (!cancelled) setFocusedCampaign(null);
      });

    return () => {
      cancelled = true;
    };
  }, [campaigns, targetCampaignId, templates]);

  useEffect(() => {
    if (!focusedCampaign) {
      setBuilderDraft((prev) => ({
        ...prev,
        name: prev.name || "",
        fromName: prev.fromName || "Oyama Ministries",
      }));
      return;
    }

    setBuilderDraft({
      name: focusedCampaign.name || "",
      subject: focusedCampaign.subject || "",
      previewText: focusedCampaign.previewText || "",
      fromName: focusedCampaign.fromName || "Oyama Ministries",
      fromEmail: focusedCampaign.fromEmail || "",
      replyToEmail: focusedCampaign.replyToEmail || "",
      bodyHtml: focusedCampaign.bodyHtml || BUILDER_PLACEHOLDER_HTML,
      status: focusedCampaign.status || "DRAFT",
      preparationStatus: focusedCampaign.preparationStatus || "DRAFT",
    });
  }, [focusedCampaign]);

  const selectedCampaign = useMemo(() => {
    if (focusedCampaign) return focusedCampaign;
    if (!targetCampaignId) return null;
    return templates.find((row) => row.id === targetCampaignId)
      ?? campaigns.find((row) => row.id === targetCampaignId)
      ?? null;
  }, [campaigns, focusedCampaign, targetCampaignId, templates]);

  const selectedRecipients = useMemo(() => {
    const byId = new Map(constituents.map((row) => [row.id, row]));
    return selectedRecipientIds
      .map((id) => byId.get(id))
      .filter((row): row is OyamaEmailConstituent => Boolean(row));
  }, [constituents, selectedRecipientIds]);

  const recipientRows = useMemo(() => {
    const needle = recipientSearch.trim().toLowerCase();
    return constituents
      .filter((row) => {
        if (!needle) return true;
        return [row.firstName, row.lastName, row.email].join(" ").toLowerCase().includes(needle);
      })
      .slice(0, 180);
  }, [constituents, recipientSearch]);

  const recipientSummary = useMemo(() => {
    const emails = selectedRecipients.map((row) => (row.email || "").trim().toLowerCase()).filter(Boolean);
    const duplicateEmails = emails.length - new Set(emails).size;
    const missingEmail = selectedRecipients.filter((row) => !row.email?.trim()).length;
    const doNotEmail = selectedRecipients.filter((row) => Boolean(row.doNotEmail)).length;
    const unsubscribed = selectedRecipients.filter((row) => Boolean(row.emailOptOut)).length;
    const suppressed = selectedRecipients.filter((row) => Boolean(row.doNotContact)).length;
    const valid = selectedRecipients.filter((row) => {
      const email = row.email?.trim();
      if (!email) return false;
      if (row.doNotEmail || row.emailOptOut || row.doNotContact) return false;
      return /.+@.+\..+/.test(email);
    }).length;

    return {
      total: selectedRecipients.length,
      valid,
      missingEmail,
      unsubscribed,
      doNotEmail,
      suppressed,
      duplicatesRemoved: duplicateEmails,
    };
  }, [selectedRecipients]);

  async function saveDraft() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: builderDraft.name || "Untitled Email",
        subject: builderDraft.subject,
        previewText: builderDraft.previewText,
        fromName: builderDraft.fromName,
        fromEmail: builderDraft.fromEmail,
        replyToEmail: builderDraft.replyToEmail,
        bodyHtml: builderDraft.bodyHtml,
        bodyText: htmlToText(builderDraft.bodyHtml),
        preparationStatus: builderDraft.preparationStatus,
        status: "DRAFT",
      };

      let saved: OyamaEmailCampaign;
      if (selectedCampaign?.id) {
        saved = await apiFetch<OyamaEmailCampaign>(`/api/email-campaigns/${selectedCampaign.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        saved = await apiFetch<OyamaEmailCampaign>("/api/email-campaigns", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setNotice("Draft saved in OyamaEmail.");
      await load();
      if (!selectedCampaign?.id) {
        router.push(`/oyama-email/templates/${saved.id}/builder`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save email draft.");
    } finally {
      setSaving(false);
    }
  }

  function openTestSendDialog() {
    if (!selectedCampaign?.id) {
      setError("Save this template before sending a test email.");
      return;
    }
    setError(null);
    setTestRecipientEmail(builderDraft.replyToEmail || builderDraft.fromEmail || "");
    setTestSendDialogOpen(true);
  }

  async function sendTest(toEmail: string): Promise<boolean> {
    const recipient = toEmail.trim();
    if (!selectedCampaign?.id) {
      setError("Save this template before sending a test email.");
      return false;
    }
    if (!/.+@.+\..+/.test(recipient)) {
      setError("Enter a valid test recipient email address.");
      return false;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/email-campaigns/${selectedCampaign.id}/send-test`, {
        method: "POST",
        body: JSON.stringify({ toEmail: recipient }),
      });
      setNotice(`Test email sent to ${recipient}.`);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send test email.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publishTemplate() {
    if (!selectedCampaign?.id) {
      setError("Save this template before publishing.");
      return;
    }

    const blockers = complianceChecks(builderDraft).filter((row) => row.required && !row.passed);
    if (blockers.length > 0) {
      setError(`Resolve ${blockers.length} required compliance ${blockers.length === 1 ? "check" : "checks"} before marking this template Ready.`);
      setNotice(null);
      return;
    }
    logEmailPublishDiagnostics({
      stage: "before-publish",
      campaign: selectedCampaign,
      draft: builderDraft,
      validationIssues: blockers,
    });

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<OyamaEmailCampaign>(`/api/email-campaigns/${selectedCampaign.id}`, {
        method: "PUT",
        body: JSON.stringify({
          preparationStatus: "READY",
          status: "DRAFT",
        }),
      });
      logEmailPublishDiagnostics({
        stage: "after-publish",
        campaign: result,
        draft: { ...builderDraft, bodyHtml: result.bodyHtml || builderDraft.bodyHtml },
        validationIssues: blockers,
      });
      setNotice("Template marked Ready in publish workflow.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to publish template.");
    } finally {
      setSaving(false);
    }
  }

  function toggleRecipient(id: string) {
    setSelectedRecipientIds((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
  }

  function setSendTemplate(template: OyamaEmailCampaign) {
    router.push(`/oyama-email/campaigns/new?templateId=${template.id}`);
  }

  return (
    <div className="min-h-[100dvh] bg-[#f5f7fa] text-slate-900">
      <div className="flex min-h-[100dvh]">
        <OyamaEmailSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
          pathname={pathname}
          activeView={normalizedView}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {normalizedView !== "builder" ? (
            <OyamaEmailMobileNav pathname={pathname} activeView={normalizedView} />
          ) : null}
          {normalizedView !== "builder" ? <OyamaEmailTopBar view={normalizedView} targetCampaign={selectedCampaign} /> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}

          {loading ? <LoadingState label="Loading OyamaEmail workspace..." /> : null}
          {!loading && normalizedView === "templates" ? (
            <TemplatesView campaigns={templateRows} onUseTemplate={setSendTemplate} onTemplatesChanged={refreshTemplateRows} />
          ) : null}
          {!loading && normalizedView === "queue" ? (
            <EmailQueueView campaigns={sendRecordRows} />
          ) : null}
          {!loading && normalizedView === "builder" ? (
            <BuilderView templateId={templateId} />
          ) : null}
          {!loading && normalizedView === "publish" ? (
            <PublishView
              draft={builderDraft}
              campaign={selectedCampaign}
              saving={saving}
              onSave={saveDraft}
              onSendTest={openTestSendDialog}
              onPublish={publishTemplate}
            />
          ) : null}
          {!loading && (normalizedView === "campaigns" || normalizedView === "callender") ? (
            <CampaignsView
              campaigns={sendRecordRows}
              stats={stats}
              focusedCampaignId={campaignId ?? null}
              initialTab={initialCampaignTab}
              initialViewMode={normalizedView === "callender" ? "calendar" : "board"}
              calendarOnly={normalizedView === "callender"}
              openWizard={openCampaignWizard}
              wizardPageMode={wizardPageMode}
              preferredTemplateId={preferredTemplateId}
              temporarySegmentId={temporarySegmentId}
              constituents={constituents}
              lists={lists}
              templates={templateRows}
              onRefresh={load}
            />
          ) : null}
          {!loading && normalizedView === "settings" ? (
            <SettingsView />
          ) : null}
          {!loading && normalizedView === "docs" ? (
            <EmailDocsView />
          ) : null}
          {testSendDialogOpen ? (
            <TestSendDialog
              email={testRecipientEmail}
              saving={saving}
              onChange={setTestRecipientEmail}
              onClose={() => setTestSendDialogOpen(false)}
              onSend={sendTest}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OyamaEmailMobileNav({ pathname, activeView }: { pathname: string; activeView: OyamaEmailView }) {
  return (
    <div className="sticky top-0 z-40 border-b border-emerald-900/30 bg-[#06291f] px-3 py-2 text-white shadow-lg lg:hidden">
      <div className="flex items-center gap-3">
        <Link href="/oyama-email" className="flex shrink-0 items-center gap-2">
          <EmailLogo className="h-9 w-9" />
          <span className="text-sm font-semibold tracking-wide">OYAMA EMAIL</span>
        </Link>
        <Link href="/" className="ml-auto shrink-0 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-50">
          Back
        </Link>
      </div>
      <nav className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Oyama Email mobile navigation">
        {SIDEBAR_ITEMS.map((item) => {
          const active = Boolean(item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname.startsWith(item.href))
            || Boolean(item.view && activeView === item.view);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
                active ? "border-emerald-300 bg-emerald-500/80 text-white" : "border-white/15 bg-white/10 text-emerald-50",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function OyamaEmailSidebar({
  collapsed,
  onToggle,
  pathname,
  activeView,
}: {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
  activeView: OyamaEmailView;
}) {
  return (
    <aside className={[
      "hidden shrink-0 flex-col bg-[radial-gradient(circle_at_20%_0%,#0b6c3a_0,#05402d_44%,#04271f_100%)] text-white shadow-xl transition-[width,padding] duration-300 lg:flex",
      collapsed ? "w-[88px] px-2 py-3" : "w-[248px] px-3 py-4",
    ].join(" ")}>
      <div className={[
        "flex items-center rounded-2xl border border-white/15 bg-white/5",
        collapsed ? "justify-center p-3" : "justify-between px-4 py-3",
      ].join(" ")}>
        <Link href="/oyama-email" className={["flex items-center", collapsed ? "justify-center" : "gap-3"].join(" ")}>
          <EmailLogo className={collapsed ? "h-10 w-10" : "h-11 w-11"} />
          {!collapsed ? (
            <div>
              <p className="text-[27px] leading-none font-semibold tracking-tight">OYAMA</p>
              <p className="-mt-0.5 text-[13px] tracking-[0.22em] text-emerald-100">EMAIL</p>
            </div>
          ) : null}
        </Link>
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft />
          </button>
        ) : null}
      </div>

      <nav className={[
        "flex-1 space-y-1.5 overflow-y-auto",
        collapsed ? "mt-3" : "mt-4",
      ].join(" ")}>
        {SIDEBAR_ITEMS.map((item) => {
          const active = Boolean(item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname.startsWith(item.href))
            || Boolean(item.view && activeView === item.view);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={[
                "flex h-11 items-center rounded-2xl px-3 text-sm font-semibold transition",
                collapsed ? "justify-center" : "gap-3",
                active ? "bg-emerald-500/70 text-white shadow-inner" : "text-emerald-50 hover:bg-white/10",
              ].join(" ")}
            >
              <SideIcon label={item.label} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3">
        <Link href="/" className={["mt-3 flex items-center rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-emerald-50 hover:bg-white/20", collapsed ? "h-10 w-10 justify-center self-center" : "gap-2 px-3 py-2"].join(" ")}>
          <ChevronLeft />
          {!collapsed ? <span>Back to CRM</span> : null}
        </Link>

        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="mx-auto mt-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight />
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function OyamaEmailTopBar({ view, targetCampaign }: { view: OyamaEmailView; targetCampaign: OyamaEmailCampaign | null }) {
  return (
    <header className="z-30 border-b border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-4 lg:sticky lg:top-0 xl:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[31px]">{workspaceTitle(view)}</p>
          <p className="text-sm text-slate-600">{workspaceSubtitle(view, targetCampaign)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <WorkspaceAction href="/" tone="default">Back to CRM</WorkspaceAction>
          {view === "builder" ? (
            <WorkspaceAction href={targetCampaign?.id ? `/oyama-email/templates/${targetCampaign.id}/publish` : "/oyama-email/templates/new"} tone="primary">Next: Publish &amp; Compliance</WorkspaceAction>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function TemplatesView({
  campaigns,
  onUseTemplate,
  onTemplatesChanged,
}: {
  campaigns: OyamaEmailCampaign[];
  onUseTemplate: (template: OyamaEmailCampaign) => void;
  onTemplatesChanged: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Templates");
  const [ownership, setOwnership] = useState<"MINE" | "SHARED" | "ALL">("ALL");
  const [provenance, setProvenance] = useState<"ALL" | "HUMAN" | "AI">("ALL");
  const [categorySort, setCategorySort] = useState<"default" | "count">("default");
  const [sortBy, setSortBy] = useState<"updatedDesc" | "updatedAsc" | "usedDesc" | "nameAsc">("updatedDesc");
  const [page, setPage] = useState(1);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const pageSize = 8;
  const myCount = useMemo(() => campaigns.filter((row) => row.ownerId === user?.id).length, [campaigns, user?.id]);
  const sharedCount = useMemo(() => campaigns.filter((row) => row.ownerId !== user?.id).length, [campaigns, user?.id]);
  const aiCount = useMemo(() => campaigns.filter((row) => isAiAssistedEmailTemplate(row)).length, [campaigns]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, number>();
    campaigns.forEach((row) => {
      const key = purposeLabel(row.purpose || "GENERAL");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [campaigns]);

  const categories = useMemo(() => [
    "All Templates",
    "Newsletter",
    "Thank You",
    "Appeals",
    "Events",
    "Receipts",
    "Steward Paths",
  ], []);

  const visibleCategories = useMemo(() => {
    const [all, ...rest] = categories;
    if (categorySort === "default") return categories;
    const sorted = [...rest].sort((a, b) => {
      const delta = (categoryMap.get(b) ?? 0) - (categoryMap.get(a) ?? 0);
      if (delta !== 0) return delta;
      return a.localeCompare(b);
    });
    return [all, ...sorted];
  }, [categories, categoryMap, categorySort]);

  const rows = useMemo(() => campaigns.filter((row) => {
    const needle = search.trim().toLowerCase();
    const isMine = row.ownerId === user?.id;
    if (needle && !`${row.name} ${row.subject || ""}`.toLowerCase().includes(needle)) return false;
    if (ownership === "MINE" && !isMine) return false;
    if (ownership === "SHARED" && isMine) return false;
    if (provenance === "AI" && !isAiAssistedEmailTemplate(row)) return false;
    if (provenance === "HUMAN" && isAiAssistedEmailTemplate(row)) return false;
    if (category === "All Templates") return true;
    const purpose = purposeLabel(row.purpose || "GENERAL");
    return purpose === category;
  }), [campaigns, category, ownership, provenance, search, user?.id]);

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      if (sortBy === "updatedDesc") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sortBy === "updatedAsc") return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (sortBy === "usedDesc") return (b.totalRecipients || 0) - (a.totalRecipients || 0);
      return a.name.localeCompare(b.name);
    });
    return next;
  }, [rows, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, category, ownership, provenance, sortBy]);

  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  async function exportTemplateBackup(template: OyamaEmailCampaign) {
    setLibraryError(null);
    setLibraryNotice(null);
    try {
      const response = await apiFetchResponse(`/api/oyama-email/templates/${encodeURIComponent(template.id)}/export`, { method: "GET" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Export failed with status ${response.status}`);
      }
      const blob = await response.blob();
      downloadBlob(blob, filenameFromDisposition(response.headers.get("content-disposition")) ?? `${safeDownloadName(template.name)}_email_template.json`);
      setLibraryNotice(`Exported ${template.name}.`);
    } catch (requestError) {
      setLibraryError(errorMessage(requestError, "Failed to export email template."));
    }
  }

  async function importTemplateBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setImportingTemplate(true);
    setLibraryError(null);
    setLibraryNotice(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const created = await apiFetch<OyamaEmailCampaign>("/api/oyama-email/templates/import", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      setOwnership("ALL");
      setCategory("All Templates");
      setLibraryNotice(`Imported ${created.name} as a draft email template.`);
      await onTemplatesChanged();
    } catch (requestError) {
      setLibraryError(errorMessage(requestError, "Failed to import email template backup."));
    } finally {
      setImportingTemplate(false);
    }
  }

  return (
    <section className="space-y-5 p-4 xl:p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-[linear-gradient(120deg,#f8faff_0%,#f6f3ff_54%,#ffffff_100%)] px-5 py-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-semibold tracking-tight text-slate-950">Email templates</p>
              <InfoTooltip label="About email templates">Templates are reusable content. Campaigns are governed delivery records with their own audience, review history, and results.</InfoTooltip>
            </div>
            <p className="mt-1 text-sm text-slate-600">Build a reusable design once, then take a clean snapshot into each campaign.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => importInputRef.current?.click()} disabled={importingTemplate} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{importingTemplate ? "Importing..." : "Import backup"}</button>
            <input ref={importInputRef} type="file" accept="application/json,.json" onChange={(event) => void importTemplateBackup(event)} className="hidden" />
            <WorkspaceAction href="/oyama-email/templates/new" tone="primary">Create email template</WorkspaceAction>
          </div>
        </header>
        <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="border-b border-slate-100 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Browse library</p>
            <div className="mt-3 space-y-1">
              {([
                { value: "MINE", label: "My templates", count: myCount },
                { value: "SHARED", label: "Shared with me", count: sharedCount },
                { value: "ALL", label: "All templates", count: campaigns.length },
              ] as const).map((option) => <button key={option.value} type="button" onClick={() => setOwnership(option.value)} className={["flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold", ownership === option.value ? "bg-indigo-700 text-white shadow-sm" : "text-slate-700 hover:bg-white"].join(" ")}><span>{option.label}</span><span className={ownership === option.value ? "text-indigo-100" : "text-slate-400"}>{option.count}</span></button>)}
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Template type</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {([
                { value: "ALL", label: "All" },
                { value: "HUMAN", label: "Staff" },
                { value: "AI", label: `AI ${aiCount}` },
              ] as const).map((option) => <button key={option.value} type="button" onClick={() => setProvenance(option.value)} className={["rounded-md border px-2 py-1.5 text-[11px] font-semibold", provenance === option.value ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}>{option.label}</button>)}
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Topics</p><select value={categorySort} onChange={(event) => setCategorySort(event.target.value as "default" | "count")} className="bg-transparent text-[10px] font-semibold text-slate-500 outline-none"><option value="default">A–Z</option><option value="count">Most used</option></select></div>
              <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
                {visibleCategories.map((label) => <button key={label} type="button" onClick={() => setCategory(label)} className={["flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs", category === label ? "bg-indigo-50 font-semibold text-indigo-800" : "text-slate-600 hover:bg-white"].join(" ")}><span>{label}</span><span className="text-[10px] text-slate-400">{label === "All Templates" ? campaigns.length : categoryMap.get(label) ?? 0}</span></button>)}
              </div>
            </div>
          </aside>
          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1 basis-full sm:basis-auto">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by template name or email subject" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </label>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "updatedDesc" | "updatedAsc" | "usedDesc" | "nameAsc")} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500" aria-label="Sort templates"><option value="updatedDesc">Recently updated</option><option value="usedDesc">Most used</option><option value="nameAsc">Name A–Z</option><option value="updatedAsc">Oldest updated</option></select>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Showing", sortedRows.length, "text-slate-900"],
                ["My templates", myCount, "text-indigo-800"],
                ["Shared", sharedCount, "text-violet-800"],
                ["AI-assisted", aiCount, "text-blue-800"],
              ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={["mt-1 text-xl font-semibold", String(color)].join(" ")}>{value}</p></div>)}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-600">Choose <span className="font-semibold text-slate-800">Edit</span> to change reusable content, or <span className="font-semibold text-slate-800">Use in campaign</span> when you are ready to choose an audience.</p>
          </div>
        </div>
      </section>

      {libraryNotice ? <Alert tone="success">{libraryNotice}</Alert> : null}
      {libraryError ? <Alert tone="error">{libraryError}</Alert> : null}

      {sortedRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">No templates matched your filters.</p>
          <p className="mt-2 text-sm text-slate-600">Create a reusable template first, then continue into the campaign workflow.</p>
          <div className="mt-4 flex justify-center">
            <WorkspaceAction href="/oyama-email/templates/new" tone="primary">Start New Template</WorkspaceAction>
          </div>
        </div>
      ) : null}

      {sortedRows.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pageRows.map((row) => {
              const categoryLabel = purposeLabel(row.purpose || "GENERAL");
              const usedCount = row.totalRecipients || 0;
              const isMine = row.ownerId === user?.id;
              const aiAssisted = isAiAssistedEmailTemplate(row);
              return (
                <article key={row.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between px-4 pb-2 pt-4">
                    <div>
                      <Link href={`/oyama-email/templates/${row.id}/builder`} className="line-clamp-1 text-[21px] font-semibold leading-snug tracking-tight text-slate-900 hover:text-indigo-700">{row.name}</Link>
                      <span className="mt-1 inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{categoryLabel}</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {isMine ? "Created by you" : row.sharedWithOrganization ? "Shared template" : "Team template"}
                        </span>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${aiAssisted ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                          {aiAssisted ? "AI-assisted" : "User created"}
                        </span>
                      </div>
                    </div>
                    <StatusBadge label={row.status === "SENT" ? "Published" : statusLabel(row.status)} tone={row.status === "SENT" ? "green" : "slate"} />
                  </div>

                  <div className="px-4">
                    <div className={["relative h-32 overflow-hidden rounded-lg border border-slate-200", templatePreviewClass(row.purpose || "GENERAL")].join(" ")}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
                      <p className="absolute bottom-2 left-2 right-2 line-clamp-2 text-sm font-semibold text-white">{row.subject || "Untitled subject"}</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <p className="text-xs text-slate-500">Updated {formatDate(row.updatedAt)}</p>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5l3 3m6-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        Used {usedCount} time{usedCount === 1 ? "" : "s"}
                      </span>
                      <Link href={`/oyama-email/templates/${row.id}/builder`} className="font-semibold text-slate-500 hover:text-indigo-700">Edit</Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onUseTemplate(row)} className="inline-flex h-9 items-center justify-center rounded-md border border-indigo-700 bg-indigo-700 px-3 text-xs font-semibold text-white hover:bg-indigo-600">Use in campaign</button>
                      <button type="button" onClick={() => void exportTemplateBackup(row)} className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-1 pt-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPage(value)}
                  className={[
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold",
                    value === page ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight />
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function templatePreviewClass(value: string): string {
  const upper = value.trim().toUpperCase();
  if (upper.includes("THANK")) return "bg-[linear-gradient(135deg,#c9b49b,#7a644f)]";
  if (upper.includes("EVENT")) return "bg-[linear-gradient(135deg,#8c6f49,#3f2d1f)]";
  if (upper.includes("RECEIPT")) return "bg-[linear-gradient(135deg,#c2ced9,#7c8da1)]";
  if (upper.includes("APPEAL") || upper.includes("FUNDRAIS")) return "bg-[linear-gradient(135deg,#6a7f91,#2f4d66)]";
  if (upper.includes("STEWARD")) return "bg-[linear-gradient(135deg,#89a8b7,#3a5f6b)]";
  return "bg-[linear-gradient(135deg,#7da575,#2d6040)]";
}

function isAiAssistedEmailTemplate(campaign: OyamaEmailCampaign): boolean {
  const templateJson = campaign.templateJson ?? "";
  if (/"type":"ai(Text|Button)"/.test(templateJson)) return true;
  return /data-ai-|ai-generated|ai-assisted/i.test(campaign.bodyHtml ?? "");
}

function isReusableEmailTemplate(campaign: OyamaEmailCampaign): boolean {
  return campaign.status === "DRAFT"
    && (campaign.totalRecipients || 0) === 0
    && !campaign.sentAt
    && !campaign.scheduledAt
    && !campaign.audienceFilter
    && !campaign.templateSnapshot;
}

function BuilderView({ templateId }: { templateId?: string }) {
  return <OyamaEmailBuilderWorkspace templateId={templateId} />;
}

function PublishView({
  draft,
  campaign,
  saving,
  onSave,
  onSendTest,
  onPublish,
}: {
  draft: BuilderDraft;
  campaign: OyamaEmailCampaign | null;
  saving: boolean;
  onSave: () => void;
  onSendTest: () => void;
  onPublish: () => void;
}) {
  const checks = complianceChecks(draft);
  const blockerCount = checks.filter((row) => row.required && !row.passed).length;

  return (
    <section className="grid gap-4 p-4 xl:grid-cols-[340px_minmax(0,1fr)_320px] xl:p-6">
      <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-slate-900">Compliance Checklist</p>
          <StatusBadge label={blockerCount === 0 ? "Ready" : `${blockerCount} note${blockerCount === 1 ? "" : "s"}`} tone={blockerCount === 0 ? "green" : "amber"} />
        </div>
        {checks.map((check) => (
          <div key={check.key} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{check.label}</p>
              <p className="text-xs text-slate-600">{check.detail}</p>
            </div>
            <StatusBadge label={check.passed ? "Pass" : "Review"} tone={check.passed ? "green" : "amber"} />
          </div>
        ))}
      </aside>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <p className="text-sm text-slate-600">Email Preview</p>
            <p className="text-base font-semibold text-slate-900">{draft.subject || "Untitled subject"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save Draft</button>
            <button type="button" onClick={onSendTest} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Send Test Email</button>
            <button type="button" onClick={onPublish} disabled={saving || blockerCount > 0} title={blockerCount > 0 ? "Resolve required compliance checks before marking this template Ready." : undefined} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">Mark Ready</button>
          </div>
        </div>

        <div className="max-h-[640px] overflow-auto rounded-lg border border-slate-200 bg-white p-4">
          <div className="rounded-lg border border-slate-200 p-4" dangerouslySetInnerHTML={{ __html: draft.bodyHtml || BUILDER_PLACEHOLDER_HTML }} />
        </div>
      </div>

      <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Publish Summary</p>
        <KeyValue label="Template Name" value={draft.name || campaign?.name || "Untitled"} />
        <KeyValue label="Status" value={campaign?.status || draft.status} />
        <KeyValue label="Preparation" value={campaign?.preparationStatus || draft.preparationStatus} />
        <KeyValue label="Updated" value={formatDate(campaign?.updatedAt || "")} />
        <KeyValue label="Merge Fields" value={String(extractMergeTokens(draft.bodyHtml).length)} />
        <KeyValue label="Plain Text" value={htmlToText(draft.bodyHtml).slice(0, 80) || "Auto-generated"} />

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          Resolve every required check, then mark this reusable template Ready. Sending remains a separate campaign review workflow.
        </div>
      </aside>
    </section>
  );
}

function TestSendDialog({
  email,
  saving,
  onChange,
  onClose,
  onSend,
}: {
  email: string;
  saving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSend: (email: string) => Promise<boolean>;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center" role="presentation">
      <form
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-send-dialog-title"
        onSubmit={(event) => {
          event.preventDefault();
          void onSend(email).then((sent) => {
            if (sent) onClose();
          });
        }}
      >
        <h2 id="test-send-dialog-title" className="text-lg font-semibold text-slate-900">Send a proof email</h2>
        <p className="mt-1 text-sm text-slate-600">This sends only to the address below. It does not queue or send the campaign audience.</p>
        <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="oyama-email-test-recipient">Test recipient</label>
        <input
          id="oyama-email-test-recipient"
          type="email"
          value={email}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          placeholder="reviewer@organization.org"
        />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? "Sending..." : "Send proof"}</button>
        </div>
      </form>
    </div>
  );
}

function logEmailPublishDiagnostics({
  stage,
  campaign,
  draft,
  validationIssues,
}: {
  stage: "before-publish" | "after-publish";
  campaign: OyamaEmailCampaign;
  draft: BuilderDraft;
  validationIssues: ReturnType<typeof complianceChecks>;
}) {
  const htmlOutput = draft.bodyHtml || campaign.bodyHtml || "";
  const plainTextOutput = campaign.bodyText || htmlToText(htmlOutput);
  const diagnostics = {
    stage,
    publishedAt: new Date().toISOString(),
    campaignId: campaign.id,
    name: draft.name || campaign.name,
    subject: draft.subject || campaign.subject || "",
    previewText: draft.previewText || campaign.previewText || "",
    fromName: draft.fromName || campaign.fromName || "",
    fromEmail: draft.fromEmail || campaign.fromEmail || "",
    replyToEmail: draft.replyToEmail || campaign.replyToEmail || "",
    status: campaign.status,
    preparationStatus: campaign.preparationStatus,
    validationIssueCount: validationIssues.length,
    validationIssues: validationIssues.map((issue) => ({
      key: issue.key,
      label: issue.label,
      detail: issue.detail,
      required: issue.required,
      passed: issue.passed,
    })),
    mergeFields: extractMergeTokens(htmlOutput),
    htmlLength: htmlOutput.length,
    plainTextLength: plainTextOutput.length,
  };

  console.groupCollapsed(`[OyamaEmail Publish Diagnostics] ${stage}: ${campaign.id}`);
  console.info("Summary", diagnostics);
  console.info("Entire email HTML output", htmlOutput);
  console.info("Plain-text output", plainTextOutput);
  console.groupEnd();
}

function SendWizardView({
  campaigns,
  selectedCampaign,
  selectedRecipients,
  recipients,
  selectedRecipientIds,
  onToggleRecipient,
  recipientSearch,
  onRecipientSearch,
  summary,
  wizardStep,
  onWizardStep,
  sourceOption,
  onSourceOption,
}: {
  campaigns: OyamaEmailCampaign[];
  selectedCampaign: OyamaEmailCampaign | null;
  selectedRecipients: OyamaEmailConstituent[];
  recipients: OyamaEmailConstituent[];
  selectedRecipientIds: string[];
  onToggleRecipient: (id: string) => void;
  recipientSearch: string;
  onRecipientSearch: (value: string) => void;
  summary: {
    total: number;
    valid: number;
    missingEmail: number;
    unsubscribed: number;
    doNotEmail: number;
    suppressed: number;
    duplicatesRemoved: number;
  };
  wizardStep: 1 | 2 | 3 | 4 | 5;
  onWizardStep: (next: 1 | 2 | 3 | 4 | 5) => void;
  sourceOption: (typeof SOURCE_OPTIONS)[number];
  onSourceOption: (next: (typeof SOURCE_OPTIONS)[number]) => void;
}) {
  const templateName = selectedCampaign?.name || "Template not selected";

  return (
    <section className="space-y-4 p-4 xl:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-2xl font-semibold text-slate-900">Send Email Wizard</p>
        <p className="mt-1 text-sm text-slate-600">Follow the steps to create and send your email campaign.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {WIZARD_STEPS.map(({ step, label }) => {
            const isActive = wizardStep === step;
            const isComplete = wizardStep > step;
            return (
              <button
                key={step}
                type="button"
                onClick={() => onWizardStep(step)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  isActive ? "border-emerald-700 bg-emerald-50 text-emerald-800" : isComplete ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">{step}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_260px]">
        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-900">Select Your Audience</p>
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSourceOption(option)}
              className={[
                "w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold",
                sourceOption === option ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </aside>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-slate-900">Selected Recipients ({selectedRecipients.length})</p>
            <StatusBadge label={templateName} tone="slate" />
          </div>

          <input value={recipientSearch} onChange={(event) => onRecipientSearch(event.target.value)} placeholder="Search recipients..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />

          <div className="max-h-[460px] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="w-20 px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recipients.map((row) => {
                  const selected = selectedRecipientIds.includes(row.id);
                  const valid = Boolean(row.email && !row.doNotEmail && !row.doNotContact && !row.emailOptOut);
                  return (
                    <tr key={row.id} className={selected ? "bg-emerald-50/60" : ""}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selected} onChange={() => onToggleRecipient(row.id)} /></td>
                      <td className="px-3 py-2 font-medium text-slate-800">{[row.firstName, row.lastName].filter(Boolean).join(" ") || row.id}</td>
                      <td className="px-3 py-2 text-slate-600">{row.email || "-"}</td>
                      <td className="px-3 py-2">{valid ? <StatusBadge label="Valid" tone="green" /> : <StatusBadge label="Review" tone="amber" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => onWizardStep(Math.max(1, wizardStep - 1) as 1 | 2 | 3 | 4 | 5)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Back</button>
            <button type="button" onClick={() => onWizardStep(Math.min(5, wizardStep + 1) as 1 | 2 | 3 | 4 | 5)} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600">Next</button>
          </div>
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-900">Audience Summary</p>
          <SummaryLine label="Total Selected" value={String(summary.total)} />
          <SummaryLine label="Valid Emails" value={String(summary.valid)} />
          <SummaryLine label="Missing Email" value={String(summary.missingEmail)} />
          <SummaryLine label="Unsubscribed" value={String(summary.unsubscribed)} />
          <SummaryLine label="Do Not Email" value={String(summary.doNotEmail)} />
          <SummaryLine label="Suppressed" value={String(summary.suppressed)} />
          <SummaryLine label="Duplicates Removed" value={String(summary.duplicatesRemoved)} />
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            {summary.valid} recipients are currently eligible to receive this email.
          </div>
        </aside>
      </div>
    </section>
  );
}

function CampaignsView({
  campaigns,
  stats,
  focusedCampaignId,
  initialTab,
  initialViewMode,
  calendarOnly,
  openWizard,
  wizardPageMode,
  preferredTemplateId,
  temporarySegmentId,
  constituents,
  lists,
  templates,
  onRefresh,
}: {
  campaigns: OyamaEmailCampaign[];
  stats: OyamaEmailStats | null;
  focusedCampaignId: string | null;
  initialTab: CampaignWorkspaceTab;
  initialViewMode: "board" | "calendar";
  calendarOnly: boolean;
  openWizard: boolean;
  wizardPageMode: boolean;
  preferredTemplateId: string | null;
  temporarySegmentId: string | null;
  constituents: OyamaEmailConstituent[];
  lists: OyamaEmailRecipientList[];
  templates: OyamaEmailCampaign[];
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof CAMPAIGN_FILTER_CHIPS)[number]>("ALL");
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"board" | "calendar">(initialViewMode);
  const [wizardVisible, setWizardVisible] = useState(openWizard);
  const [tab, setTab] = useState<CampaignWorkspaceTab>(initialTab);
  const [deliveryData, setDeliveryData] = useState<DeliveryEventsPayload | null>(null);
  const [activityRows, setActivityRows] = useState<CampaignActivityRow[]>([]);
  const [queueRows, setQueueRows] = useState<CampaignQueueRow[]>([]);
  const [audiencePreview, setAudiencePreview] = useState<CampaignAudiencePreviewResponse["audience"] | null>(null);
  const [calendarData, setCalendarData] = useState<CampaignCalendarResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((row) => row.id === focusedCampaignId) ?? null,
    [campaigns, focusedCampaignId],
  );

  useEffect(() => {
    setWizardVisible(openWizard);
  }, [openWizard]);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, focusedCampaignId]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const searched = campaigns.filter((row) => {
      if (!needle) return true;
      return [
        row.name,
        row.subject,
        row.templateSnapshot?.templateName,
        row.ownerId,
        row.workspaceStatus,
        row.status,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });

    const filtered = activeFilter === "ALL"
      ? searched
      : searched.filter((row) => effectiveCampaignStatus(row) === activeFilter);

    return [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const safeDate = (value?: string | null) => {
        if (!value) return 0;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
      };
      const openRateA = a.delivered > 0 ? a.opened / a.delivered : 0;
      const openRateB = b.delivered > 0 ? b.opened / b.delivered : 0;
      const clickRateA = a.delivered > 0 ? a.clicked / a.delivered : 0;
      const clickRateB = b.delivered > 0 ? b.clicked / b.delivered : 0;

      if (sortBy === "scheduledAt") return (safeDate(a.scheduledAt) - safeDate(b.scheduledAt)) * direction;
      if (sortBy === "sentAt") return (safeDate(a.sentAt) - safeDate(b.sentAt)) * direction;
      if (sortBy === "openRate") return (openRateA - openRateB) * direction;
      if (sortBy === "clickRate") return (clickRateA - clickRateB) * direction;
      if (sortBy === "audienceSize") return ((a.totalRecipients ?? 0) - (b.totalRecipients ?? 0)) * direction;
      return (safeDate(a.updatedAt) - safeDate(b.updatedAt)) * direction;
    });
  }, [activeFilter, campaigns, search, sortBy, sortDirection]);

  const needsSetupRows = rows.filter((row) => effectiveCampaignStatus(row) === "DRAFT");
  const readyToScheduleRows = rows.filter((row) => ["READY", "NEEDS_REVIEW"].includes(effectiveCampaignStatus(row)));
  const scheduledRows = rows.filter((row) => ["SCHEDULED", "QUEUED"].includes(effectiveCampaignStatus(row)));
  const sendingRows = rows.filter((row) => effectiveCampaignStatus(row) === "SENDING");
  const recentRows = rows.filter((row) => ["SENT", "DELIVERED"].includes(effectiveCampaignStatus(row)));
  const failedRows = rows.filter((row) => effectiveCampaignStatus(row) === "FAILED");
  const archivedRows = rows.filter((row) => ["ARCHIVED", "CANCELLED"].includes(effectiveCampaignStatus(row)));

  useEffect(() => {
    if (!selectedCampaign?.id) {
      setDeliveryData(null);
      setActivityRows([]);
      setQueueRows([]);
      return;
    }

    const controller = new AbortController();
    let reconnectTimer: number | null = null;

    const connect = async () => {
      while (!controller.signal.aborted) {
        try {
          await streamCampaignLiveUpdates(selectedCampaign.id, (snapshot) => {
            setDeliveryData(snapshot.delivery);
            setActivityRows(snapshot.activity);
            setQueueRows(snapshot.queueRows);
          }, controller.signal);
        } catch {
          if (controller.signal.aborted) break;
        }

        if (controller.signal.aborted) break;
        await new Promise<void>((resolve) => {
          reconnectTimer = window.setTimeout(() => resolve(), 1400);
        });
      }
    };

    void connect();

    return () => {
      controller.abort();
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [selectedCampaign?.id]);

  useEffect(() => {
    if (!selectedCampaign?.id || tab !== "audience") return;
    const rawFilter = parseAudienceFilterForPreview(selectedCampaign.audienceFilter);
    void apiFetch<CampaignAudiencePreviewResponse>("/api/email-campaigns/audience-preview", {
      method: "POST",
      body: JSON.stringify({
        audienceFilter: rawFilter,
        purpose: selectedCampaign.purpose || "GENERAL",
      }),
    })
      .then((payload) => setAudiencePreview(payload.audience))
      .catch(() => setAudiencePreview(null));
  }, [selectedCampaign?.audienceFilter, selectedCampaign?.id, selectedCampaign?.purpose, tab]);

  const refreshCalendar = useCallback(async () => {
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59, 999).toISOString();
      const payload = await apiFetch<CampaignCalendarResponse>(`/api/email-campaigns/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setCalendarData(payload);
    } catch (requestError) {
      setCalendarError(requestError instanceof Error ? requestError.message : "Failed to load calendar.");
      setCalendarData(null);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode !== "calendar") return;
    void refreshCalendar();
  }, [refreshCalendar, viewMode]);

  const applySchedule = useCallback(async (campaignId: string, when: string) => {
    const existing = campaigns.find((row) => row.id === campaignId);
    if (!existing) return;
    const status = effectiveCampaignStatus(existing);
    if (["SENT", "DELIVERED", "ARCHIVED", "CANCELLED", "SENDING"].includes(status)) {
      throw new Error("This campaign is locked and cannot be rescheduled.");
    }

    await apiFetch(`/api/email-campaigns/${campaignId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt: when }),
    });
    await Promise.all([onRefresh(), refreshCalendar()]);
  }, [campaigns, onRefresh, refreshCalendar]);

  function openCampaign(campaign: OyamaEmailCampaign) {
    router.push(`/oyama-email/campaigns/${campaign.id}?tab=${tab}`);
  }

  function onTabChange(next: CampaignWorkspaceTab) {
    setTab(next);
    if (!selectedCampaign?.id) return;
    router.replace(`/oyama-email/campaigns/${selectedCampaign.id}?tab=${next}`);
  }

  async function onCreatedCampaign(campaign: OyamaEmailCampaign) {
    await onRefresh();
    setWizardVisible(false);
    router.push(`/oyama-email/campaigns/${campaign.id}?tab=overview`);
  }

  return (
    <section className="space-y-4 p-4 xl:p-6">
      {!selectedCampaign ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{calendarOnly ? "Calendar" : "Campaigns"}</p>
                <p className="text-sm text-slate-600">
                  {calendarOnly
                    ? "Manage all email schedules from one timeline with drag-and-drop rescheduling and upcoming send visibility."
                    : "Campaign-first workspace with board lanes, status controls, and calendar planning."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!calendarOnly ? (
                  <button
                    type="button"
                    onClick={() => setViewMode("board")}
                    className={[
                      "rounded-md border px-3 py-2 text-xs font-semibold",
                      viewMode === "board" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700",
                    ].join(" ")}
                  >
                    Board
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  className={[
                    "rounded-md border px-3 py-2 text-xs font-semibold",
                    viewMode === "calendar" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700",
                  ].join(" ")}
                >
                  Calendar
                </button>
                {!wizardPageMode && !calendarOnly ? (
                  <WorkspaceAction href="/oyama-email/campaigns/new" tone="primary">New Campaign</WorkspaceAction>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, subject, template, owner, status..."
                className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                {CAMPAIGN_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value === "asc" ? "asc" : "desc")} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
            {!calendarOnly ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {CAMPAIGN_FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setActiveFilter(chip)}
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      activeFilter === chip ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {chip === "NEEDS_REVIEW" ? "Needs Review" : chip}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Send records tracked: <span className="font-semibold text-slate-900">{campaigns.length}</span>
            </div>
          </div>

          {viewMode === "calendar" ? (
            <CampaignCalendarWorkspace
              loading={calendarLoading}
              error={calendarError}
              data={calendarData}
              onSchedule={applySchedule}
              onOpenCampaign={(campaignId) => router.push(`/oyama-email/campaigns/${campaignId}?tab=overview`)}
              onRefresh={refreshCalendar}
            />
          ) : (
            <>
              {wizardVisible ? (
                <NewCampaignWizardPanel
                  templates={templates}
                  lists={lists}
                  constituents={constituents}
                  preferredTemplateId={preferredTemplateId}
                  temporarySegmentId={temporarySegmentId}
                  onCancel={() => {
                    setWizardVisible(false);
                    if (wizardPageMode) router.push("/oyama-email/campaigns");
                  }}
                  pageMode={wizardPageMode}
                  onCreated={onCreatedCampaign}
                />
              ) : null}

              {!wizardPageMode ? <CampaignBoardSection title="Needs Setup" rows={needsSetupRows} onOpen={openCampaign} /> : null}
              {!wizardPageMode ? <CampaignBoardSection title="Ready to Schedule" rows={readyToScheduleRows} onOpen={openCampaign} /> : null}
              {!wizardPageMode ? <CampaignBoardSection title="Scheduled" rows={scheduledRows} onOpen={openCampaign} /> : null}
              {!wizardPageMode ? <CampaignBoardSection title="Sending Now" rows={sendingRows} onOpen={openCampaign} /> : null}
              {!wizardPageMode ? <CampaignBoardSection title="Recently Sent" rows={recentRows} onOpen={openCampaign} /> : null}
              {!wizardPageMode ? <CampaignBoardSection title="Failed / Needs Attention" rows={failedRows} onOpen={openCampaign} /> : null}
              {!wizardPageMode ? <CampaignBoardSection title="Archived" rows={archivedRows} onOpen={openCampaign} /> : null}
            </>
          )}
        </>
      ) : (
        <CampaignDetailWorkspace
          campaign={selectedCampaign}
          tab={tab}
          onTabChange={onTabChange}
          onBack={() => router.push("/oyama-email/campaigns")}
          deliveryData={deliveryData}
          activityRows={activityRows}
          queueRows={queueRows}
          audiencePreview={audiencePreview}
          onCampaignMutated={async () => {
            await onRefresh();
            if (viewMode === "calendar") {
              await refreshCalendar();
            }
          }}
        />
      )}
    </section>
  );
}

function CampaignBoardSection({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: OyamaEmailCampaign[];
  onOpen: (campaign: OyamaEmailCampaign) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No campaigns in this section yet.</div>
      ) : null}
      {rows.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => {
            const status = effectiveCampaignStatus(row);
            const sentCount = row.sentAt ? String(row.totalRecipients || 0) : waitingMetric(status);
            const queuedCount = ["SCHEDULED", "QUEUED", "SENDING"].includes(status)
              ? String(row.totalRecipients || 0)
              : waitingMetric(status);

            return (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="line-clamp-1 text-base font-semibold text-slate-900">{row.name || "Untitled Campaign"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.subject || "No subject line"}</p>
                  </div>
                  <StatusBadge label={statusLabel(status)} tone={statusTone(status)} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MetricChip label="Template Used" value={row.templateSnapshot?.templateName || row.templateSnapshot?.templateId || "Not linked"} />
                  <MetricChip label="Audience Count" value={String(row.totalRecipients ?? 0)} />
                  <MetricChip label="Queued Count" value={queuedCount} />
                  <MetricChip label="Sent Count" value={sentCount} />
                  <MetricChip label="Delivered" value={trackedMetric(row.delivered, status)} />
                  <MetricChip label="Opened" value={trackedMetric(row.opened, status)} />
                  <MetricChip label="Clicked" value={trackedMetric(row.clicked, status)} />
                  <MetricChip label="Bounced" value={trackedMetric(row.bounced, status)} />
                  <MetricChip label="Unsubscribed" value={trackedMetric(row.unsubscribed, status)} />
                  <MetricChip label="Last Activity" value={formatDateTime(row.sentAt || row.updatedAt)} />
                  <MetricChip label="Owner" value={row.ownerId || "Unassigned"} />
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-700 bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Continue Workflow
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CampaignCalendarWorkspace({
  loading,
  error,
  data,
  onSchedule,
  onOpenCampaign,
  onRefresh,
}: {
  loading: boolean;
  error: string | null;
  data: CampaignCalendarResponse | null;
  onSchedule: (campaignId: string, when: string) => Promise<void>;
  onOpenCampaign: (campaignId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [viewScale, setViewScale] = useState<"month" | "week" | "day">("month");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [drawerEvent, setDrawerEvent] = useState<CampaignCalendarEvent | null>(null);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);
  const [calendarActionError, setCalendarActionError] = useState<string | null>(null);

  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const drafts = useMemo(() => data?.unscheduledDrafts ?? [], [data?.unscheduledDrafts]);

  const visibleDates = useMemo(() => {
    const anchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());

    if (viewScale === "day") {
      return [anchor];
    }

    if (viewScale === "week") {
      const start = new Date(anchor);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      return Array.from({ length: 7 }, (_, idx) => {
        const date = new Date(start);
        date.setDate(start.getDate() + idx);
        return date;
      });
    }

    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const startDay = start.getDay();
    start.setDate(start.getDate() - startDay);
    return Array.from({ length: 42 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return date;
    });
  }, [anchorDate, viewScale]);

  const eventMap = useMemo(() => {
    const map = new Map<string, CampaignCalendarEvent[]>();
    for (const event of events) {
      const key = toDayKey(event.at);
      const rows = map.get(key) ?? [];
      rows.push(event);
      map.set(key, rows);
    }
    return map;
  }, [events]);

  const scheduleMetrics = useMemo(() => {
    const now = Date.now();
    const nextWeek = now + (7 * 24 * 60 * 60 * 1000);
    let upcoming = 0;
    let inNextSevenDays = 0;
    let sentCount = 0;
    for (const event of events) {
      const ts = new Date(event.at).getTime();
      if (Number.isNaN(ts)) continue;
      if (event.kind === "sent") {
        sentCount += 1;
        continue;
      }
      if (ts >= now) {
        upcoming += 1;
      }
      if (ts >= now && ts <= nextWeek) {
        inNextSevenDays += 1;
      }
    }

    return {
      upcoming,
      inNextSevenDays,
      sentCount,
      unscheduledDrafts: drafts.length,
    };
  }, [drafts.length, events]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => event.kind === "scheduled")
      .filter((event) => {
        const ts = new Date(event.at).getTime();
        return !Number.isNaN(ts) && ts >= now;
      })
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(0, 8);
  }, [events]);

  const moveWindow = useCallback((direction: "prev" | "next") => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      const multiplier = direction === "next" ? 1 : -1;
      if (viewScale === "month") next.setMonth(prev.getMonth() + multiplier);
      if (viewScale === "week") next.setDate(prev.getDate() + (7 * multiplier));
      if (viewScale === "day") next.setDate(prev.getDate() + multiplier);
      return next;
    });
  }, [viewScale]);

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>, day: Date) => {
    event.preventDefault();
    const campaignId = event.dataTransfer.getData("text/plain");
    if (!campaignId) return;

    setCalendarNotice(null);
    setCalendarActionError(null);

    const scheduledAt = new Date(day);
    scheduledAt.setHours(10, 0, 0, 0);

    try {
      await onSchedule(campaignId, scheduledAt.toISOString());
      setCalendarNotice("Campaign schedule updated.");
      await onRefresh();
    } catch (requestError) {
      setCalendarActionError(requestError instanceof Error ? requestError.message : "Failed to update schedule.");
    }
  }, [onRefresh, onSchedule]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricChip label="Upcoming Schedules" value={String(scheduleMetrics.upcoming)} />
          <MetricChip label="Next 7 Days" value={String(scheduleMetrics.inNextSevenDays)} />
          <MetricChip label="Sent Events" value={String(scheduleMetrics.sentCount)} />
          <MetricChip label="Unscheduled Drafts" value={String(scheduleMetrics.unscheduledDrafts)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => moveWindow("prev")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Prev</button>
            <button type="button" onClick={() => moveWindow("next")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Next</button>
            <p className="text-sm font-semibold text-slate-900">{anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
          </div>
          <div className="flex items-center gap-2">
            {(["day", "week", "month"] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => setViewScale(scale)}
                className={[
                  "rounded-md border px-3 py-2 text-xs font-semibold",
                  viewScale === scale ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-700",
                ].join(" ")}
              >
                {scale.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-500">Loading calendar...</p> : null}
        {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {calendarActionError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{calendarActionError}</p> : null}
        {calendarNotice ? <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{calendarNotice}</p> : null}

        <div className={["mt-4 grid gap-2", viewScale === "month" ? "grid-cols-7" : viewScale === "week" ? "grid-cols-7" : "grid-cols-1"].join(" ")}>
          {visibleDates.map((day) => {
            const key = toDayKey(day.toISOString());
            const dayEvents = eventMap.get(key) ?? [];
            return (
              <div
                key={key}
                onDrop={(event) => void handleDrop(event, day)}
                onDragOver={(event) => event.preventDefault()}
                className="min-h-[108px] rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, 4).map((eventRow) => (
                    <button
                      key={eventRow.id}
                      type="button"
                      draggable={eventRow.draggable}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", eventRow.campaignId);
                      }}
                      onClick={() => setDrawerEvent(eventRow)}
                      className={[
                        "w-full rounded px-2 py-1 text-left text-[11px] font-semibold",
                        eventRow.status === "SENT" || eventRow.status === "DELIVERED"
                          ? "bg-emerald-100 text-emerald-900"
                          : eventRow.status === "SENDING"
                            ? "bg-blue-100 text-blue-900"
                            : eventRow.status === "READY"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-white text-slate-700",
                      ].join(" ")}
                    >
                      {eventRow.campaignName}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Upcoming Email Schedules</p>
        <div className="space-y-2">
          {upcomingEvents.length === 0 ? <p className="text-xs text-slate-500">No upcoming scheduled campaigns.</p> : null}
          {upcomingEvents.map((eventRow) => (
            <button
              key={eventRow.id}
              type="button"
              onClick={() => onOpenCampaign(eventRow.campaignId)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left"
            >
              <p className="text-xs font-semibold text-slate-900">{eventRow.campaignName}</p>
              <p className="text-[11px] text-slate-600">{formatDateTime(eventRow.at)}</p>
            </button>
          ))}
        </div>

        <p className="text-base font-semibold text-slate-900">Unscheduled Drafts</p>
        <p className="text-xs text-slate-600">Drag a draft or ready campaign onto a date to set scheduled send time.</p>
        <div className="space-y-2">
          {drafts.length === 0 ? <p className="text-xs text-slate-500">No unscheduled drafts.</p> : null}
          {drafts.map((draft) => (
            <button
              key={draft.campaignId}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", draft.campaignId);
              }}
              onClick={() => onOpenCampaign(draft.campaignId)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left"
            >
              <p className="text-xs font-semibold text-slate-900">{draft.campaignName}</p>
              <p className="text-[11px] text-slate-600">{statusLabel(draft.status)}</p>
            </button>
          ))}
        </div>

        {drawerEvent ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign Detail</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{drawerEvent.campaignName}</p>
            <p className="text-xs text-slate-600">{statusLabel(drawerEvent.status)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(drawerEvent.at)}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onOpenCampaign(drawerEvent.campaignId)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">Open</button>
              <button type="button" onClick={() => setDrawerEvent(null)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">Close</button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function CampaignDetailWorkspace({
  campaign,
  tab,
  onTabChange,
  onBack,
  deliveryData,
  activityRows,
  queueRows,
  audiencePreview,
  onCampaignMutated,
}: {
  campaign: OyamaEmailCampaign;
  tab: CampaignWorkspaceTab;
  onTabChange: (next: CampaignWorkspaceTab) => void;
  onBack: () => void;
  deliveryData: DeliveryEventsPayload | null;
  activityRows: CampaignActivityRow[];
  queueRows: CampaignQueueRow[];
  audiencePreview: CampaignAudiencePreviewResponse["audience"] | null;
  onCampaignMutated: () => Promise<void>;
}) {
  const workspaceStatus = effectiveCampaignStatus(campaign);
  const queueState = campaign.workflow?.queueState ?? "ACTIVE";
  const templateBuilderHref = campaign.templateSnapshot?.templateId
    ? `/oyama-email/templates/${campaign.templateSnapshot.templateId}/builder`
    : `/oyama-email/campaigns/${campaign.id}?tab=settings`;
  const sourceWorkflow = campaign.workflow;
  const sourceHref = sourceWorkflow?.source === "letters_generated" && sourceWorkflow.sourceTemplateId
    ? `/oyama-letters/generate?templateId=${encodeURIComponent(sourceWorkflow.sourceTemplateId)}${sourceWorkflow.sourceConstituentId ? `&constituentId=${encodeURIComponent(sourceWorkflow.sourceConstituentId)}` : ""}${sourceWorkflow.sourceGeneratedLetterId ? `&generatedLetterId=${encodeURIComponent(sourceWorkflow.sourceGeneratedLetterId)}` : ""}`
    : sourceWorkflow?.source === "letters_template" && sourceWorkflow.sourceTemplateId
      ? `/oyama-letters/templates/${encodeURIComponent(sourceWorkflow.sourceTemplateId)}`
      : null;

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [validation, setValidation] = useState<CampaignValidationResponse | null>(null);
  const [actionDialog, setActionDialog] = useState<CampaignActionDialogState | null>(null);

  const summary = deliveryData?.summary;
  const queueStatusCounts = useMemo(() => buildQueueStatusCounts(queueRows), [queueRows]);
  const totalAudience = summary?.eligibleRecipients ?? queueStatusCounts.total;
  const completed = summary?.processedRecipients ?? queueStatusCounts.processed;
  const progressPercent = summary?.sendProgressPercent
    ?? (totalAudience > 0 ? Math.min(100, Math.round((completed / totalAudience) * 100)) : 0);

  const runCampaignAction = useCallback(async (
    actionKey: string,
    run: () => Promise<void>,
    noticeMessage: string,
  ) => {
    setActionBusy(actionKey);
    setActionError(null);
    setActionNotice(null);
    try {
      await run();
      await onCampaignMutated();
      setActionNotice(noticeMessage);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Campaign action failed.");
    } finally {
      setActionBusy(null);
    }
  }, [onCampaignMutated]);

  const runValidation = useCallback(async () => {
    await runCampaignAction("validate", async () => {
      const result = await apiFetch<CampaignValidationResponse>(`/api/email-campaigns/${campaign.id}/validate`, {
        method: "POST",
      });
      setValidation(result);
    }, "Validation complete.");
  }, [campaign.id, runCampaignAction]);

  const runReady = useCallback(async () => {
    await runCampaignAction("ready", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/ready`, { method: "POST" });
    }, "Campaign marked as ready.");
  }, [campaign.id, runCampaignAction]);

  const runQueue = useCallback(async () => {
    await runCampaignAction("queue", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/queue`, { method: "POST" });
    }, "Campaign moved into review queue.");
  }, [campaign.id, runCampaignAction]);

  const runSchedule = useCallback(async (scheduledAtInput: string) => {
    const scheduledAt = new Date(scheduledAtInput);
    if (Number.isNaN(scheduledAt.getTime())) {
      setActionError("Enter a valid date/time value.");
      return;
    }
    await runCampaignAction("schedule", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
      });
    }, "Campaign scheduled.");
  }, [campaign.id, runCampaignAction]);

  const runUnschedule = useCallback(async () => {
    await runCampaignAction("unschedule", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/unschedule`, { method: "POST" });
    }, "Campaign unscheduled.");
  }, [campaign.id, runCampaignAction]);

  const runQueueControl = useCallback(async (action: "PAUSE" | "RESUME" | "CANCEL_REMAINING") => {
    await runCampaignAction(`queue-${action.toLowerCase()}`, async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/queue-control`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
    }, action === "PAUSE" ? "Queue paused." : action === "RESUME" ? "Queue resumed." : "Remaining recipients cancelled.");
  }, [campaign.id, runCampaignAction]);

  const runSendNow = useCallback(async () => {
    await runCampaignAction("send", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/send`, {
        method: "POST",
        body: JSON.stringify({ sendMode: "CAMPAIGN_AUDIENCE" }),
      });
    }, "Campaign send initiated.");
  }, [campaign.id, runCampaignAction]);

  const runSendTest = useCallback(async (email: string) => {
    if (!isEmailLike(email)) {
      setActionError("Enter a valid test recipient email.");
      return;
    }
    await runCampaignAction("send-test", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/send-test`, {
        method: "POST",
        body: JSON.stringify({ toEmail: email }),
      });
    }, `Test email sent to ${email}.`);
  }, [campaign.fromEmail, campaign.id, campaign.replyToEmail, runCampaignAction]);

  const runArchive = useCallback(async () => {
    await runCampaignAction("archive", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/archive`, { method: "POST" });
    }, "Campaign archived.");
  }, [campaign.id, runCampaignAction]);

  const runDuplicate = useCallback(async () => {
    await runCampaignAction("duplicate", async () => {
      await apiFetch(`/api/email-campaigns/${campaign.id}/duplicate`, { method: "POST" });
    }, "Campaign duplicated.");
  }, [campaign.id, runCampaignAction]);

  const primaryWorkflowAction = useMemo(() => {
    if (workspaceStatus === "DRAFT" || workspaceStatus === "CANCELLED") {
      return {
        label: "Continue to Review",
        detail: "Mark this draft ready before queueing, scheduling, or sending.",
        onClick: () => void runReady(),
      };
    }
    if (workspaceStatus === "READY" || workspaceStatus === "NEEDS_REVIEW") {
      return {
        label: "Continue to Queue",
        detail: "Queue is the canonical review step before live delivery.",
        onClick: () => void runQueue(),
      };
    }
    if (workspaceStatus === "SCHEDULED") {
      return {
        label: "Continue to Queue Monitor",
        detail: "Use Queue to monitor the scheduled audience and delivery state.",
        onClick: () => onTabChange("queue"),
      };
    }
    if (workspaceStatus === "QUEUED" || workspaceStatus === "SENDING") {
      return {
        label: "Continue to Queue Monitor",
        detail: "Queue is the canonical send monitor for recipient-by-recipient progress.",
        onClick: () => onTabChange("queue"),
      };
    }
    if (workspaceStatus === "SENT" || workspaceStatus === "DELIVERED") {
      return {
        label: "Continue to Analytics",
        detail: "Analytics is the primary follow-up workspace after delivery completes.",
        onClick: () => onTabChange("analytics"),
      };
    }
    return null;
  }, [onTabChange, runQueue, runReady, workspaceStatus]);

  function openActionDialog(kind: CampaignActionDialogKind) {
    setActionError(null);
    setActionDialog({
      kind,
      email: campaign.replyToEmail || campaign.fromEmail || "",
      scheduledAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString().slice(0, 16),
    });
  }

  async function submitActionDialog() {
    if (!actionDialog) return;
    const current = actionDialog;
    if (current.kind === "schedule") {
      const scheduledAt = new Date(current.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        setActionError("Enter a valid date/time value.");
        return;
      }
    }
    if (current.kind === "sendTest" && !isEmailLike(current.email)) {
      setActionError("Enter a valid test recipient email.");
      return;
    }
    if (current.kind === "schedule") {
      await runSchedule(current.scheduledAt);
    } else if (current.kind === "unschedule") {
      await runUnschedule();
    } else if (current.kind === "sendNow") {
      await runSendNow();
    } else if (current.kind === "sendTest") {
      await runSendTest(current.email);
    } else if (current.kind === "archive") {
      await runArchive();
    } else if (current.kind === "cancelRemaining") {
      await runQueueControl("CANCEL_REMAINING");
    }
    setActionDialog(null);
  }

  const mergedActivity = useMemo(() => {
    const readableAction = (action: string) => action.replaceAll("_", " ");
    const fromAudit = activityRows.map((row) => ({
      key: `audit-${row.id}`,
      ts: new Date(row.createdAt).getTime() || 0,
      label: `${formatDateTime(row.createdAt)} — ${readableAction(row.action)}${row.user?.name ? ` by ${row.user.name}` : ""}`,
    }));
    const fromDelivery = (deliveryData?.events ?? []).slice(0, 80).map((row) => ({
      key: `delivery-${row.id}`,
      ts: new Date(row.eventAt).getTime() || 0,
      label: `${formatDateTime(row.eventAt)} — ${row.eventType} ${row.recipientEmail}${typeof row.metadata?.providerResponse === "string" ? ` (${row.metadata.providerResponse})` : ""}`,
    }));
    return [...fromAudit, ...fromDelivery].sort((a, b) => b.ts - a.ts).slice(0, 120);
  }, [activityRows, deliveryData?.events]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-600">&larr; Back to Campaigns</button>
            <p className="text-2xl font-semibold text-slate-900">{campaign.name || "Campaign"}</p>
            <p className="text-sm text-slate-600">{campaign.subject || "No subject line"}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={statusLabel(workspaceStatus)} tone={statusTone(workspaceStatus)} />
            <WorkspaceAction href={templateBuilderHref}>{campaign.templateSnapshot?.templateId ? "Open Email Content" : "Open Campaign Settings"}</WorkspaceAction>
          </div>
        </div>

        {campaign.nextRecommendedAction ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Recommended next step: <span className="font-semibold">{campaign.nextRecommendedAction}</span>
          </p>
        ) : null}

        {sourceHref ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Created from OyamaLetters</p>
              <p className="mt-0.5 text-xs text-emerald-900">This campaign is the reviewable email companion to a letter workflow. Sending remains controlled here in OyamaEmail.</p>
            </div>
            <Link href={sourceHref} className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
              Return to Source Letter
            </Link>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {CAMPAIGN_WORKSPACE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                tab === item.id ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Overview is the campaign status view. Audience explains who is eligible. Queue shows recipient-by-recipient progress. Analytics summarizes delivery outcomes.
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign Workflow</p>
          {primaryWorkflowAction ? (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Primary Next Step</p>
              <p className="mt-1 text-sm text-slate-600">{primaryWorkflowAction.detail}</p>
              <button type="button" disabled={Boolean(actionBusy)} onClick={primaryWorkflowAction.onClick} className="mt-3 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {actionBusy === "ready"
                  ? "Updating..."
                  : actionBusy === "queue"
                    ? "Queueing..."
                    : primaryWorkflowAction.label}
              </button>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Review Tools</span>
              <button type="button" disabled={Boolean(actionBusy)} onClick={() => void runValidation()} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "validate" ? "Validating..." : "Validate"}</button>
              <button type="button" disabled={Boolean(actionBusy)} onClick={() => openActionDialog("sendTest")} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "send-test" ? "Sending Test..." : "Send Test"}</button>
            </div>

            {["DRAFT", "READY", "NEEDS_REVIEW"].includes(workspaceStatus) || workspaceStatus === "SCHEDULED" || ["READY", "SCHEDULED", "QUEUED", "NEEDS_REVIEW"].includes(workspaceStatus) ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold uppercase tracking-wide text-slate-500">Send Options</span>
                {["DRAFT", "READY", "NEEDS_REVIEW"].includes(workspaceStatus) ? (
                  <button type="button" disabled={Boolean(actionBusy)} onClick={() => openActionDialog("schedule")} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "schedule" ? "Scheduling..." : "Schedule"}</button>
                ) : null}
                {workspaceStatus === "SCHEDULED" ? (
                  <button type="button" disabled={Boolean(actionBusy)} onClick={() => openActionDialog("unschedule")} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "unschedule" ? "Unscheduling..." : "Unschedule"}</button>
                ) : null}
                {["READY", "SCHEDULED", "QUEUED", "NEEDS_REVIEW"].includes(workspaceStatus) ? (
                  <button type="button" disabled={Boolean(actionBusy)} onClick={() => openActionDialog("sendNow")} className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "send" ? "Sending..." : "Send Now"}</button>
                ) : null}
              </div>
            ) : null}

            {workspaceStatus === "SENDING" || workspaceStatus === "QUEUED" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold uppercase tracking-wide text-slate-500">Queue Controls</span>
                {queueState === "PAUSED" ? (
                  <button type="button" disabled={Boolean(actionBusy)} onClick={() => void runQueueControl("RESUME")} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "queue-resume" ? "Resuming..." : "Resume Queue"}</button>
                ) : (
                  <button type="button" disabled={Boolean(actionBusy)} onClick={() => void runQueueControl("PAUSE")} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "queue-pause" ? "Pausing..." : "Pause Queue"}</button>
                )}
                <button type="button" disabled={Boolean(actionBusy)} onClick={() => openActionDialog("cancelRemaining")} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "queue-cancel_remaining" ? "Cancelling..." : "Cancel Remaining"}</button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Utilities</span>
              <button type="button" disabled={Boolean(actionBusy)} onClick={() => void runDuplicate()} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "duplicate" ? "Duplicating..." : "Duplicate"}</button>
              {workspaceStatus !== "ARCHIVED" ? (
                <button type="button" disabled={Boolean(actionBusy)} onClick={() => openActionDialog("archive")} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{actionBusy === "archive" ? "Archiving..." : "Archive"}</button>
              ) : null}
            </div>
          </div>

          {actionError ? <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</p> : null}
          {actionNotice ? <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{actionNotice}</p> : null}
        </div>

        {validation ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validation Snapshot</p>
              <StatusBadge label={validation.valid ? "READY" : "BLOCKED"} tone={validation.valid ? "green" : "red"} />
            </div>
            {validation.blockers.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {validation.blockers.map((blocker) => <li key={blocker} className="rounded bg-red-50 px-2 py-1">{blocker}</li>)}
              </ul>
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <MetricChip label="Matched" value={String(validation.audience.totalMatched)} />
              <MetricChip label="Valid" value={String(validation.audience.finalSendCount)} />
              <MetricChip label="Missing Email" value={String(validation.audience.missingEmail)} />
              <MetricChip label="Invalid Email" value={String(validation.audience.invalidEmail)} />
            </div>
          </div>
        ) : null}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-base font-semibold text-slate-900">Live Delivery Progress</p>
                <p className="text-xs font-semibold text-slate-600">{progressPercent}%</p>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <MetricChip label="Queued" value={String(summary?.queued ?? 0)} />
                <MetricChip label="Sending" value={String(summary?.sending ?? queueStatusCounts.sending)} />
                <MetricChip label="Accepted" value={String(summary?.accepted ?? queueStatusCounts.accepted)} />
                <MetricChip label="Delivered" value={String(summary?.delivered ?? 0)} />
                <MetricChip label="Opened" value={String(summary?.opened ?? 0)} />
                <MetricChip label="Clicked" value={String(summary?.clicked ?? 0)} />
                <MetricChip label="Bounced" value={String(summary?.bounced ?? 0)} />
                <MetricChip label="Failed" value={String(summary?.failed ?? queueStatusCounts.failed)} />
                <MetricChip label="Unsubscribed" value={String(summary?.unsubscribed ?? queueStatusCounts.unsubscribed)} />
                <MetricChip label="Suppressed" value={String(summary?.suppressed ?? queueStatusCounts.suppressed)} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                <SendingProgressDonut
                  eligibleRecipients={totalAudience}
                  processedRecipients={completed}
                  progressPercent={progressPercent}
                />
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Progress Formula</p>
                  <p className="mt-1">eligibleRecipients = final send audience</p>
                  <p>processedRecipients = accepted + failed + bounced + suppressed + cancelled</p>
                  <p>sendProgressPercent = processedRecipients / eligibleRecipients * 100</p>
                  {!deliveryData?.diagnostics?.providerWebhookConfigured ? (
                    <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
                      Delivery tracking not configured: delivered/opened/clicked depend on provider webhooks.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <DeliveryFunnelChart
                  title="Delivery Funnel"
                  audience={totalAudience}
                  queued={summary?.queued ?? 0}
                  delivered={summary?.delivered ?? 0}
                  opened={summary?.opened ?? 0}
                  clicked={summary?.clicked ?? 0}
                  bounced={summary?.bounced ?? 0}
                />
                <EventTimelineChart title="Event Timeline" events={deliveryData?.events ?? []} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-base font-semibold text-slate-900">Recent Activity Feed</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {mergedActivity.length === 0 ? <p className="text-sm text-slate-500">Waiting for events.</p> : null}
                {mergedActivity.slice(0, 20).map((item) => (
                  <p key={item.key} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">{item.label}</p>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-semibold text-slate-900">Campaign Summary</p>
            <SummaryLine label="Audience" value={String(campaign.totalRecipients ?? 0)} />
            <SummaryLine label="Eligible Recipients" value={String(totalAudience)} />
            <SummaryLine label="Processed" value={String(completed)} />
            <SummaryLine label="Queued" value={String(summary?.queued ?? 0)} />
            <SummaryLine label="Delivered" value={String(summary?.delivered ?? 0)} />
            <SummaryLine label="Open Rate" value={summary ? `${summary.openRate}%` : "Not tracked yet"} />
            <SummaryLine label="Click Rate" value={summary ? `${summary.clickRate}%` : "Not tracked yet"} />
            <SummaryLine label="Bounce Rate" value={summary ? `${summary.bounceRate}%` : "Not tracked yet"} />
          </aside>
        </div>
      ) : null}

      {tab === "audience" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-semibold text-slate-900">Audience Validation</p>
            <p className="mt-1 text-sm text-slate-600">These checks come from backend audience preview for this campaign filter.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MetricChip label="Total Selected" value={String(audiencePreview?.totalMatched ?? 0)} />
              <MetricChip label="Valid Recipients" value={String(audiencePreview?.finalSendCount ?? 0)} />
              <MetricChip label="Missing Email" value={String(audiencePreview?.missingEmail ?? 0)} />
              <MetricChip label="Invalid Email" value={String(audiencePreview?.invalidEmail ?? 0)} />
              <MetricChip label="Duplicate Email" value={String(audiencePreview?.duplicateEmails ?? 0)} />
              <MetricChip label="Unsubscribed" value={String((audiencePreview?.optedOut ?? 0) + (audiencePreview?.categoryOptOut ?? 0))} />
              <MetricChip label="Suppressed" value={String(audiencePreview?.suppressed ?? 0)} />
              <MetricChip label="Do Not Email" value={String(audiencePreview?.doNotContact ?? 0)} />
              <MetricChip label="Hard Bounced" value="Not tracked yet" />
              <MetricChip label="Soft Bounced Recently" value="Not tracked yet" />
              <MetricChip label="Missing Merge Data" value="Not tracked yet" />
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-semibold text-slate-900">Audience Source</p>
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {campaign.audienceFilter ? campaign.audienceFilter : "No audience filter stored yet."}
            </p>
            <p className="mt-4 text-xs text-slate-500">Backend validation runs again immediately before queueing/sending so frontend settings cannot bypass compliance.</p>
          </article>
        </div>
      ) : null}

      {tab === "queue" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-900">Campaign Queue</p>
          <p className="mt-1 text-sm text-slate-600">Queued = accepted by provider. Delivered/Opened/Clicked only come from provider webhook events.</p>
          <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1320px] text-left text-xs">
              <thead className="bg-slate-50 uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-2 py-2">Recipient</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Last Event</th>
                  <th className="px-2 py-2">Attempt Count</th>
                  <th className="px-2 py-2">SMTP/Provider Response</th>
                  <th className="px-2 py-2">Queued At</th>
                  <th className="px-2 py-2">Sending Started At</th>
                  <th className="px-2 py-2">Sent At</th>
                  <th className="px-2 py-2">Delivered At</th>
                  <th className="px-2 py-2">Opened At</th>
                  <th className="px-2 py-2">Clicked At</th>
                  <th className="px-2 py-2">Bounced At</th>
                  <th className="px-2 py-2">Unsubscribed At</th>
                  <th className="px-2 py-2">Failure Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {queueRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-4 text-slate-500" colSpan={15}>Waiting for queue or delivery events.</td>
                  </tr>
                ) : null}
                {queueRows.map((row) => (
                  <tr key={row.email}>
                    <td className="px-2 py-2 font-medium text-slate-800">{row.recipientLabel}</td>
                    <td className="px-2 py-2">{row.email}</td>
                    <td className="px-2 py-2"><StatusBadge label={row.status} tone={statusTone(row.status)} /></td>
                    <td className="px-2 py-2">{row.lastEvent}</td>
                    <td className="px-2 py-2">{row.attemptCount}</td>
                    <td className="px-2 py-2">{row.providerResponse}</td>
                    <td className="px-2 py-2">{row.queuedAt}</td>
                    <td className="px-2 py-2">{row.sendingStartedAt}</td>
                    <td className="px-2 py-2">{row.sentAt}</td>
                    <td className="px-2 py-2">{row.deliveredAt}</td>
                    <td className="px-2 py-2">{row.openedAt}</td>
                    <td className="px-2 py-2">{row.clickedAt}</td>
                    <td className="px-2 py-2">{row.bouncedAt}</td>
                    <td className="px-2 py-2">{row.unsubscribedAt}</td>
                    <td className="px-2 py-2">{row.failureReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "analytics" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-base font-semibold text-slate-900">Delivery Summary</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <MetricChip label="Eligible Audience" value={String(totalAudience)} />
                <MetricChip label="Queued" value={String(summary?.queued ?? 0)} />
                <MetricChip label="Accepted" value={String(summary?.accepted ?? queueStatusCounts.accepted)} />
                <MetricChip label="Delivered" value={String(summary?.delivered ?? 0)} />
                <MetricChip label="Opened" value={String(summary?.opened ?? 0)} />
                <MetricChip label="Unique Opens" value={String(summary?.opened ?? 0)} />
                <MetricChip label="Clicked" value={String(summary?.clicked ?? 0)} />
                <MetricChip label="Unique Clicks" value={String(summary?.clicked ?? 0)} />
                <MetricChip label="Bounced" value={String(summary?.bounced ?? 0)} />
                <MetricChip label="Failed" value={String(summary?.failed ?? queueStatusCounts.failed)} />
                <MetricChip label="Suppressed" value={String(summary?.suppressed ?? queueStatusCounts.suppressed)} />
                <MetricChip label="Unsubscribed" value={String(summary?.unsubscribed ?? queueStatusCounts.unsubscribed)} />
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-base font-semibold text-slate-900">Recipient Event Stream</p>
              <div className="mt-3 max-h-[360px] space-y-2 overflow-auto">
                {(deliveryData?.events ?? []).slice(0, 40).map((event) => (
                  <p key={event.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {formatDateTime(event.eventAt)} — {event.eventType} — {event.recipientEmail}
                  </p>
                ))}
                {(deliveryData?.events ?? []).length === 0 ? <p className="text-sm text-slate-500">Waiting for delivery/open/click events.</p> : null}
              </div>
            </article>
          </div>

          <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-semibold text-slate-900">Diagnostics</p>
            <SummaryLine label="Webhook Status" value={deliveryData?.diagnostics?.providerWebhookConfigured ? "Configured" : "Not configured"} />
            <SummaryLine label="Last Event" value={deliveryData?.diagnostics?.lastEventAt ? formatDateTime(deliveryData.diagnostics.lastEventAt) : "Waiting for events"} />
            <SummaryLine label="Total Events" value={String(deliveryData?.diagnostics?.totalEvents ?? 0)} />
            <SummaryLine label="Unique Recipients" value={String(deliveryData?.diagnostics?.uniqueRecipients ?? 0)} />
            <SummaryLine label="Spam Complaints" value="Not tracked yet" />
          </aside>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-900">Activity Log</p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {mergedActivity.length === 0 ? <p className="text-sm text-slate-500">No activity logged yet.</p> : null}
            {mergedActivity.map((item) => (
              <p key={item.key} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">{item.label}</p>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-semibold text-slate-900">Campaign Setup</p>
            <SummaryLine label="Name" value={campaign.name || "-"} />
            <SummaryLine label="Purpose" value={campaign.purpose || "MARKETING"} />
            <SummaryLine label="Subject" value={campaign.subject || "-"} />
            <SummaryLine label="Preview" value={campaign.previewText || "-"} />
            <SummaryLine label="From Name" value={campaign.fromName || "-"} />
            <SummaryLine label="From Email" value={campaign.fromEmail || "-"} />
            <SummaryLine label="Reply-To" value={campaign.replyToEmail || "-"} />
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-base font-semibold text-slate-900">Compliance and Deliverability</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Send endpoints re-run audience and compliance checks before sending.</li>
              <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Delivery, open, and click counts are event-driven from delivery events.</li>
              <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Unknown values are shown as Not tracked yet, never fabricated.</li>
            </ul>
          </article>
        </div>
      ) : null}

      {actionDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">{campaignActionDialogTitle(actionDialog.kind)}</p>
              <p className="mt-1 text-sm text-slate-600">{campaignActionDialogDescription(actionDialog.kind)}</p>
            </div>
            <div className="space-y-4 px-5 py-4">
              {actionDialog.kind === "schedule" ? (
                <label className="block text-xs font-semibold text-slate-700">
                  Scheduled send time
                  <input
                    type="datetime-local"
                    value={actionDialog.scheduledAt}
                    onChange={(event) => setActionDialog((current) => current ? { ...current, scheduledAt: event.target.value } : current)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
              {actionDialog.kind === "sendTest" ? (
                <label className="block text-xs font-semibold text-slate-700">
                  Test recipient email
                  <input
                    type="email"
                    value={actionDialog.email}
                    onChange={(event) => setActionDialog((current) => current ? { ...current, email: event.target.value } : current)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {campaignActionDialogImpact(actionDialog.kind)}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setActionDialog(null)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void submitActionDialog()} disabled={Boolean(actionBusy)} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">
                {actionBusy ? "Working..." : campaignActionDialogConfirmLabel(actionDialog.kind)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CampaignWizardActionBar({
  backLabel,
  onBack,
  nextLabel,
  onNext,
  nextDisabled = false,
  secondaryAction,
}: {
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
      <button type="button" onClick={onBack} className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        {backLabel}
      </button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {secondaryAction}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center justify-center rounded-md border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

function NewCampaignWizardPanel({
  templates,
  lists,
  constituents,
  preferredTemplateId,
  temporarySegmentId,
  onCancel,
  pageMode,
  onCreated,
}: {
  templates: OyamaEmailCampaign[];
  lists: OyamaEmailRecipientList[];
  constituents: OyamaEmailConstituent[];
  preferredTemplateId: string | null;
  temporarySegmentId: string | null;
  onCancel: () => void;
  pageMode?: boolean;
  onCreated: (campaign: OyamaEmailCampaign) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [campaignName, setCampaignName] = useState("");
  const [purpose, setPurpose] = useState("MARKETING");
  const [emailType, setEmailType] = useState<(typeof CAMPAIGN_EMAIL_TYPE_OPTIONS)[number]>("Marketing / Newsletter");
  const [templateId, setTemplateId] = useState(preferredTemplateId || templates[0]?.id || "");
  const [subjectLine, setSubjectLine] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [preferenceCategory, setPreferenceCategory] = useState("MARKETING");

  const [audienceSource, setAudienceSource] = useState<(typeof CAMPAIGN_AUDIENCE_SOURCES)[number]>("Saved Lists");
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [manualRecipientsText, setManualRecipientsText] = useState("");
  const [selectedConstituentIds, setSelectedConstituentIds] = useState<string[]>([]);
  const [temporarySegment, setTemporarySegment] = useState<TemporaryEmailSegment | null>(null);
  const [loadedTemporarySegmentId, setLoadedTemporarySegmentId] = useState<string | null>(null);
  const [showAdvancedAudienceSources, setShowAdvancedAudienceSources] = useState(false);
  const [individualSearch, setIndividualSearch] = useState("");
  const [helpTopic, setHelpTopic] = useState<WorkflowHelpTopic | null>(null);
  const [segmentType, setSegmentType] = useState("active");
  const [audienceReviewConfirmed, setAudienceReviewConfirmed] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<CampaignAudiencePreviewResponse["audience"] | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  const [scheduleAt, setScheduleAt] = useState("");
  const [testRecipientEmail, setTestRecipientEmail] = useState("");

  const selectedTemplate = templates.find((row) => row.id === templateId) ?? null;
  const selectedListRecipientCount = useMemo(() => {
    if (selectedListIds.length === 0) return 0;
    const selected = new Set(selectedListIds);
    return lists.reduce((total, list) => (selected.has(list.id) ? total + (list.recipientsCount || 0) : total), 0);
  }, [lists, selectedListIds]);
  const manuallySelectedConstituentEmails = constituents
    .filter((row) => selectedConstituentIds.includes(row.id))
    .map((row) => (row.email || "").trim().toLowerCase())
    .filter(Boolean);
  const selectedConstituentEmails = Array.from(new Set([
    ...(temporarySegment?.recipientEmails ?? []),
    ...manuallySelectedConstituentEmails,
  ].map((email) => email.trim().toLowerCase()).filter(Boolean)));
  const manualEmails = normalizeManualEmails(manualRecipientsText);
  const filteredIndividuals = constituents
    .filter((row) => {
      const needle = individualSearch.trim().toLowerCase();
      if (!needle) return true;
      return [row.firstName, row.lastName, row.email].join(" ").toLowerCase().includes(needle);
    })
    .slice(0, 200);

  useEffect(() => {
    if (preferredTemplateId) {
      setTemplateId(preferredTemplateId);
    }
  }, [preferredTemplateId]);

  useEffect(() => {
    const mappedPurpose = mapEmailTypeToPurpose(emailType);
    setPurpose(mappedPurpose);
    setPreferenceCategory(requiresMarketingPreference(mappedPurpose) ? "MARKETING" : "TRANSACTIONAL");
  }, [emailType]);

  useEffect(() => {
    setTestRecipientEmail((current) => current || replyToEmail || fromEmail || "");
  }, [fromEmail, replyToEmail]);

  useEffect(() => {
    if (!temporarySegmentId || loadedTemporarySegmentId === temporarySegmentId) return;

    setLoadedTemporarySegmentId(temporarySegmentId);
    const segment = readTemporaryEmailSegment(temporarySegmentId);
    if (!segment) {
      setNotice("The temporary donation email segment was not found. Re-select donations to rebuild it.");
      return;
    }

    setTemporarySegment(segment);
    setAudienceSource("Individual Search");
    setAudienceReviewConfirmed(false);
    setCampaignName((current) => current || segment.name);
    setNotice(`Loaded temporary donation email segment with ${segment.recipientEmails.length} recipient${segment.recipientEmails.length === 1 ? "" : "s"}.`);
  }, [loadedTemporarySegmentId, temporarySegmentId]);

  useEffect(() => {
    const shouldUseSegmentPreview = audienceSource !== "Saved Lists" && audienceSource !== "Manual Recipients" && audienceSource !== "Individual Search";
    if (!shouldUseSegmentPreview) {
      setAudiencePreview(null);
      return;
    }
    const filterType = mapAudienceSourceToFilterType(audienceSource, segmentType);
    if (!filterType) {
      setAudiencePreview(null);
      return;
    }

    void apiFetch<CampaignAudiencePreviewResponse>("/api/email-campaigns/audience-preview", {
      method: "POST",
      body: JSON.stringify({ audienceFilter: { type: filterType }, purpose }),
    })
      .then((payload) => setAudiencePreview(payload.audience))
      .catch(() => setAudiencePreview(null));
  }, [audienceSource, purpose, segmentType]);

  const localAudienceSummary = useMemo(() => {
    if (audienceSource === "Manual Recipients") {
      return summarizeEmails(manualEmails);
    }

    if (audienceSource === "Individual Search") {
      return summarizeEmails(selectedConstituentEmails);
    }

    if (audienceSource === "Saved Lists") {
      return {
        totalSelected: selectedListIds.length,
        validRecipients: selectedListRecipientCount,
        missingEmail: "Validated at send time",
        invalidEmail: "Validated at send time",
        duplicateEmail: "Validated at send time",
        unsubscribed: "Validated at send time",
        suppressed: "Validated at send time",
        doNotEmail: "Validated at send time",
        hardBounced: "Validated at send time",
        softBounced: "Validated at send time",
        missingMerge: "Validated at send time",
      };
    }

    return {
      totalSelected: audiencePreview?.totalMatched ?? 0,
      validRecipients: audiencePreview?.finalSendCount ?? 0,
      missingEmail: audiencePreview?.missingEmail ?? 0,
      invalidEmail: audiencePreview?.invalidEmail ?? 0,
      duplicateEmail: audiencePreview?.duplicateEmails ?? 0,
      unsubscribed: (audiencePreview?.optedOut ?? 0) + (audiencePreview?.categoryOptOut ?? 0),
      suppressed: audiencePreview?.suppressed ?? 0,
      doNotEmail: audiencePreview?.doNotContact ?? 0,
      hardBounced: "Not tracked yet",
      softBounced: "Not tracked yet",
      missingMerge: "Not tracked yet",
    };
  }, [audiencePreview, audienceSource, manualEmails, selectedConstituentEmails, selectedListIds.length, selectedListRecipientCount]);

  const sendPayloadPreview = useMemo(
    () => buildSendPayload(audienceSource, selectedListIds, manualEmails, selectedConstituentEmails, segmentType),
    [audienceSource, manualEmails, segmentType, selectedConstituentEmails, selectedListIds],
  );

  const sendModeSummary = useMemo(
    () => summarizeSendPayload(sendPayloadPreview, {
      selectedListRecipientCount,
      segmentPreviewCount: audiencePreview?.finalSendCount ?? 0,
    }),
    [audiencePreview?.finalSendCount, selectedListRecipientCount, sendPayloadPreview],
  );
  const audiencePersistsWithCampaign = Boolean(buildAudienceFilter(audienceSource, segmentType));
  const explicitAudienceRequiresImmediateSend = !audiencePersistsWithCampaign;

  const validRecipientCount = useMemo(
    () => normalizeMetricCount(localAudienceSummary.validRecipients),
    [localAudienceSummary.validRecipients],
  );

  const canContinueFromSetup = Boolean(campaignName.trim() && subjectLine.trim() && fromName.trim() && isEmailLike(fromEmail) && isEmailLike(replyToEmail));
  const canContinueFromAudience = validRecipientCount > 0 && audienceReviewConfirmed;
  const finishLabel = explicitAudienceRequiresImmediateSend
    ? "Finish: Send Now"
    : scheduleAt
      ? "Finish: Schedule Campaign"
      : "Finish: Queue for Review";
  const nextLabel = step === 1
    ? "Next: Choose Template"
    : step === 2
      ? "Next: Audience"
      : step === 3
        ? "Next: Review & Compliance"
        : step === 4
          ? "Next: Queue / Send"
          : finishLabel;
  const backLabel = step === 1
    ? "Back to Campaigns"
    : step === 2
      ? "Back: Setup"
      : step === 3
        ? "Back: Template"
        : step === 4
          ? "Back: Audience"
          : "Back: Review";
  const nextDisabled = saving
    || (step === 1 && !canContinueFromSetup)
    || (step === 2 && !templateId)
    || (step === 3 && !canContinueFromAudience);

  function handleBack() {
    if (step === 1) {
      onCancel();
      return;
    }
    setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5);
  }

  function finishCampaign() {
    if (scheduleAt && !explicitAudienceRequiresImmediateSend) {
      void createOrSend("schedule");
      return;
    }
    if (explicitAudienceRequiresImmediateSend) {
      if (sendModeSummary.recipientCount <= 0) {
        setError("Select at least one valid recipient before sending.");
        return;
      }
      setSendConfirmOpen(true);
      return;
    }
    void createOrSend("queue");
  }

  function handleNext() {
    if (step === 1) {
      if (!canContinueFromSetup) {
        setError("Complete campaign name, subject, sender name, and sender email fields before continuing.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!templateId) {
        setError("Choose a reusable email template before continuing.");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!canContinueFromAudience) {
        setError("Review the audience summary and confirm you understand who will and will not receive this campaign.");
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
    finishCampaign();
  }

  async function createOrSend(action: "save" | "queue" | "send" | "schedule" | "test") {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const sendPayload = buildSendPayload(audienceSource, selectedListIds, manualEmails, selectedConstituentEmails, segmentType);
      const sendSummary = summarizeSendPayload(sendPayload, {
        selectedListRecipientCount,
        segmentPreviewCount: audiencePreview?.finalSendCount ?? 0,
      });

      if (action === "send") {
        if (sendSummary.recipientCount <= 0) {
          throw new Error("Select at least one valid recipient before sending.");
        }
        if (sendSummary.sendMode === "INDIVIDUAL" && sendSummary.recipientCount !== 1) {
          throw new Error("Single-recipient mode requires exactly one recipient.");
        }
      }

      if ((action === "queue" || action === "schedule") && explicitAudienceRequiresImmediateSend) {
        throw new Error("This explicit audience is temporary. Use Send now after review, or switch to a persisted segment before queueing or scheduling.");
      }

      const created = await apiFetch<OyamaEmailCampaign>("/api/email-campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: campaignName,
          purpose,
          subject: subjectLine,
          previewText,
          fromName,
          fromEmail,
          replyToEmail,
          bodyHtml: selectedTemplate?.bodyHtml || BUILDER_PLACEHOLDER_HTML,
          bodyText: htmlToText(selectedTemplate?.bodyHtml || BUILDER_PLACEHOLDER_HTML),
          templateJson: selectedTemplate?.id ? selectedTemplate.bodyHtml || null : null,
          audienceFilter: buildAudienceFilter(audienceSource, segmentType),
          preparationStatus: "DRAFT",
          preferenceCategory,
        }),
      });

      if (action === "test") {
        if (!isEmailLike(testRecipientEmail)) {
          throw new Error("Enter a valid test recipient email before sending a test.");
        }
        await apiFetch(`/api/email-campaigns/${created.id}/send-test`, {
          method: "POST",
          body: JSON.stringify({ toEmail: testRecipientEmail }),
        });
        setNotice(`Test email sent to ${testRecipientEmail}.`);
      }

      if (action === "queue") {
        await apiFetch(`/api/email-campaigns/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({ preparationStatus: "READY", status: "DRAFT" }),
        });
      }

      if (action === "schedule") {
        if (!scheduleAt) throw new Error("Select a schedule date/time first.");
        await apiFetch(`/api/email-campaigns/${created.id}/schedule`, {
          method: "POST",
          body: JSON.stringify({ scheduledAt: new Date(scheduleAt).toISOString() }),
        });
      }

      if (action === "send") {
        await apiFetch(`/api/email-campaigns/${created.id}/send`, {
          method: "POST",
          body: JSON.stringify(sendPayload),
        });
      }

      await onCreated(created);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={["rounded-xl border border-emerald-200 bg-white p-4 shadow-sm", pageMode ? "xl:p-6" : ""].join(" ")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-slate-900">New Campaign Workflow</p>
            <InfoTooltip label="About campaign workflow">
              This flow creates one send record. The template snapshot, audience review, validation state, schedule, and delivery history stay tied to the campaign after it is created.
            </InfoTooltip>
          </div>
          <p className="text-sm text-slate-600">Set the send details, choose the reusable content, confirm the audience, review the compliance snapshot, then deliver.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setHelpTopic("email-workflow")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">About This Flow</button>
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-100 bg-[linear-gradient(135deg,#f3fbf6,#ecf8ff)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Workflow</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <FlowNode label="Brief" active={step >= 1} />
          <FlowArrow />
          <FlowNode label="Content" active={step >= 2} />
          <FlowArrow />
          <FlowNode label="Audience" active={step >= 3} />
          <FlowArrow />
          <FlowNode label="Review" active={step >= 4} />
          <FlowArrow />
          <FlowNode label="Deliver" active={step >= 5} />
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="mt-4">
        <WorkspaceHint title="Workspace Structure" tone="slate">
          Templates are reusable content. Campaigns are send records that lock the audience, review state, queue history, and delivery results for one outbound run.
        </WorkspaceHint>
      </div>

      <div className="mt-4">
        <CampaignWizardActionBar
          backLabel={backLabel}
          onBack={handleBack}
          nextLabel={nextLabel}
          onNext={handleNext}
          nextDisabled={nextDisabled}
          secondaryAction={step === 5 ? <button type="button" onClick={() => void createOrSend("save")} disabled={saving} className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save Draft</button> : undefined}
        />
      </div>

      {step === 1 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 md:col-span-2">
            Start with the campaign brief and sender details. The next step chooses which reusable template snapshot this campaign will send.
          </div>
          <label className="text-xs font-semibold text-slate-700">Campaign Name<input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-700">Purpose<select value={purpose} onChange={(event) => setPurpose(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="MARKETING">MARKETING</option><option value="FUNDRAISING">FUNDRAISING</option><option value="NEWSLETTER">NEWSLETTER</option><option value="EVENT_PROMOTION">EVENT_PROMOTION</option><option value="THANK_YOU">THANK_YOU</option><option value="RECEIPT">RECEIPT</option><option value="TRANSACTIONAL">TRANSACTIONAL</option><option value="ADMINISTRATIVE">ADMINISTRATIVE</option><option value="PERSONAL">PERSONAL</option></select></label>
          <label className="text-xs font-semibold text-slate-700">Email Type<select value={emailType} onChange={(event) => setEmailType(event.target.value as (typeof CAMPAIGN_EMAIL_TYPE_OPTIONS)[number])} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">{CAMPAIGN_EMAIL_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Subject Line<input value={subjectLine} onChange={(event) => setSubjectLine(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-700 md:col-span-2">Preview Text<input value={previewText} onChange={(event) => setPreviewText(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-700">From Name<input value={fromName} onChange={(event) => setFromName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-700">From Email<input value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-700">Reply-To Email<input value={replyToEmail} onChange={(event) => setReplyToEmail(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-700">Preference Category<select value={preferenceCategory} onChange={(event) => setPreferenceCategory(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="MARKETING">MARKETING</option><option value="FUNDRAISING">FUNDRAISING</option><option value="TRANSACTIONAL">TRANSACTIONAL</option></select></label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">Choose the reusable template content for this campaign send.</p>
            <button type="button" onClick={() => setHelpTopic("email-workflow")} className="text-xs font-semibold text-emerald-700 hover:text-emerald-600">Why templates and campaigns are separate</button>
          </div>
          {selectedTemplate ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Template</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{selectedTemplate.name || "Untitled Template"}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedTemplate.subject || "No subject saved on this template yet."}</p>
                  <p className="mt-2 text-xs text-slate-500">{selectedTemplate.preparationStatus === "READY" ? "Ready template" : "Draft template"} • {selectedTemplate.purpose || "GENERAL"}</p>
                </div>
                <Link href={`/oyama-email/templates/${selectedTemplate.id}/builder`} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  Open Template Builder
                </Link>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.slice(0, 18).map((template) => (
              <button key={template.id} type="button" onClick={() => setTemplateId(template.id)} className={["rounded-xl border px-3 py-3 text-left", template.id === templateId ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"].join(" ")}>
                <p className="text-sm font-semibold text-slate-900">{template.name || "Untitled Template"}</p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{template.subject || "No subject"}</p>
                <p className="mt-2 text-[11px] text-slate-500">{template.preparationStatus === "READY" ? "Ready to send" : "Draft template"}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Choose Audience Source</p>
                <InfoTooltip label="Audience source guidance">
                  Saved lists are best for repeatable sends. Individual search and temporary segments are best for one-off outreach that staff should review before sending.
                </InfoTooltip>
              </div>
              <p className="text-xs text-slate-600">Pick the simplest source that matches this send. Use saved lists or direct constituent search for most one-off sends.</p>
            </div>
            <button type="button" onClick={() => setHelpTopic("email-audience")} className="text-xs font-semibold text-emerald-700 hover:text-emerald-600">Audience Help</button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recommended</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIMARY_CAMPAIGN_AUDIENCE_SOURCES.map((source) => (
                <button key={source} type="button" onClick={() => setAudienceSource(source)} className={["rounded-full border px-3 py-1 text-xs font-semibold", source === audienceSource ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>{source}</button>
              ))}
            </div>
            <button type="button" onClick={() => setShowAdvancedAudienceSources((current) => !current)} className="mt-3 text-xs font-semibold text-slate-700 hover:text-slate-900">
              {showAdvancedAudienceSources ? "Hide advanced audience sources" : "Show advanced audience sources"}
            </button>
            {showAdvancedAudienceSources ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {ADVANCED_CAMPAIGN_AUDIENCE_SOURCES.map((source) => (
                  <button key={source} type="button" onClick={() => setAudienceSource(source)} className={["rounded-full border px-3 py-1 text-xs font-semibold", source === audienceSource ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>{source}</button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
            <span className="font-semibold">{audienceSource}:</span> {CAMPAIGN_AUDIENCE_SOURCE_HELP[audienceSource]}
          </div>

          {audienceSource === "Saved Lists" ? (
            <div className="grid gap-2 md:grid-cols-2">
              {lists.map((list) => {
                const selected = selectedListIds.includes(list.id);
                return (
                  <button key={list.id} type="button" onClick={() => setSelectedListIds((prev) => selected ? prev.filter((id) => id !== list.id) : [...prev, list.id])} className={["rounded-lg border px-3 py-2 text-left", selected ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white"].join(" ")}>
                    <p className="text-sm font-semibold text-slate-900">{list.name}</p>
                    <p className="text-xs text-slate-600">Recipients: {list.recipientsCount}</p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {audienceSource === "Manual Recipients" ? (
            <label className="block text-xs font-semibold text-slate-700">Manual Recipients (comma/newline separated)
              <textarea value={manualRecipientsText} onChange={(event) => setManualRecipientsText(event.target.value)} rows={5} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          ) : null}

          {audienceSource === "Individual Search" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block flex-1 text-xs font-semibold text-slate-700">
                  Search Constituents
                  <input value={individualSearch} onChange={(event) => setIndividualSearch(event.target.value)} placeholder="Search by name or email..." className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{filteredIndividuals.length}</span> of {constituents.length}
                </div>
              </div>
              {temporarySegment ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{temporarySegment.name}</p>
                      <p className="mt-1">
                        Temporary segment from selected donations. {temporarySegment.recipientEmails.length} email recipient{temporarySegment.recipientEmails.length === 1 ? "" : "s"} will be included with any checked individuals below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTemporarySegment(null);
                        setAudienceReviewConfirmed(false);
                      }}
                      className="rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                    >
                      Remove Segment
                    </button>
                  </div>
                  <p className="mt-2 truncate text-[11px] text-blue-800">{temporarySegment.recipientEmails.slice(0, 6).join(", ")}{temporarySegment.recipientEmails.length > 6 ? "..." : ""}</p>
                </div>
              ) : null}
              <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 uppercase tracking-wide text-slate-600"><tr><th className="px-2 py-2" /><th className="px-2 py-2">Name</th><th className="px-2 py-2">Email</th></tr></thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredIndividuals.map((person) => {
                      const selected = selectedConstituentIds.includes(person.id);
                      return (
                        <tr key={person.id}>
                          <td className="px-2 py-2"><input type="checkbox" checked={selected} onChange={() => setSelectedConstituentIds((prev) => selected ? prev.filter((id) => id !== person.id) : [...prev, person.id])} /></td>
                          <td className="px-2 py-2">{[person.firstName, person.lastName].filter(Boolean).join(" ") || person.id}</td>
                          <td className="px-2 py-2">{person.email || "-"}</td>
                        </tr>
                      );
                    })}
                    {filteredIndividuals.length === 0 ? <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">No constituents match this search.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {audienceSource !== "Saved Lists" && audienceSource !== "Manual Recipients" && audienceSource !== "Individual Search" ? (
            <label className="block text-xs font-semibold text-slate-700">Segment/Status Filter
              <select value={segmentType} onChange={(event) => setSegmentType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="active">Active</option>
                <option value="lapsed">Lapsed</option>
                <option value="major">Major Donor</option>
                <option value="new">New Donor</option>
                <option value="volunteers">Volunteers</option>
              </select>
            </label>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-semibold text-slate-800">Audience Validation</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MetricChip label="Total Selected" value={String(localAudienceSummary.totalSelected)} />
              <MetricChip label="Valid recipients" value={String(localAudienceSummary.validRecipients)} />
              <MetricChip label="Missing email" value={String(localAudienceSummary.missingEmail)} />
              <MetricChip label="Invalid email" value={String(localAudienceSummary.invalidEmail)} />
              <MetricChip label="Duplicate email" value={String(localAudienceSummary.duplicateEmail)} />
              <MetricChip label="Unsubscribed" value={String(localAudienceSummary.unsubscribed)} />
              <MetricChip label="Suppressed" value={String(localAudienceSummary.suppressed)} />
              <MetricChip label="Do not email" value={String(localAudienceSummary.doNotEmail)} />
              <MetricChip label="Hard bounced" value={String(localAudienceSummary.hardBounced)} />
              <MetricChip label="Soft bounced recently" value={String(localAudienceSummary.softBounced)} />
              <MetricChip label="Missing merge data" value={String(localAudienceSummary.missingMerge)} />
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={audienceReviewConfirmed} onChange={(event) => setAudienceReviewConfirmed(event.target.checked)} /> I understand who will and will not receive this campaign.</label>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
            <p className="font-semibold text-emerald-900">Send Mode Preview</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MetricChip label="Mode" value={sendModeSummary.label} />
              <MetricChip label="Recipients" value={String(sendModeSummary.recipientCount)} />
            </div>
            <p className="mt-2 text-[11px] text-emerald-800">{sendModeSummary.detail}</p>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">Review & Compliance</p>
            <SummaryLine label="Subject exists" value={subjectLine.trim() ? "Pass" : "Fix"} />
            <SummaryLine label="From name exists" value={fromName.trim() ? "Pass" : "Fix"} />
            <SummaryLine label="From email exists" value={isEmailLike(fromEmail) ? "Pass" : "Fix"} />
            <SummaryLine label="Reply-to exists" value={isEmailLike(replyToEmail) ? "Pass" : "Fix"} />
            <SummaryLine label="Physical address" value="Check template footer" />
            <SummaryLine label="Unsubscribe link" value="Check template footer" />
            <SummaryLine label="Preference link" value="Check template footer" />
            <SummaryLine label="Plain text version" value="Auto-generated" />
            <SummaryLine label="SMTP settings" value="Checked at send time" />
            <SummaryLine label="Audience valid recipients" value={String(localAudienceSummary.validRecipients)} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold text-slate-900">Campaign Snapshot</p>
            <SummaryLine label="Campaign" value={campaignName || "-"} />
            <SummaryLine label="Template" value={selectedTemplate?.name || "Not selected"} />
            <SummaryLine label="Purpose" value={purpose} />
            <SummaryLine label="Email Type" value={emailType} />
            <SummaryLine label="Preference Category" value={preferenceCategory} />
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
            <span className="font-semibold">Send mode:</span> {sendModeSummary.label} • <span className="font-semibold">Recipients:</span> {sendModeSummary.recipientCount}
          </div>
          {explicitAudienceRequiresImmediateSend ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              This audience is an explicit selection or temporary segment. It is reviewable here and can be sent now, but it is not stored on the campaign for queueing or scheduling yet.
            </div>
          ) : null}
          <label className="block text-xs font-semibold text-slate-700">Schedule Send (optional)
            <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} disabled={explicitAudienceRequiresImmediateSend} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Test Recipient Email
            <input value={testRecipientEmail} onChange={(event) => setTestRecipientEmail(event.target.value)} placeholder="reviewer@organization.org" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Send a test first to verify sender details, footer links, and merge content before queueing or sending.
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Finish behavior</p>
            <p className="mt-1">
              {explicitAudienceRequiresImmediateSend
                ? "This audience is temporary, so finishing this workflow sends immediately after confirmation."
                : scheduleAt
                  ? "Because a schedule date is set, finishing this workflow schedules the campaign."
                  : "Without a schedule date, finishing this workflow queues the campaign for review."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void createOrSend("test")} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Send test email</button>
              <button type="button" onClick={finishCampaign} disabled={saving} className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">{finishLabel}</button>
            </div>
          </div>

          {sendConfirmOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4" onClick={() => setSendConfirmOpen(false)}>
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <p className="text-sm font-semibold text-slate-900">Confirm Send</p>
                <p className="mt-1 text-sm text-slate-600">
                  You are about to send using <span className="font-semibold text-slate-900">{sendModeSummary.label}</span> to <span className="font-semibold text-slate-900">{sendModeSummary.recipientCount}</span> recipient{sendModeSummary.recipientCount === 1 ? "" : "s"}.
                </p>
                <p className="mt-1 text-xs text-slate-500">{sendModeSummary.detail}</p>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setSendConfirmOpen(false)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      setSendConfirmOpen(false);
                      void createOrSend("send");
                    }}
                    className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Confirm send
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <CampaignWizardActionBar
          backLabel={backLabel}
          onBack={handleBack}
          nextLabel={nextLabel}
          onNext={handleNext}
          nextDisabled={nextDisabled}
          secondaryAction={step === 5 ? <button type="button" onClick={() => void createOrSend("save")} disabled={saving} className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save Draft</button> : undefined}
        />
      </div>

      <WorkflowHelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />
    </div>
  );
}

function parseAudienceFilterForPreview(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    if ("criteria" in (parsed as Record<string, unknown>)) {
      const criteria = (parsed as { criteria?: unknown }).criteria;
      return criteria && typeof criteria === "object" ? criteria as Record<string, unknown> : null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function WorkflowHelpModal({ topic, onClose }: { topic: WorkflowHelpTopic | null; onClose: () => void }) {
  if (!topic) return null;

  const content = topic === "email-workflow"
    ? {
        title: "Email Workflow",
        body: "Templates hold reusable content. Campaigns are the delivery record. The intended path is: define the campaign brief, choose the template snapshot, confirm the audience, review compliance, then queue, schedule, or send.",
      }
    : topic === "email-audience"
      ? {
          title: "Audience Sources",
          body: "Use Saved Lists for repeatable groups, Individual Search for one-off constituent picks, and segment-based sources when the audience should stay live with CRM data. Temporary donation audiences are reviewed here and can be sent immediately, but they are not yet stored for later queue or schedule runs.",
        }
      : {
          title: "Recipient Selection",
          body: "Letters work best when you first choose a template, then choose recipients, then optionally layer donation context. Lists and segments are best for batches. Individuals are best for one-off letters or spot checks.",
        };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{content.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{content.body}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </div>
    </div>
  );
}

function mapEmailTypeToPurpose(value: (typeof CAMPAIGN_EMAIL_TYPE_OPTIONS)[number]): string {
  if (value === "Marketing / Newsletter") return "NEWSLETTER";
  if (value === "Fundraising Appeal") return "FUNDRAISING";
  if (value === "Event Email") return "EVENT_PROMOTION";
  if (value === "Donor Stewardship") return "THANK_YOU";
  if (value === "Receipt / Acknowledgment") return "RECEIPT";
  if (value === "Transactional / Relationship") return "TRANSACTIONAL";
  return "ADMINISTRATIVE";
}

function requiresMarketingPreference(purpose: string): boolean {
  return purpose === "MARKETING" || purpose === "NEWSLETTER" || purpose === "FUNDRAISING" || purpose === "EVENT_PROMOTION";
}

function mapAudienceSourceToFilterType(source: (typeof CAMPAIGN_AUDIENCE_SOURCES)[number], segmentType: string): string | null {
  if (source === "Segments" || source === "Tags" || source === "Donor Status") return segmentType;
  if (source === "Campaign Donors") return "active";
  if (source === "Event Attendees") return "volunteers";
  if (source === "Monthly Donors") return "active";
  if (source === "Lapsed Donors") return "lapsed";
  if (source === "Major Donors") return "major";
  if (source === "Steward Path Enrollment") return "active";
  return null;
}

function buildAudienceFilter(source: (typeof CAMPAIGN_AUDIENCE_SOURCES)[number], segmentType: string): Record<string, string> | null {
  const type = mapAudienceSourceToFilterType(source, segmentType);
  return type ? { type } : null;
}

function buildSendPayload(
  source: (typeof CAMPAIGN_AUDIENCE_SOURCES)[number],
  selectedListIds: string[],
  manualEmails: string[],
  selectedConstituentEmails: string[],
  segmentType: string,
): Record<string, unknown> {
  if (source === "Saved Lists" && selectedListIds.length > 1) {
    return { sendMode: "MULTI_LIST", recipientListIds: selectedListIds };
  }
  if (source === "Saved Lists" && selectedListIds.length === 1) {
    return { sendMode: "SAVED_LIST", recipientListId: selectedListIds[0] };
  }
  if (source === "Manual Recipients") {
    return { sendMode: manualEmails.length <= 1 ? "INDIVIDUAL" : "LIST", recipientEmails: manualEmails };
  }
  if (source === "Individual Search") {
    return { sendMode: selectedConstituentEmails.length <= 1 ? "INDIVIDUAL" : "LIST", recipientEmails: selectedConstituentEmails };
  }
  const filterType = mapAudienceSourceToFilterType(source, segmentType);
  if (filterType) {
    return { sendMode: "SEGMENT", audienceFilter: { type: filterType } };
  }
  return { sendMode: "CAMPAIGN_AUDIENCE" };
}

function normalizeMetricCount(value: string | number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseInt(String(value || "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeSendPayload(
  payload: Record<string, unknown>,
  context: {
    selectedListRecipientCount: number;
    segmentPreviewCount: number;
  },
): {
  sendMode: string;
  label: string;
  recipientCount: number;
  detail: string;
} {
  const sendMode = typeof payload.sendMode === "string" ? payload.sendMode : "CAMPAIGN_AUDIENCE";
  const recipientEmails = Array.isArray(payload.recipientEmails)
    ? payload.recipientEmails.map((value) => String(value)).filter(Boolean)
    : [];

  const recipientCount = (() => {
    if (sendMode === "INDIVIDUAL" || sendMode === "LIST") {
      return recipientEmails.length;
    }
    if (sendMode === "SAVED_LIST" || sendMode === "MULTI_LIST") {
      return context.selectedListRecipientCount;
    }
    return context.segmentPreviewCount;
  })();

  if (sendMode === "INDIVIDUAL") {
    return {
      sendMode,
      label: "Single Recipient",
      recipientCount,
      detail: "This send targets exactly one recipient address.",
    };
  }

  return {
    sendMode,
    label: "Batch Recipients",
    recipientCount,
    detail: "This send uses a batch audience source (lists, segments, or multiple recipients).",
  };
}

function normalizeManualEmails(value: string): string[] {
  return Array.from(new Set(value
    .split(/[\n,;]+/)
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean)));
}

function readTemporaryEmailSegment(id: string): TemporaryEmailSegment | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(`oyama-email:temporary-recipient-segment:${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TemporaryEmailSegment>;
    const recipientEmails = Array.from(new Set((Array.isArray(parsed.recipientEmails) ? parsed.recipientEmails : [])
      .map((email) => String(email || "").trim().toLowerCase())
      .filter((email) => email && isEmailLike(email))));

    if (recipientEmails.length === 0) return null;

    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : `Temporary email segment (${recipientEmails.length})`,
      recipientEmails,
      donationIds: Array.isArray(parsed.donationIds) ? parsed.donationIds.map((donationId) => String(donationId)).filter(Boolean) : [],
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      source: typeof parsed.source === "string" ? parsed.source : undefined,
    };
  } catch {
    return null;
  }
}

function summarizeEmails(emails: string[]) {
  const invalid = emails.filter((email) => !isEmailLike(email)).length;
  const valid = emails.filter((email) => isEmailLike(email)).length;
  return {
    totalSelected: emails.length,
    validRecipients: valid,
    missingEmail: 0,
    invalidEmail: invalid,
    duplicateEmail: emails.length - new Set(emails).size,
    unsubscribed: "Not tracked yet",
    suppressed: "Not tracked yet",
    doNotEmail: "Not tracked yet",
    hardBounced: "Not tracked yet",
    softBounced: "Not tracked yet",
    missingMerge: "Not tracked yet",
  };
}

function isEmailLike(value: string): boolean {
  return /.+@.+\..+/.test(value.trim());
}

function trackedMetric(value: number, status: string): string {
  if (value > 0) return String(value);
  return waitingMetric(status);
}

function waitingMetric(status: string): string {
  const normalized = status.toUpperCase();
  if (["SENDING", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "FAILED", "UNSUBSCRIBED"].includes(normalized)) {
    return "Waiting for events";
  }
  return "Not tracked yet";
}

function buildQueueStatusCounts(rows: CampaignQueueRow[]) {
  const counts = {
    total: rows.length,
    queued: 0,
    sending: 0,
    accepted: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
    suppressed: 0,
    unsubscribed: 0,
    cancelled: 0,
    processed: 0,
  };

  for (const row of rows) {
    const status = row.status.toUpperCase();
    if (status === "QUEUED") counts.queued += 1;
    else if (status === "SENDING") counts.sending += 1;
    else if (status === "SENT") counts.accepted += 1;
    else if (status === "DELIVERED") {
      counts.accepted += 1;
      counts.delivered += 1;
    } else if (status === "OPENED") {
      counts.accepted += 1;
      counts.delivered += 1;
      counts.opened += 1;
    } else if (status === "CLICKED") {
      counts.accepted += 1;
      counts.delivered += 1;
      counts.opened += 1;
      counts.clicked += 1;
    } else if (status === "BOUNCED") counts.bounced += 1;
    else if (status === "FAILED") counts.failed += 1;
    else if (status === "SUPPRESSED") counts.suppressed += 1;
    else if (status === "UNSUBSCRIBED") counts.unsubscribed += 1;
    else if (status === "CANCELLED") counts.cancelled += 1;
  }

  counts.processed = counts.accepted + counts.failed + counts.bounced + counts.suppressed + counts.cancelled;
  return counts;
}

async function streamCampaignLiveUpdates(
  campaignId: string,
  onSnapshot: (snapshot: CampaignLiveSnapshot) => void,
  signal: AbortSignal,
) {
  const response = await apiFetchResponse(`/api/email-campaigns/${campaignId}/stream`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error("Failed to open campaign stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let splitIndex = buffer.indexOf("\n\n");
    while (splitIndex !== -1) {
      const block = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);
      splitIndex = buffer.indexOf("\n\n");

      const parsed = parseSseBlock(block);
      if (!parsed || parsed.event !== "snapshot") continue;

      try {
        const payload = JSON.parse(parsed.data) as CampaignLiveSnapshot;
        onSnapshot(payload);
      } catch {
        // Ignore malformed stream payloads and continue listening.
      }
    }
  }
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  if (!block.trim()) return null;
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

function FlowNode({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={[
      "inline-flex items-center rounded-full border px-3 py-1 font-semibold",
      active ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600",
    ].join(" ")}>
      {label}
    </span>
  );
}

function FlowArrow() {
  return <span className="text-slate-400">-&gt;</span>;
}

function SendingProgressDonut({
  eligibleRecipients,
  processedRecipients,
  progressPercent,
}: {
  eligibleRecipients: number;
  processedRecipients: number;
  progressPercent: number;
}) {
  const clampedPercent = Math.max(0, Math.min(100, progressPercent));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((clampedPercent / 100) * circumference);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Sending Progress</p>
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 120 120" className="h-24 w-24">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#0f766e"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="58" textAnchor="middle" className="fill-slate-900 text-[18px] font-semibold">{clampedPercent}%</text>
          <text x="60" y="75" textAnchor="middle" className="fill-slate-500 text-[9px] uppercase">complete</text>
        </svg>
        <div className="text-xs text-slate-700">
          <p><span className="font-semibold text-slate-900">Eligible:</span> {eligibleRecipients}</p>
          <p><span className="font-semibold text-slate-900">Processed:</span> {processedRecipients}</p>
          <p><span className="font-semibold text-slate-900">Remaining:</span> {Math.max(0, eligibleRecipients - processedRecipients)}</p>
        </div>
      </div>
    </div>
  );
}

function DeliveryFunnelChart({
  title,
  audience,
  queued,
  delivered,
  opened,
  clicked,
  bounced,
}: {
  title: string;
  audience: number;
  queued: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}) {
  const maxValue = Math.max(1, audience, queued, delivered, opened, clicked, bounced);
  const items = [
    { label: "Audience", value: audience, color: "bg-slate-500" },
    { label: "Queued", value: queued, color: "bg-blue-500" },
    { label: "Delivered", value: delivered, color: "bg-emerald-500" },
    { label: "Opened", value: opened, color: "bg-violet-500" },
    { label: "Clicked", value: clicked, color: "bg-amber-500" },
    { label: "Bounced", value: bounced, color: "bg-rose-500" },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-white">
              <div
                className={["h-2 rounded-full", item.color].join(" ")}
                style={{ width: `${Math.max(2, Math.round((item.value / maxValue) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventTimelineChart({ title, events }: { title: string; events: DeliveryEventRow[] }) {
  const points = useMemo(() => {
    const now = Date.now();
    const start = now - (24 * 60 * 60 * 1000);
    const buckets = new Array(12).fill(0);
    for (const event of events) {
      const ts = new Date(event.eventAt).getTime();
      if (!Number.isFinite(ts) || ts < start || ts > now) continue;
      const ratio = (ts - start) / (24 * 60 * 60 * 1000);
      const idx = Math.min(11, Math.max(0, Math.floor(ratio * 12)));
      buckets[idx] += 1;
    }
    const maxBucket = Math.max(1, ...buckets);
    return buckets.map((value, idx) => ({
      x: (idx / 11) * 100,
      y: 100 - Math.round((value / maxBucket) * 92),
      value,
    }));
  }, [events]);

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <svg viewBox="0 0 100 100" className="h-28 w-full rounded bg-slate-50">
        <path d="M0 100 L100 100" stroke="#cbd5e1" strokeWidth="1" fill="none" />
        <path d={path || "M0 100 L100 100"} stroke="#0f766e" strokeWidth="2" fill="none" />
        {points.map((point) => (
          <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="1.5" fill="#0f766e" />
        ))}
      </svg>
      <p className="mt-2 text-[11px] text-slate-500">Last 24 hours of queue/delivery/open/click events.</p>
    </div>
  );
}

function AudienceView({
  lists,
  summary,
}: {
  lists: OyamaEmailRecipientList[];
  summary: {
    total: number;
    valid: number;
    missingEmail: number;
    unsubscribed: number;
    doNotEmail: number;
    suppressed: number;
    duplicatesRemoved: number;
  };
}) {
  return (
    <section className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:p-6">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-2xl font-semibold text-slate-900">Audience Sources</p>
        <p className="text-sm text-slate-600">Use saved lists and selection sources before entering the send wizard.</p>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">List</th>
                <th className="px-3 py-2">Recipients</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lists.map((list) => (
                <tr key={list.id}>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-900">{list.name}</p>
                    <p className="text-xs text-slate-500">{list.description || "Saved recipient list"}</p>
                  </td>
                  <td className="px-3 py-2">{list.recipientsCount}</td>
                  <td className="px-3 py-2">{formatDate(list.updatedAt)}</td>
                  <td className="px-3 py-2"><WorkspaceAction href="/oyama-email/send">Start Campaign Flow</WorkspaceAction></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Current Validation Snapshot</p>
        <SummaryLine label="Total Selected" value={String(summary.total)} />
        <SummaryLine label="Valid" value={String(summary.valid)} />
        <SummaryLine label="Missing Email" value={String(summary.missingEmail)} />
        <SummaryLine label="Unsubscribed" value={String(summary.unsubscribed)} />
        <SummaryLine label="Suppressed" value={String(summary.suppressed)} />
      </aside>
    </section>
  );
}

function EmailQueueView({ campaigns }: { campaigns: OyamaEmailCampaign[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const rows = useMemo(() => campaigns.filter((row) => {
    const needle = search.trim().toLowerCase();
    if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
    if (!needle) return true;
    return `${row.name} ${row.subject || ""} ${row.fromEmail || ""}`.toLowerCase().includes(needle);
  }), [campaigns, search, statusFilter]);
  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(campaigns.map((row) => row.status))).sort();
    return ["ALL", ...values];
  }, [campaigns]);

  return (
    <section className="space-y-4 p-4 xl:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-2xl font-semibold text-slate-900">Email Queue</p>
        <p className="mt-1 text-sm text-slate-600">Drafted, scheduled, sending, sent, failed, and cancelled email send records live here. Reusable templates stay in the template library.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search email records..."
            className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm sm:w-auto sm:min-w-64"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            aria-label="Filter email queue by status"
          >
            {statusOptions.map((value) => <option key={value} value={value}>{value === "ALL" ? "All statuses" : statusLabel(value)}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Scheduled</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Recipients</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-slate-500" colSpan={6}>No email send records matched this view.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.subject || "No subject"}</p>
                </td>
                <td className="px-3 py-2"><StatusBadge label={statusLabel(row.status)} tone={statusTone(row.status)} /></td>
                <td className="px-3 py-2">{formatDateTime(row.scheduledAt || "")}</td>
                <td className="px-3 py-2">{formatDateTime(row.sentAt || "")}</td>
                <td className="px-3 py-2">{row.totalRecipients}</td>
                <td className="px-3 py-2"><WorkspaceAction href={`/oyama-email/campaigns/${row.id}?tab=overview`}>Open</WorkspaceAction></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalyticsView({ campaigns, stats }: { campaigns: OyamaEmailCampaign[]; stats: OyamaEmailStats | null }) {
  const topRows = [...campaigns]
    .filter((row) => row.status === "SENT")
    .sort((a, b) => b.delivered - a.delivered)
    .slice(0, 8);

  return (
    <section className="space-y-4 p-4 xl:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-2xl font-semibold text-slate-900">Analytics</p>
        <p className="mt-1 text-sm text-slate-600">Track sent volume, engagement, and delivery health.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Campaigns" value={String(stats?.total ?? campaigns.length)} />
        <StatCard label="Sent" value={String(stats?.sent ?? 0)} />
        <StatCard label="Scheduled" value={String(stats?.scheduled ?? 0)} />
        <StatCard label="Recipients Sent" value={String(stats?.totalRecipientsSent ?? 0)} />
        <StatCard label="Avg Open Rate" value={`${stats?.avgOpenRate ?? 0}%`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Delivered</th>
              <th className="px-3 py-2">Opened</th>
              <th className="px-3 py-2">Clicked</th>
              <th className="px-3 py-2">Bounced</th>
              <th className="px-3 py-2">Unsubscribed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {topRows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-slate-500" colSpan={6}>No sent campaign analytics available yet.</td>
              </tr>
            ) : null}
            {topRows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">{formatDate(row.sentAt || row.updatedAt)}</p>
                </td>
                <td className="px-3 py-2">{row.delivered}</td>
                <td className="px-3 py-2">{row.opened}</td>
                <td className="px-3 py-2">{row.clicked}</td>
                <td className="px-3 py-2">{row.bounced}</td>
                <td className="px-3 py-2">{row.unsubscribed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmailDocsView() {
  const walkthroughs = [
    {
      title: "Build a reusable email",
      summary: "Create the content once, preview it with real recipient data, then publish it for campaign use.",
      steps: [
        "Open Templates and create or select a template.",
        "Add content blocks, write the subject and preview text, and resolve the readiness items.",
        "Use Recipient Preview to check merge fields, mobile layout, plain text, and compliance output.",
        "Send a proof to one reviewer, then continue to Publish & Compliance.",
      ],
      actions: [
        { href: "/oyama-email/templates", label: "Open Templates" },
        { href: "/oyama-email/templates/new", label: "Create Template" },
      ],
    },
    {
      title: "Create and send a campaign",
      summary: "Templates hold reusable design; campaigns hold one audience, review history, and delivery run.",
      steps: [
        "Start a campaign and select a published template.",
        "Choose the audience source and review eligible, suppressed, opted-out, and duplicate counts.",
        "Run validation and send a test email to a reviewer address.",
        "Queue, schedule, or send only from the campaign review step.",
      ],
      actions: [
        { href: "/oyama-email/campaigns/new", label: "Start Campaign" },
        { href: "/oyama-email/campaigns", label: "Open Campaigns" },
      ],
    },
    {
      title: "Review delivery and troubleshoot",
      summary: "Use the canonical queue and campaign activity records to understand what happened after approval.",
      steps: [
        "Open Email Queue to find drafts, scheduled campaigns, active sends, failures, and completed sends.",
        "Open the campaign record to review delivery totals and recipient-level events.",
        "Check suppression and preference status before retrying a failed recipient.",
        "Use Organization Settings for sender defaults and compliance configuration.",
      ],
      actions: [
        { href: "/oyama-email/queue", label: "Open Email Queue" },
        { href: "/oyama-email/settings", label: "Open Settings" },
      ],
    },
  ] as const;

  return (
    <main className="min-w-0 flex-1 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4f1_100%)] p-4 sm:p-6 xl:p-8">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[24px] border border-emerald-900/10 bg-[linear-gradient(135deg,#073b2b,#0b6241)] p-6 text-white shadow-[0_22px_55px_rgba(6,78,59,0.18)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">OyamaEmail documentation</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">How to build, review, and send email</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/90">Follow the task guides below. Sending always stays reviewable: editing a template or sending a proof never sends to the campaign audience.</p>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {walkthroughs.map((guide, index) => (
            <article key={guide.title} className="flex flex-col rounded-[22px] border border-white bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-800">{index + 1}</span>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">{guide.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
              <ol className="mt-4 flex-1 space-y-3">
                {guide.steps.map((step, stepIndex) => (
                  <li key={step} className="flex gap-3 text-sm leading-5 text-slate-700">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{stepIndex + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {guide.actions.map((action, actionIndex) => (
                  <Link key={action.href} href={action.href} className={actionIndex === 0 ? "inline-flex h-9 items-center rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-600" : "inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"}>{action.label}</Link>
                ))}
              </div>
            </article>
          ))}
        </div>

        <section className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50/90 p-5">
          <h2 className="text-base font-semibold text-amber-950">Before a production send</h2>
          <div className="mt-3 grid gap-2 text-sm text-amber-900 sm:grid-cols-2 lg:grid-cols-4">
            {["Audience totals reviewed", "Opt-outs and suppressions honored", "Proof email approved", "Subject, links, sender, and schedule confirmed"].map((item) => <p key={item} className="rounded-lg border border-amber-200 bg-white/60 px-3 py-2">✓ {item}</p>)}
          </div>
        </section>
      </div>
    </main>
  );
}

function SettingsView() {
  return (
    <section className="grid gap-4 p-4 xl:grid-cols-2 xl:p-6">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-slate-900">Email Delivery Settings</p>
          <InfoTooltip label="About delivery settings">
            Sender identity, reply handling, and delivery infrastructure are managed globally so every template and campaign uses the same trusted defaults.
          </InfoTooltip>
        </div>
        <p className="mt-2 text-sm text-slate-600">Manage sender details, SMTP setup, and organization-level communications defaults.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <WorkspaceAction href="/settings">Open CRM Settings</WorkspaceAction>
          <WorkspaceAction href="/settings/branding">Open Branding</WorkspaceAction>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-slate-900">Compliance and Domain Health</p>
          <InfoTooltip label="About compliance checks">
            Publish and send validation runs before live delivery. These checks are meant to catch opt-out, footer, and sender problems before staff queue a campaign.
          </InfoTooltip>
        </div>
        <p className="mt-2 text-sm text-slate-600">Configure policy defaults used by Publish and Send validation checks.</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Default preference category required for marketing sends</li>
          <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Unsubscribe + physical address checks enabled</li>
          <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">Plain-text generation required before publish</li>
        </ul>
      </article>
    </section>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "slate" }) {
  const toneClass = tone === "green"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>{label}</span>;
}

function WorkspaceAction({
  href,
  children,
  tone = "default",
}: {
  href: string;
  children: ReactNode;
  tone?: "default" | "primary";
}) {
  return (
    <Link href={href} className={[
      "inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-semibold",
      tone === "primary"
        ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-600"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ].join(" ")}>
      {children}
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value || "-"}</span>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Alert({ children, tone }: { children: ReactNode; tone: "error" | "success" }) {
  return (
    <div className={[
      "mx-4 mt-4 rounded-lg border px-4 py-3 text-sm xl:mx-6",
      tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800",
    ].join(" ")}>
      {children}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex min-h-[420px] items-center justify-center text-sm font-semibold text-slate-500">{label}</div>;
}

function SideIcon({ label }: { label: string }) {
  const paths: Record<string, string> = {
    Templates: "M4 5h16v14H4zM8 9h8M8 13h8",
    "Send Email": "M3 12h18M5 7l7 5 7-5",
    Campaigns: "M5 19h14M8 16V9m4 7V6m4 10v-4",
    Calendar: "M8 7V4m8 3V4M4 10h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
    Audience: "M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    Queue: "M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01",
    "Email Queue": "M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01",
    Analytics: "M4 19h16M7 16V9m5 7V6m5 10v-4",
    "Docs & Walkthroughs": "M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Zm0 0A2.5 2.5 0 0 1 7.5 7H20M10 11h6m-6 4h4",
    Settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-12v3m0 12v3M4.9 4.9 7 7m10 10 2.1 2.1M3 12h3m12 0h3",
    "Help Center": "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 14h.01M10.8 9.1a1.8 1.8 0 1 1 2.9 1.4c-.8.6-1.2 1-1.2 2",
  };
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[label] ?? paths.Templates} />
    </svg>
  );
}

function EmailLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#g)" />
      <path d="M24 10c6.6 5.2 10.1 10 10.1 15 0 6.1-4.5 10.7-10.1 13-5.6-2.3-10.1-6.9-10.1-13 0-5 3.5-9.8 10.1-15Z" fill="white" fillOpacity="0.95" />
      <path d="M24 16v19M14.7 24h18.6" stroke="#0c5134" strokeWidth="2.2" strokeLinecap="round" />
      <defs>
        <linearGradient id="g" x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0e7a45" />
          <stop offset="1" stopColor="#04462f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ChevronLeft() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" /></svg>;
}

function ChevronRight() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" /></svg>;
}

function workspaceTitle(view: OyamaEmailView): string {
  if (view === "templates") return "Email Template Library";
  if (view === "builder") return "Email Builder";
  if (view === "publish") return "Publish & Compliance";
  if (view === "callender") return "Calendar";
  if (view === "queue") return "Email Queue";
  if (view === "docs") return "Docs & Walkthroughs";
  if (view === "campaigns" || view === "send" || view === "audience" || view === "analytics") return "Campaigns";
  return "Settings";
}

function workspaceSubtitle(view: OyamaEmailView, campaign: OyamaEmailCampaign | null): string {
  if (view === "builder") return `Design and configure your email template${campaign ? `: ${campaign.name}` : ""}.`;
  if (view === "publish") return "Review compliance checks and publish this template for send workflows.";
  if (view === "send") return "Use the New Campaign wizard inside Campaigns for one-direction flow.";
  if (view === "templates") return "Start with reusable content here, then move into the campaign workflow for audience, review, and send steps.";
  if (view === "callender") return "Manage all upcoming email schedules with timeline planning and quick campaign access.";
  if (view === "queue") return "Drafted, queued, sent, failed, and cancelled email records with one status source.";
  if (view === "docs") return "Task-based guides for templates, campaigns, proofs, sending, and delivery review.";
  if (view === "campaigns" || view === "audience" || view === "analytics") {
    return "One canonical campaign workflow: setup, template, audience, review, then queue, schedule, or send from the campaign record.";
  }
  return "Configure delivery defaults and compliance policy behavior.";
}

function effectiveCampaignStatus(campaign: OyamaEmailCampaign): string {
  return (campaign.workspaceStatus || campaign.status || "DRAFT").toUpperCase();
}

function statusLabel(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "NEEDS_REVIEW") return "Needs Review";
  if (normalized === "READY") return "Ready";
  if (normalized === "SCHEDULED") return "Scheduled";
  if (normalized === "QUEUED") return "Queued";
  if (normalized === "SENDING") return "Sending";
  if (normalized === "SENT") return "Sent";
  if (normalized === "DELIVERED") return "Delivered";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "CANCELLED") return "Cancelled";
  if (normalized === "ARCHIVED") return "Archived";
  return "Draft";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function filenameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function safeDownloadName(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "template";
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function toDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid-date";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  const normalized = status.toUpperCase();
  if (normalized === "SENT" || normalized === "DELIVERED") return "green";
  if (normalized === "SCHEDULED" || normalized === "SENDING" || normalized === "DRAFT" || normalized === "READY" || normalized === "NEEDS_REVIEW" || normalized === "QUEUED") return "amber";
  if (normalized === "CANCELLED" || normalized === "FAILED") return "red";
  return "slate";
}

function campaignActionDialogTitle(kind: CampaignActionDialogKind): string {
  if (kind === "schedule") return "Schedule Campaign";
  if (kind === "unschedule") return "Unschedule Campaign";
  if (kind === "sendNow") return "Send Campaign Now";
  if (kind === "sendTest") return "Send Test Email";
  if (kind === "archive") return "Archive Campaign";
  return "Cancel Remaining Recipients";
}

function campaignActionDialogDescription(kind: CampaignActionDialogKind): string {
  if (kind === "schedule") return "Choose when this campaign should move into the scheduled send queue.";
  if (kind === "unschedule") return "Remove the scheduled send time and return the campaign to manual control.";
  if (kind === "sendNow") return "Start sending to the campaign audience immediately after server-side validation runs.";
  if (kind === "sendTest") return "Send a proof copy to one inbox before you queue or send the live campaign.";
  if (kind === "archive") return "Hide this campaign from the active command center while keeping its history.";
  return "Stop any remaining unsent recipients in the current queue run.";
}

function campaignActionDialogImpact(kind: CampaignActionDialogKind): string {
  if (kind === "schedule") return "Scheduling preserves the draft and lets staff review the exact send time before delivery starts.";
  if (kind === "unschedule") return "Unscheduling removes the pending send time but keeps the campaign record and audience intact.";
  if (kind === "sendNow") return "The server will re-check audience eligibility, unsubscribe rules, and deliverability before sending.";
  if (kind === "sendTest") return "Test sends go only to the address entered here and do not deliver to the full campaign audience.";
  if (kind === "archive") return "Archived campaigns stay in history and analytics but are removed from active day-to-day workflow lists.";
  return "Already processed recipients are preserved. Only the remaining unsent audience will be cancelled.";
}

function campaignActionDialogConfirmLabel(kind: CampaignActionDialogKind): string {
  if (kind === "schedule") return "Schedule Campaign";
  if (kind === "unschedule") return "Unschedule Campaign";
  if (kind === "sendNow") return "Send Now";
  if (kind === "sendTest") return "Send Test";
  if (kind === "archive") return "Archive Campaign";
  return "Cancel Remaining";
}

function complianceChecks(draft: BuilderDraft): Array<{ key: string; label: string; detail: string; passed: boolean; required: boolean }> {
  const mergeFields = extractMergeTokens(draft.bodyHtml);
  const hasAddressMergeField = mergeFields.some((token) => ADDRESS_COMPLIANCE_MERGE_TOKENS.has(token));
  return [
    { key: "subject", label: "Subject Line", detail: draft.subject || "Missing subject line", passed: Boolean(draft.subject.trim()), required: true },
    { key: "preview", label: "Preview Text", detail: draft.previewText || "Missing preview text", passed: Boolean(draft.previewText.trim()), required: true },
    { key: "fromName", label: "From Name", detail: draft.fromName || "Missing from name", passed: Boolean(draft.fromName.trim()), required: true },
    { key: "fromEmail", label: "From Email", detail: draft.fromEmail || "Missing from email", passed: /.+@.+\..+/.test(draft.fromEmail.trim()), required: true },
    { key: "reply", label: "Reply-To Email", detail: draft.replyToEmail || "Missing reply-to email", passed: /.+@.+\..+/.test(draft.replyToEmail.trim()), required: true },
    { key: "unsubscribe", label: "Unsubscribe Link", detail: "Include unsubscribe link in body/footer", passed: /unsubscribe/i.test(draft.bodyHtml), required: true },
    { key: "address", label: "Physical Address", detail: "Include physical mailing address in footer", passed: hasAddressMergeField || /(street|ave|road|st\.|po box|zip|[0-9]{5})/i.test(draft.bodyHtml), required: true },
    { key: "plainText", label: "Plain Text Version", detail: "Auto-generated plain text is available", passed: Boolean(htmlToText(draft.bodyHtml)), required: true },
    { key: "merge", label: "Merge Fields", detail: mergeFields.length > 0 ? `${mergeFields.length} merge fields detected` : "No merge fields used", passed: true, required: false },
  ];
}

const ADDRESS_COMPLIANCE_MERGE_TOKENS = new Set([
  "{{organization.address}}",
  "{{addressBlock}}",
  "{{organizationAddress}}",
]);

function extractMergeTokens(value: string): string[] {
  return Array.from(new Set((value.match(/\{\{\s*[^{}]+\s*\}\}/g) ?? []).map((token) => token.trim())));
}

function purposeLabel(value: string): string {
  const upper = value.trim().toUpperCase();
  if (upper.includes("NEWSLETTER")) return "Newsletter";
  if (upper.includes("THANK")) return "Thank You";
  if (upper.includes("APPEAL") || upper.includes("FUNDRAIS")) return "Appeals";
  if (upper.includes("EVENT")) return "Events";
  if (upper.includes("RECEIPT")) return "Receipts";
  if (upper.includes("STEWARD")) return "Steward Paths";
  return "Newsletter";
}

function toPercent(value: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function htmlToText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
