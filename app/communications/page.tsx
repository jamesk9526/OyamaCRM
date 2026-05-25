"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CommunicationsSegmentsPanel from "@/app/components/communications/CommunicationsSegmentsPanel";
import CommunicationsSettingsPanel from "@/app/components/communications/CommunicationsSettingsPanel";
import CommunicationsTemplatesPanel from "@/app/components/communications/CommunicationsTemplatesPanel";
import EmailProjectLibrary from "@/app/components/communications/EmailProjectLibrary";
import NewCampaignModal from "@/app/components/communications/NewCampaignModal";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonFrame from "@/app/components/workspace-ribbon/WorkspaceRibbonFrame";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import EmptyStateCard from "@/app/components/ui/EmptyStateCard";
import ActionButton from "@/app/components/ui/ActionButton";
import StewardContextButton from "@/app/components/ai/StewardContextButton";
import { apiFetch } from "@/app/lib/auth-client";

type CampaignPreparationStatus = "NOT_STARTED" | "DRAFT" | "READY";
type WorkspaceTab =
  | "overview"
  | "email-campaigns"
  | "email-drafts"
  | "templates"
  | "segments"
  | "send-queue"
  | "communication-log"
  | "settings";

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  templateJson?: string | null;
  ownerId?: string | null;
  sharedWithOrganization?: boolean;
  preparationStatus?: CampaignPreparationStatus;
  status: string;
  sentAt?: string;
  scheduledAt?: string;
  totalRecipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  createdAt: string;
  updatedAt: string;
  fromName: string;
  fromEmail: string;
}

interface Stats {
  total: number;
  sent: number;
  scheduled: number;
  draft: number;
  totalRecipientsSent: number;
  avgOpenRate: number;
}

interface StewardPathEmailDraft {
  id: string;
  enrollmentId: string;
  status: string;
  subject: string;
  updatedAt: string;
  step?: {
    id: string;
    name: string;
    stepType: string;
  };
  enrollment?: {
    id: string;
    path?: {
      id: string;
      name: string;
    };
    constituent?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string | null;
    };
  };
}

interface CommunicationLogItem {
  id: string;
  title: string;
  channel: string;
  status: string;
  commonStatus: string;
  at: string;
  href: string;
  detail: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-600" },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  SENDING: { label: "Sending", color: "bg-amber-100 text-amber-700" },
  SENT: { label: "Sent", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Canceled", color: "bg-red-100 text-red-600" },
};

const PREPARATION_STATUS_CONFIG: Record<CampaignPreparationStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-slate-100 text-slate-700" },
  DRAFT: { label: "Draft", color: "bg-amber-100 text-amber-700" },
  READY: { label: "Ready", color: "bg-emerald-100 text-emerald-700" },
};

const WORKSPACE_TABS: WorkspaceTab[] = [
  "overview",
  "email-campaigns",
  "email-drafts",
  "templates",
  "segments",
  "send-queue",
  "communication-log",
  "settings",
];

const REVIEW_REQUIRED_PATH_STATUSES = new Set(["DRAFT_CREATED", "READY_FOR_REVIEW"]);
const ACTIVE_PATH_STATUSES = new Set(["DRAFT_CREATED", "READY_FOR_REVIEW", "APPROVED"]);

function formatDate(v?: string) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(v?: string) {
  if (!v) return "-";
  return new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function pct(n: number, d: number) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

function toCommonStatus(channel: "email" | "pathDraft", status: string): string {
  if (channel === "email") {
    if (status === "DRAFT") return "Draft";
    if (status === "SCHEDULED" || status === "SENDING") return "Scheduled";
    if (status === "SENT") return "Sent";
    if (status === "CANCELLED") return "Canceled";
    return status;
  }

  if (status === "DRAFT_CREATED") return "Draft";
  if (status === "READY_FOR_REVIEW") return "Needs Review";
  if (status === "APPROVED") return "Approved";
  if (status === "SENT") return "Sent";
  if (status === "FAILED") return "Failed";
  if (status === "SKIPPED") return "Canceled";
  return status;
}

/** CommunicationsPage is the donor email outreach hub for campaign projects, drafts, queues, and logs. */
export default function CommunicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pathDrafts, setPathDrafts] = useState<StewardPathEmailDraft[]>([]);

  const [loading, setLoading] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("email-campaigns");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [creatingFromTemplateId, setCreatingFromTemplateId] = useState<string | null>(null);
  const [cloneSourceCampaign, setCloneSourceCampaign] = useState<EmailCampaign | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneNameError, setCloneNameError] = useState<string | null>(null);
  const [sharingUpdateId, setSharingUpdateId] = useState<string | null>(null);
  const [preparationUpdateId, setPreparationUpdateId] = useState<string | null>(null);
  const [campaignDeleteCandidate, setCampaignDeleteCandidate] = useState<EmailCampaign | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignResult, statsResult, pathDraftsResult] = await Promise.allSettled([
        apiFetch<EmailCampaign[]>("/api/email-campaigns"),
        apiFetch<Stats>("/api/email-campaigns/stats"),
        apiFetch<StewardPathEmailDraft[]>("/api/steward-paths/email-drafts?limit=120"),
      ]);

      setCampaigns(campaignResult.status === "fulfilled" ? campaignResult.value : []);
      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setPathDrafts(pathDraftsResult.status === "fulfilled" ? pathDraftsResult.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Optional query-driven view support for deep-linking to a workspace view. */
  useEffect(() => {
    const view = searchParams.get("view");
    if (!view) return;
    if (WORKSPACE_TABS.includes(view as WorkspaceTab)) {
      setWorkspaceTab(view as WorkspaceTab);
    }
  }, [searchParams]);

  /** Opens the new-campaign flow from project-library deep links. */
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowModal(true);
    }
  }, [searchParams]);

  /** Updates local workspace tab and keeps query view in sync for shareable links. */
  function selectWorkspaceTab(nextTab: WorkspaceTab) {
    setWorkspaceTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextTab);
    router.replace(`/communications?${params.toString()}`);
  }

  async function sendNow(id: string) {
    setSending(id);
    try {
      await apiFetch(`/api/email-campaigns/${id}/send`, { method: "POST" });
      await load();
    } finally {
      setSending(null);
    }
  }

  function openDeleteCampaignModal(id: string) {
    const candidate = campaigns.find((campaign) => campaign.id === id);
    if (!candidate) return;
    setCampaignDeleteCandidate(candidate);
  }

  async function confirmDeleteCampaign() {
    if (!campaignDeleteCandidate) return;

    setDeletingCampaignId(campaignDeleteCandidate.id);
    try {
      await apiFetch(`/api/email-campaigns/${campaignDeleteCandidate.id}`, { method: "DELETE" });
      setCampaignDeleteCandidate(null);
      await load();
    } finally {
      setDeletingCampaignId(null);
    }
  }

  function closeCloneCampaignModal() {
    if (creatingFromTemplateId) return;
    setCloneSourceCampaign(null);
    setCloneName("");
    setCloneNameError(null);
  }

  function openCloneCampaignModal(templateCampaignId: string) {
    const source = campaigns.find((campaign) => campaign.id === templateCampaignId);
    if (!source) return;

    setCloneSourceCampaign(source);
    setCloneName(`${source.name} Copy`);
    setCloneNameError(null);
  }

  /** Creates a new draft campaign by cloning content from an existing template-ready campaign. */
  async function createCampaignFromTemplate() {
    if (!cloneSourceCampaign) return;

    const source = cloneSourceCampaign;
    const nextCloneName = cloneName.trim();
    if (!nextCloneName) {
      setCloneNameError("Campaign name is required.");
      return;
    }

    setCloneNameError(null);
    setCreatingFromTemplateId(source.id);
    try {
      const created = await apiFetch<EmailCampaign>("/api/email-campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: nextCloneName,
          subject: source.subject,
          bodyHtml: source.bodyHtml ?? null,
          bodyText: source.bodyText ?? null,
          templateJson: source.templateJson ?? null,
          fromName: source.fromName,
          fromEmail: source.fromEmail,
          audienceFilter: { type: "all" },
          sharedWithOrganization: false,
          preparationStatus: "DRAFT",
        }),
      });

      closeCloneCampaignModal();
      await load();
      openEditor(created.id);
    } finally {
      setCreatingFromTemplateId(null);
    }
  }

  async function toggleCampaignVisibility(campaign: EmailCampaign) {
    setSharingUpdateId(campaign.id);
    try {
      await apiFetch(`/api/email-campaigns/${campaign.id}`, {
        method: "PUT",
        body: JSON.stringify({
          sharedWithOrganization: !campaign.sharedWithOrganization,
        }),
      });
      await load();
    } finally {
      setSharingUpdateId(null);
    }
  }

  /** Updates campaign preparation state used by review/send workflows. */
  async function setPreparationStatus(campaign: EmailCampaign, preparationStatus: CampaignPreparationStatus) {
    setPreparationUpdateId(campaign.id);
    try {
      await apiFetch(`/api/email-campaigns/${campaign.id}`, {
        method: "PUT",
        body: JSON.stringify({ preparationStatus }),
      });
      await load();
    } finally {
      setPreparationUpdateId(null);
    }
  }

  /** Builds an email-builder href with return-path context. */
  function buildBuilderHref(id: string): string {
    return `/communications/${id}?mode=build`;
  }

  function openEditor(id: string) {
    router.push(buildBuilderHref(id));
  }

  function openWorkspace(id: string) {
    router.push(`/communications/${id}`);
  }

  const filteredCampaigns = statusFilter === "all"
    ? campaigns
    : campaigns.filter((campaign) => campaign.status === statusFilter);

  const scheduledCampaigns = campaigns.filter((campaign) => campaign.status === "SCHEDULED" || campaign.status === "SENDING");
  const sentThisWeek = campaigns.filter((campaign) => {
    if (!campaign.sentAt) return false;
    const sentAt = new Date(campaign.sentAt).getTime();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return sentAt >= sevenDaysAgo;
  }).length;

  const draftsNeedingReview = campaigns.filter((campaign) => campaign.status === "DRAFT").length
    + pathDrafts.filter((draft) => REVIEW_REQUIRED_PATH_STATUSES.has(draft.status)).length;
  const failedCommunications = pathDrafts.filter((draft) => draft.status === "FAILED").length
    + campaigns.filter((campaign) => campaign.status === "CANCELLED").length;
  const activePathDrafts = pathDrafts.filter((draft) => ACTIVE_PATH_STATUSES.has(draft.status)).length;

  const communicationLog = useMemo<CommunicationLogItem[]>(() => {
    const campaignLog: CommunicationLogItem[] = campaigns.map((campaign) => ({
      id: `campaign-${campaign.id}`,
      title: campaign.name,
      channel: "Email Campaign",
      status: campaign.status,
      commonStatus: toCommonStatus("email", campaign.status),
      at: campaign.sentAt || campaign.updatedAt,
      href: `/communications/${campaign.id}`,
      detail: campaign.subject || "No subject",
    }));

    const pathDraftLog: CommunicationLogItem[] = pathDrafts.map((draft) => ({
      id: `path-draft-${draft.id}`,
      title: draft.subject,
      channel: "Steward Path Draft",
      status: draft.status,
      commonStatus: toCommonStatus("pathDraft", draft.status),
      at: draft.updatedAt,
      href: "/automations",
      detail: draft.enrollment?.path?.name || "Steward Path",
    }));

    return [...campaignLog, ...pathDraftLog]
      .filter((item) => Boolean(item.at))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [campaigns, pathDrafts]);

  return (
    <WorkspaceRibbonFrame
      title="Communications"
      description="Campaign library for creating, building, sending, and managing donor email projects."
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "Communications", href: "/communications" },
        { label: "Campaign Library" },
      ]}
      statusLabel="Partially Working"
      metadata={`${campaigns.length} campaigns · ${draftsNeedingReview} drafts needing review · ${scheduledCampaigns.length} scheduled`}
      primaryAction={(
        <WorkspaceRibbonButton label="New Campaign" onClick={() => setShowModal(true)} variant="primary" />
      )}
      ribbon={(
        <WorkspaceRibbon>
          <WorkspaceRibbonGroup label="Email Projects">
            <WorkspaceRibbonButton label="Campaign Library" onClick={() => selectWorkspaceTab("email-campaigns")} variant="primary" />
            <WorkspaceRibbonButton label="New Email" onClick={() => setShowModal(true)} />
            <WorkspaceRibbonButton label="Templates" onClick={() => selectWorkspaceTab("templates")} />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Queues">
            <WorkspaceRibbonButton label="Drafts" onClick={() => selectWorkspaceTab("email-drafts")} />
            <WorkspaceRibbonButton label="Scheduled" onClick={() => selectWorkspaceTab("send-queue")} />
            <WorkspaceRibbonButton label="Sent Log" onClick={() => selectWorkspaceTab("communication-log")} />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Setup">
            <WorkspaceRibbonButton label="Segments" onClick={() => selectWorkspaceTab("segments")} />
            <WorkspaceRibbonButton label="Branding" href="/settings/branding" />
            <WorkspaceRibbonButton label="Settings" onClick={() => selectWorkspaceTab("settings")} />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>
      )}
    >
      <div className="space-y-6">
      {workspaceTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <OverviewCard label="Drafts Needing Review" value={draftsNeedingReview} hint="Campaign + path drafts" tone="amber" />
            <OverviewCard label="Scheduled Sends" value={scheduledCampaigns.length} hint="Queue to monitor" tone="blue" />
            <OverviewCard label="Sent This Week" value={sentThisWeek} hint="Recent outbound" tone="green" />
            <OverviewCard label="Failed Communications" value={failedCommunications} hint="Requires retry" tone="red" />
            <OverviewCard label="Active Path Drafts" value={activePathDrafts} hint="Open steward steps" tone="indigo" />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Recent Communication Activity</h2>
              <Link href="/communications" className="text-xs text-gray-500 hover:text-gray-700">Open workspace</Link>
            </div>
            <div className="mt-3 space-y-2">
              {communicationLog.slice(0, 10).map((item) => (
                <Link key={item.id} href={item.href} className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <span className="text-xs text-gray-500">{formatDateTime(item.at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.channel} · {item.commonStatus} · {item.detail}</p>
                </Link>
              ))}
              {communicationLog.length === 0 && (
                <EmptyStateCard
                  className="px-4 py-8"
                  title="No communication activity yet"
                  description="Start an email campaign or a steward draft to generate a complete outreach timeline here."
                  actions={(
                    <>
                      <ActionButton label="Create Campaign" variant="primary" onClick={() => setShowModal(true)} />
                      <ActionButton label="Open Segments" variant="secondary" onClick={() => selectWorkspaceTab("segments")} />
                      <StewardContextButton
                        label="Ask Steward"
                        prompt="We have no communication activity yet. Recommend the first donor outreach sequence we should launch this week."
                        moduleKey="donor"
                        mode="ask"
                        variant="mini"
                      />
                    </>
                  )}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {workspaceTab === "email-campaigns" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon="EM" label="Campaigns Sent" value={String(stats?.sent ?? "-")} sub="All time" />
            <StatCard icon="OR" label="Avg Open Rate" value={stats ? `${stats.avgOpenRate}%` : "-"} sub="Across sent campaigns" highlight={stats != null && stats.avgOpenRate >= 25} />
            <StatCard icon="DR" label="Draft" value={String(stats?.draft ?? "-")} sub="Ready to send" />
            <StatCard icon="SQ" label="Scheduled" value={String(stats?.scheduled ?? "-")} sub="Queued to send" />
          </div>

          <div className="flex gap-1 border-b border-gray-200">
            {["all", "DRAFT", "SCHEDULED", "SENT", "CANCELLED"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? "text-green-700 border-b-2 border-green-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {status === "all" ? "All Campaigns" : STATUS_CONFIG[status]?.label ?? status}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((row) => <div key={row} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <EmptyState onNew={() => setShowModal(true)} />
          ) : (
            <EmailProjectLibrary
              campaigns={filteredCampaigns}
              sendingId={sending}
              sharingUpdateId={sharingUpdateId}
              preparationUpdateId={preparationUpdateId}
              onSend={(campaignId) => void sendNow(campaignId)}
              onBuild={openEditor}
              onOpen={openWorkspace}
              onToggleSharing={(campaign) => void toggleCampaignVisibility(campaign)}
              onPreparationStatusChange={(campaign, nextStatus) => void setPreparationStatus(campaign, nextStatus)}
              onDelete={openDeleteCampaignModal}
            />
          )}
        </div>
      )}

      {workspaceTab === "email-drafts" && (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Steward Path Email Drafts</h2>
            <p className="text-xs text-gray-500 mt-0.5">Draft-first review queue generated by stewardship steps.</p>
            <div className="mt-3 space-y-2">
              {pathDrafts.slice(0, 12).map((draft) => (
                <Link key={draft.id} href="/automations" className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{draft.subject}</p>
                    <span className="text-xs text-gray-500">{toCommonStatus("pathDraft", draft.status)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {draft.enrollment?.path?.name || "Steward Path"}
                    {draft.enrollment?.constituent
                      ? ` · ${draft.enrollment.constituent.firstName} ${draft.enrollment.constituent.lastName}`
                      : ""}
                    {` · Updated ${formatDateTime(draft.updatedAt)}`}
                  </p>
                </Link>
              ))}
              {pathDrafts.length === 0 && (
                <EmptyStateCard
                  className="px-4 py-8"
                  title="No steward path drafts yet"
                  description="Draft-first stewardship messages will appear here after Steward Paths generate follow-up drafts."
                  actions={(
                    <>
                      <ActionButton label="Open Steward Paths" variant="primary" href="/automations" />
                      <ActionButton label="Create Campaign" variant="secondary" onClick={() => setShowModal(true)} />
                      <StewardContextButton
                        label="Ask Steward"
                        prompt="No steward path drafts are queued. Suggest what path we should launch first to create quality donor follow-up drafts."
                        moduleKey="donor"
                        mode="ask"
                        variant="mini"
                      />
                    </>
                  )}
                />
              )}
            </div>
          </section>

        </div>
      )}

      {workspaceTab === "templates" && (
        <CommunicationsTemplatesPanel
          campaigns={campaigns}
          creatingFromTemplateId={creatingFromTemplateId}
          onOpenTemplate={openEditor}
          onCreateFromTemplate={(campaignId) => {
            openCloneCampaignModal(campaignId);
          }}
          onDeleteTemplate={openDeleteCampaignModal}
        />
      )}

      {workspaceTab === "segments" && (
        <CommunicationsSegmentsPanel />
      )}

      {workspaceTab === "send-queue" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Scheduled and In-Flight Sends</h2>
          <div className="mt-3 space-y-2">
            {scheduledCampaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{campaign.name}</p>
                  <p className="text-xs text-gray-500">{campaign.status === "SCHEDULED" ? "Scheduled" : "Sending"}</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {campaign.scheduledAt ? `Schedule: ${formatDateTime(campaign.scheduledAt)}` : "No scheduled time"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => void sendNow(campaign.id)}
                    disabled={sending === campaign.id}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-60"
                  >
                    {sending === campaign.id ? "Sending..." : "Send Now"}
                  </button>
                  <Link href={`/communications/${campaign.id}`} className="px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Open Workspace</Link>
                </div>
              </div>
            ))}
            {scheduledCampaigns.length === 0 && (
              <EmptyStateCard
                className="px-4 py-8"
                title="No queued sends right now"
                description="Schedule a campaign to build your send queue and keep outbound communication predictable."
                actions={(
                  <>
                    <ActionButton label="Create Campaign" variant="primary" onClick={() => setShowModal(true)} />
                    <ActionButton label="Open Drafts" variant="secondary" onClick={() => selectWorkspaceTab("email-drafts")} />
                    <StewardContextButton
                      label="Ask Steward"
                      prompt="There are no queued sends. Recommend a weekly send cadence and what campaign should be scheduled next."
                      moduleKey="donor"
                      mode="ask"
                      variant="mini"
                    />
                  </>
                )}
              />
            )}
          </div>
        </section>
      )}

      {workspaceTab === "communication-log" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Unified Communication Log</h2>
          <p className="text-xs text-gray-500 mt-0.5">Search and export filters are in progress; this list is the current unified timeline view.</p>
          <div className="mt-3 space-y-2">
            {communicationLog.slice(0, 50).map((item) => (
              <Link key={item.id} href={item.href} className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(item.at)}</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{item.channel} · {item.commonStatus} · {item.detail}</p>
              </Link>
            ))}
            {communicationLog.length === 0 && (
              <EmptyStateCard
                className="px-4 py-8"
                title="No communication entries yet"
                description="As campaigns send and stewardship drafts progress, a unified timeline of all outreach appears here."
                actions={(
                  <>
                    <ActionButton label="Create Campaign" variant="primary" onClick={() => setShowModal(true)} />
                    <ActionButton label="Open Queue" variant="secondary" onClick={() => selectWorkspaceTab("send-queue")} />
                    <StewardContextButton
                      label="Ask Steward"
                      prompt="No communication log entries exist yet. Recommend the first three outreach actions we should take to build momentum."
                      moduleKey="donor"
                      mode="ask"
                      variant="mini"
                    />
                  </>
                )}
              />
            )}
          </div>
        </section>
      )}

      {workspaceTab === "settings" && (
        <CommunicationsSettingsPanel />
      )}

      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => {
            setShowModal(false);
            void load();
            openEditor(id);
          }}
        />
      )}

      {cloneSourceCampaign && (
        <WorkspaceSetupModal
          title="Clone Campaign"
          subtitle="Create a new draft campaign by copying template content from an existing campaign."
          checklist={["1. Confirm source campaign", "2. Name the cloned draft", "3. Open editor"]}
          onClose={closeCloneCampaignModal}
          maxWidthClassName="max-w-3xl"
        >
          <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source Campaign</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{cloneSourceCampaign.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">Subject: {cloneSourceCampaign.subject || "No subject"}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">New Draft Name</label>
              <input
                type="text"
                value={cloneName}
                onChange={(event) => setCloneName(event.target.value)}
                disabled={creatingFromTemplateId === cloneSourceCampaign.id}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Campaign copy name"
              />
              {cloneNameError && <p className="mt-1 text-xs text-red-600">{cloneNameError}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeCloneCampaignModal}
                disabled={creatingFromTemplateId === cloneSourceCampaign.id}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createCampaignFromTemplate()}
                disabled={creatingFromTemplateId === cloneSourceCampaign.id}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
              >
                {creatingFromTemplateId === cloneSourceCampaign.id ? "Creating..." : "Create Draft"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}

      {campaignDeleteCandidate && (
        <WorkspaceSetupModal
          title="Delete Campaign"
          subtitle="This action permanently deletes the campaign and cannot be undone."
          checklist={["1. Verify campaign name", "2. Confirm permanent delete"]}
          onClose={() => {
            if (deletingCampaignId) return;
            setCampaignDeleteCandidate(null);
          }}
          maxWidthClassName="max-w-3xl"
        >
          <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Destructive action</p>
              <p className="mt-1 text-sm text-red-800">
                Delete <span className="font-semibold">{campaignDeleteCandidate.name}</span> and remove its campaign record.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCampaignDeleteCandidate(null)}
                disabled={Boolean(deletingCampaignId)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteCampaign()}
                disabled={Boolean(deletingCampaignId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deletingCampaignId ? "Deleting..." : "Delete Campaign"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
      </div>
    </WorkspaceRibbonFrame>
  );
}

function OverviewCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "green" | "blue" | "amber" | "orange" | "red" | "indigo";
}) {
  const toneClass = {
    green: "text-green-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    orange: "text-orange-700",
    red: "text-red-700",
    indigo: "text-indigo-700",
  }[tone];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
    </div>
  );
}

function CampaignCard({
  campaign: campaignRecord,
  sending,
  sharingUpdating,
  preparationUpdating,
  onSend,
  onEdit,
  onWorkspace,
  onToggleSharing,
  onPreparationStatusChange,
  onDelete,
}: {
  campaign: EmailCampaign;
  sending: boolean;
  sharingUpdating: boolean;
  preparationUpdating: boolean;
  onSend: () => void;
  onEdit: () => void;
  onWorkspace: () => void;
  onToggleSharing: () => void;
  onPreparationStatusChange: (status: CampaignPreparationStatus) => void;
  onDelete: () => void;
}) {
  const statusConfig = STATUS_CONFIG[campaignRecord.status] ?? STATUS_CONFIG.DRAFT;
  const preparationConfig = PREPARATION_STATUS_CONFIG[campaignRecord.preparationStatus ?? "DRAFT"];
  const isSent = campaignRecord.status === "SENT";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{campaignRecord.name}</h3>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${preparationConfig.color}`}>
              {preparationConfig.label}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${campaignRecord.sharedWithOrganization ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {campaignRecord.sharedWithOrganization ? "Shared" : "Private"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            Subject: <span className="text-gray-700">{campaignRecord.subject || <em className="text-gray-400">No subject</em>}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            From: {campaignRecord.fromName} &lt;{campaignRecord.fromEmail}&gt;
            {isSent && campaignRecord.sentAt && <> · Sent {formatDate(campaignRecord.sentAt)}</>}
            {campaignRecord.status === "SCHEDULED" && campaignRecord.scheduledAt && <> · Scheduled {formatDate(campaignRecord.scheduledAt)}</>}
            {!isSent && campaignRecord.status !== "SCHEDULED" && <> · Updated {formatDate(campaignRecord.updatedAt)}</>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {(campaignRecord.status === "DRAFT" || campaignRecord.status === "SCHEDULED") && (
            <button
              onClick={onSend}
              disabled={sending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Now"}
            </button>
          )}
          {campaignRecord.status === "DRAFT" && (
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={onWorkspace}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Workspace
          </button>
          <select
            value={campaignRecord.preparationStatus ?? "DRAFT"}
            onChange={(event) => onPreparationStatusChange(event.target.value as CampaignPreparationStatus)}
            disabled={preparationUpdating}
            className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
            title="Set campaign preparation attribute"
          >
            <option value="NOT_STARTED">Not Started</option>
            <option value="DRAFT">Draft</option>
            <option value="READY">Ready</option>
          </select>
          <button
            onClick={onToggleSharing}
            disabled={sharingUpdating}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {sharingUpdating ? "Saving..." : campaignRecord.sharedWithOrganization ? "Make Private" : "Share"}
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {isSent && campaignRecord.totalRecipients > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniStat label="Recipients" value={campaignRecord.totalRecipients.toLocaleString()} />
          <MiniStat label="Delivered" value={pct(campaignRecord.delivered, campaignRecord.totalRecipients)} sub={campaignRecord.delivered.toLocaleString()} color="text-blue-600" />
          <MiniStat label="Opened" value={pct(campaignRecord.opened, campaignRecord.delivered)} sub={campaignRecord.opened.toLocaleString()} color={campaignRecord.opened / campaignRecord.delivered > 0.25 ? "text-green-600" : "text-amber-600"} />
          <MiniStat label="Clicked" value={pct(campaignRecord.clicked, campaignRecord.opened)} sub={campaignRecord.clicked.toLocaleString()} color="text-purple-600" />
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, color = "text-gray-900" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function StatCard({ icon, label, value, sub, highlight }: { icon: string; label: string; value: string; sub?: string; highlight?: boolean | null }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${highlight ? "border-green-200" : "border-gray-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-semibold text-gray-600">{icon}</span>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-green-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <EmptyStateCard
      title="No campaigns yet"
      description="Create a campaign to plan donor outreach, track engagement, and move messages from draft to sent with confidence."
      icon={(
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      )}
      actions={(
        <>
          <ActionButton label="Create Campaign" variant="primary" onClick={onNew} />
          <ActionButton label="Open Segments" variant="secondary" href="/communications?view=segments" />
          <StewardContextButton
            label="Ask Steward"
            prompt="We have no email campaigns yet. Suggest a practical first campaign plan with audience, message, and send sequence."
            moduleKey="donor"
            mode="ask"
            variant="mini"
          />
        </>
      )}
    />
  );
}

