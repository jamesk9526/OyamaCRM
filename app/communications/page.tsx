"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NewCampaignModal from "@/app/components/communications/NewCampaignModal";
import { apiFetch } from "@/app/lib/auth-client";

type CampaignPreparationStatus = "NOT_STARTED" | "DRAFT" | "READY";
type WorkspaceTab =
  | "overview"
  | "email-campaigns"
  | "email-drafts"
  | "letters"
  | "templates"
  | "segments"
  | "send-queue"
  | "communication-log"
  | "settings";

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
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

interface LetterDashboardStats {
  activeTemplates: number;
  generatedThisMonth: number;
  thankYouPending: number;
  taxReceiptsGenerated: number;
  emailDrafts: number;
}

interface GeneratedLetterRecord {
  id: string;
  templateId: string;
  category: string;
  status: string;
  generatedAt: string;
  emailCampaignId?: string | null;
  constituent?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  };
  template?: {
    id: string;
    name: string;
    category: string;
  };
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

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "email-campaigns", label: "Email Campaigns" },
  { id: "email-drafts", label: "Email Drafts" },
  { id: "letters", label: "Letters" },
  { id: "templates", label: "Templates" },
  { id: "segments", label: "Segments" },
  { id: "send-queue", label: "Send Queue" },
  { id: "communication-log", label: "Communication Log" },
  { id: "settings", label: "Settings" },
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

function toCommonStatus(channel: "email" | "letter" | "pathDraft", status: string): string {
  if (channel === "email") {
    if (status === "DRAFT") return "Draft";
    if (status === "SCHEDULED" || status === "SENDING") return "Scheduled";
    if (status === "SENT") return "Sent";
    if (status === "CANCELLED") return "Canceled";
    return status;
  }

  if (channel === "letter") {
    if (status === "GENERATED") return "Generated";
    if (status === "PRINTED") return "Printed";
    if (status === "MAILED") return "Mailed";
    if (status === "EMAIL_DRAFT_CREATED") return "Draft";
    if (status === "EMAIL_SENT") return "Sent";
    if (status === "ARCHIVED") return "Archived";
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

/** CommunicationsPage is the donor outreach hub tying together campaigns, letters, drafts, and logs. */
export default function CommunicationsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lettersStats, setLettersStats] = useState<LetterDashboardStats | null>(null);
  const [generatedLetters, setGeneratedLetters] = useState<GeneratedLetterRecord[]>([]);
  const [pathDrafts, setPathDrafts] = useState<StewardPathEmailDraft[]>([]);

  const [loading, setLoading] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sharingUpdateId, setSharingUpdateId] = useState<string | null>(null);
  const [preparationUpdateId, setPreparationUpdateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignResult, statsResult, lettersStatsResult, generatedLettersResult, pathDraftsResult] = await Promise.allSettled([
        apiFetch<EmailCampaign[]>("/api/email-campaigns"),
        apiFetch<Stats>("/api/email-campaigns/stats"),
        apiFetch<LetterDashboardStats>("/api/letters/dashboard"),
        apiFetch<GeneratedLetterRecord[]>("/api/letters/generated?limit=120"),
        apiFetch<StewardPathEmailDraft[]>("/api/steward-paths/email-drafts?limit=120"),
      ]);

      setCampaigns(campaignResult.status === "fulfilled" ? campaignResult.value : []);
      setStats(statsResult.status === "fulfilled" ? statsResult.value : null);
      setLettersStats(lettersStatsResult.status === "fulfilled" ? lettersStatsResult.value : null);
      setGeneratedLetters(generatedLettersResult.status === "fulfilled" ? generatedLettersResult.value : []);
      setPathDrafts(pathDraftsResult.status === "fulfilled" ? pathDraftsResult.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendNow(id: string) {
    setSending(id);
    try {
      await apiFetch(`/api/email-campaigns/${id}/send`, { method: "POST" });
      await load();
    } finally {
      setSending(null);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign?")) return;
    await apiFetch(`/api/email-campaigns/${id}`, { method: "DELETE" });
    await load();
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
    const params = new URLSearchParams({
      campaign: id,
      returnTo: `/communications/${id}`,
    });
    return `/email-builder?${params.toString()}`;
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
  const lettersWaitingPrint = generatedLetters.filter((letter) => letter.status === "GENERATED").length;
  const lettersWaitingMail = generatedLetters.filter((letter) => letter.status === "PRINTED").length;
  const activePathDrafts = pathDrafts.filter((draft) => ACTIVE_PATH_STATUSES.has(draft.status)).length;

  const letterEmailDrafts = generatedLetters.filter((letter) => letter.status === "EMAIL_DRAFT_CREATED" || Boolean(letter.emailCampaignId));

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

    const letterLog: CommunicationLogItem[] = generatedLetters.map((letter) => ({
      id: `letter-${letter.id}`,
      title: letter.template?.name || "Generated letter",
      channel: "Letter",
      status: letter.status,
      commonStatus: toCommonStatus("letter", letter.status),
      at: letter.generatedAt,
      href: letter.emailCampaignId ? `/communications/${letter.emailCampaignId}` : "/letters-printables/generated",
      detail: letter.constituent
        ? `${letter.constituent.firstName} ${letter.constituent.lastName}`
        : "No constituent linked",
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

    return [...campaignLog, ...letterLog, ...pathDraftLog]
      .filter((item) => Boolean(item.at))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [campaigns, generatedLetters, pathDrafts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Communications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Unified donor outreach hub for campaigns, letters, drafts, and stewardship history</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Campaign
        </button>
      </div>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Donor Engagement System</p>
        <p className="mt-1 text-sm text-emerald-900">
          Donation or constituent context flows into communications planning, template selection, draft review, send/print actions,
          and timeline visibility across letters, campaigns, and steward path steps.
        </p>
        <p className="mt-1 text-xs text-emerald-800">
          Shared status language: Draft, Needs Review, Approved, Scheduled, Sent, Generated, Printed, Mailed, Completed, Failed, Canceled, Archived.
        </p>
      </section>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setWorkspaceTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              workspaceTab === tab.id
                ? "text-green-700 border-b-2 border-green-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {workspaceTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <OverviewCard label="Drafts Needing Review" value={draftsNeedingReview} hint="Campaign + path drafts" tone="amber" />
            <OverviewCard label="Scheduled Sends" value={scheduledCampaigns.length} hint="Queue to monitor" tone="blue" />
            <OverviewCard label="Sent This Week" value={sentThisWeek} hint="Recent outbound" tone="green" />
            <OverviewCard label="Failed Communications" value={failedCommunications} hint="Requires retry" tone="red" />
            <OverviewCard label="Letters Waiting Print" value={lettersWaitingPrint} hint="Generated not printed" tone="amber" />
            <OverviewCard label="Letters Waiting Mail" value={lettersWaitingMail} hint="Printed not mailed" tone="orange" />
            <OverviewCard label="Active Path Drafts" value={activePathDrafts} hint="Open steward steps" tone="indigo" />
            <OverviewCard label="Gifts Needing Acknowledgment" value={lettersStats?.thankYouPending ?? 0} hint="Thank-you follow-up" tone="amber" />
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
                <p className="text-sm text-gray-500">No communication activity yet.</p>
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
            <div className="space-y-3">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  sending={sending === campaign.id}
                  sharingUpdating={sharingUpdateId === campaign.id}
                  onSend={() => sendNow(campaign.id)}
                  onEdit={() => openEditor(campaign.id)}
                  onWorkspace={() => openWorkspace(campaign.id)}
                  onToggleSharing={() => toggleCampaignVisibility(campaign)}
                  onPreparationStatusChange={(nextStatus) => setPreparationStatus(campaign, nextStatus)}
                  onDelete={() => deleteCampaign(campaign.id)}
                  preparationUpdating={preparationUpdateId === campaign.id}
                />
              ))}
            </div>
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
              {pathDrafts.length === 0 && <p className="text-sm text-gray-500">No steward path drafts found.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Letter-to-Email Draft Bridge</h2>
            <p className="text-xs text-gray-500 mt-0.5">Generated letters that were converted into communication drafts.</p>
            <div className="mt-3 space-y-2">
              {letterEmailDrafts.slice(0, 12).map((letter) => (
                <Link
                  key={letter.id}
                  href={letter.emailCampaignId ? `/communications/${letter.emailCampaignId}` : "/letters-printables/generated"}
                  className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{letter.template?.name || "Generated letter"}</p>
                    <span className="text-xs text-gray-500">{toCommonStatus("letter", letter.status)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {letter.constituent ? `${letter.constituent.firstName} ${letter.constituent.lastName}` : "No constituent linked"}
                    {` · ${formatDateTime(letter.generatedAt)}`}
                  </p>
                </Link>
              ))}
              {letterEmailDrafts.length === 0 && <p className="text-sm text-gray-500">No letter-linked email drafts yet.</p>}
            </div>
          </section>
        </div>
      )}

      {workspaceTab === "letters" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <OverviewCard label="Active Templates" value={lettersStats?.activeTemplates ?? 0} hint="Reusable letter templates" tone="green" />
            <OverviewCard label="Generated This Month" value={lettersStats?.generatedThisMonth ?? 0} hint="Print and PDF queue" tone="blue" />
            <OverviewCard label="Thank-You Pending" value={lettersStats?.thankYouPending ?? 0} hint="Needs acknowledgment" tone="amber" />
            <OverviewCard label="Email Draft Bridges" value={lettersStats?.emailDrafts ?? 0} hint="Letter to email handoff" tone="indigo" />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Letters Workspace Actions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/letters-printables" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Letters Home</Link>
              <Link href="/letters-printables/templates" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Templates</Link>
              <Link href="/letters-printables/generate" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Generate</Link>
              <Link href="/letters-printables/generated" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Generated Letters</Link>
            </div>
          </div>
        </div>
      )}

      {workspaceTab === "templates" && (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Template Relationship Model</h2>
            <p className="text-sm text-gray-600 mt-1">
              Templates should define one donor message that can be used across print and email channels with shared merge fields and review controls.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/letters-printables/templates" className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100">Letter Templates</Link>
              <Link href="/communications" className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100">Email Templates and Campaigns</Link>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Recommended Donor Template Categories</h2>
            <p className="mt-1 text-xs text-gray-500">Thank You, Receipt, Newsletter, Campaign Appeal, Lapsed Donor, New Donor Welcome, Monthly Donor, Major Donor, Sponsor, Event Follow-Up, Year-End, General Update.</p>
          </section>
        </div>
      )}

      {workspaceTab === "segments" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Audience and Segment Planning</h2>
          <p className="text-sm text-gray-600">
            Segment workflows are partially implemented. Use campaign audience filters and stewardship task tags while deeper segment tooling continues.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/communications" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Open Campaign Audience Filters</Link>
            <Link href="/tasks?focus=followups" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Open Follow-Up Tasks</Link>
            <Link href="/steward-signals" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Open Steward Signals</Link>
          </div>
        </section>
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
            {scheduledCampaigns.length === 0 && <p className="text-sm text-gray-500">No queued sends right now.</p>}
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
            {communicationLog.length === 0 && <p className="text-sm text-gray-500">No communication entries yet.</p>}
          </div>
        </section>
      )}

      {workspaceTab === "settings" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Communication Settings</h2>
          <p className="text-sm text-gray-600">Sender configuration and integration readiness are managed in settings pages.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/integrations" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Integrations</Link>
            <Link href="/settings/plugins" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Plugins</Link>
            <Link href="/settings/system-status" className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">System Status</Link>
          </div>
        </section>
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
    </div>
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
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-4 gap-4">
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
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-gray-900">No campaigns yet</h3>
      <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
        Create your first email campaign to reach your donors, volunteers, and supporters.
      </p>
      <button
        onClick={onNew}
        className="mt-5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Create Your First Campaign
      </button>
    </div>
  );
}

