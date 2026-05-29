"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import OyamaEmailBuilderWorkspace from "@/app/components/oyama-email/OyamaEmailBuilderWorkspace";
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
  { label: "Campaigns", href: "/oyama-email/campaigns", view: "campaigns" },
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

interface DeliveryEventRow {
  id: string;
  recipientEmail: string;
  eventType: string;
  eventAt: string;
  metadata?: Record<string, unknown> | null;
}

interface DeliveryEventsPayload {
  summary: {
    queued: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
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

interface CampaignQueueRow {
  recipientLabel: string;
  email: string;
  status: string;
  lastEvent: string;
  attemptCount: string;
  providerResponse: string;
  queuedAt: string;
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
  const [stats, setStats] = useState<OyamaEmailStats | null>(null);
  const [lists, setLists] = useState<OyamaEmailRecipientList[]>([]);
  const [constituents, setConstituents] = useState<OyamaEmailConstituent[]>([]);
  const [focusedCampaign, setFocusedCampaign] = useState<OyamaEmailCampaign | null>(null);

  const [builderDraft, setBuilderDraft] = useState<BuilderDraft>(EMPTY_DRAFT);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [sourceOption, setSourceOption] = useState<(typeof SOURCE_OPTIONS)[number]>("Individual Recipients");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const normalizedView: OyamaEmailView = view === "send" || view === "audience" || view === "queue" || view === "analytics"
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

  const targetCampaignId = templateId || campaignId || searchParams.get("templateId") || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignRows, statsRow, listRows, constituentRows] = await Promise.all([
        apiFetch<OyamaEmailCampaign[]>("/api/email-campaigns?limit=100"),
        apiFetch<OyamaEmailStats>("/api/email-campaigns/stats").catch(() => null),
        apiFetch<OyamaEmailRecipientList[]>("/api/email-campaigns/lists").catch(() => []),
        apiFetch<OyamaEmailConstituent[]>("/api/constituents?limit=all").catch(() => []),
      ]);
      setCampaigns(campaignRows);
      setStats(statsRow);
      setLists(listRows);
      setConstituents(constituentRows);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load OyamaEmail workspace.");
      setCampaigns([]);
      setStats(null);
      setLists([]);
      setConstituents([]);
    } finally {
      setLoading(false);
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

    const fromCollection = campaigns.find((row) => row.id === targetCampaignId) ?? null;
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
  }, [campaigns, targetCampaignId]);

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

  useEffect(() => {
    if (selectedRecipientIds.length > 0) return;
    const defaults = constituents
      .filter((row) => Boolean(row.email))
      .slice(0, 12)
      .map((row) => row.id);
    if (defaults.length > 0) {
      setSelectedRecipientIds(defaults);
    }
  }, [constituents, selectedRecipientIds.length]);

  const selectedCampaign = useMemo(() => {
    if (focusedCampaign) return focusedCampaign;
    if (!targetCampaignId) return null;
    return campaigns.find((row) => row.id === targetCampaignId) ?? null;
  }, [campaigns, focusedCampaign, targetCampaignId]);

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

  async function sendTest() {
    if (!selectedCampaign?.id) {
      setError("Save this template before sending a test email.");
      return;
    }
    const toEmail = window.prompt("Send test to email address:", builderDraft.replyToEmail || builderDraft.fromEmail || "");
    if (!toEmail) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/email-campaigns/${selectedCampaign.id}/send-test`, {
        method: "POST",
        body: JSON.stringify({ toEmail }),
      });
      setNotice(`Test email sent to ${toEmail}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send test email.");
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
      setError("Resolve compliance blockers before publishing this template.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/email-campaigns/${selectedCampaign.id}`, {
        method: "PUT",
        body: JSON.stringify({
          preparationStatus: "READY",
          status: "DRAFT",
        }),
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
          {normalizedView !== "builder" ? <OyamaEmailTopBar view={normalizedView} targetCampaign={selectedCampaign} /> : null}

          {error ? <Alert tone="error">{error}</Alert> : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}

          {loading ? <LoadingState label="Loading OyamaEmail workspace..." /> : null}
          {!loading && normalizedView === "templates" ? (
            <TemplatesView campaigns={campaigns} onUseTemplate={setSendTemplate} />
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
              onSendTest={sendTest}
              onPublish={publishTemplate}
            />
          ) : null}
          {!loading && normalizedView === "campaigns" ? (
            <CampaignsView
              campaigns={campaigns}
              stats={stats}
              focusedCampaignId={campaignId ?? null}
              initialTab={initialCampaignTab}
              openWizard={openCampaignWizard}
              wizardPageMode={wizardPageMode}
              preferredTemplateId={preferredTemplateId}
              constituents={constituents}
              lists={lists}
              onRefresh={load}
            />
          ) : null}
          {!loading && normalizedView === "settings" ? (
            <SettingsView />
          ) : null}
        </div>
      </div>
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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-5 py-4 xl:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[31px] font-semibold tracking-tight text-slate-900">{workspaceTitle(view)}</p>
          <p className="text-sm text-slate-600">{workspaceSubtitle(view, targetCampaign)}</p>
        </div>

        {view === "builder" ? (
          <div className="flex flex-wrap gap-2">
            <WorkspaceAction href={targetCampaign?.id ? `/oyama-email/templates/${targetCampaign.id}/publish` : "/oyama-email/templates/new"} tone="primary">Next: Publish &amp; Compliance</WorkspaceAction>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function TemplatesView({ campaigns, onUseTemplate }: { campaigns: OyamaEmailCampaign[]; onUseTemplate: (template: OyamaEmailCampaign) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Templates");
  const [categorySort, setCategorySort] = useState<"default" | "count">("default");
  const [sortBy, setSortBy] = useState<"updatedDesc" | "updatedAsc" | "usedDesc" | "nameAsc">("updatedDesc");
  const [page, setPage] = useState(1);
  const pageSize = 8;

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
    if (needle && !`${row.name} ${row.subject || ""}`.toLowerCase().includes(needle)) return false;
    if (category === "All Templates") return true;
    const purpose = purposeLabel(row.purpose || "GENERAL");
    return purpose === category;
  }), [campaigns, category, search]);

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
  }, [search, category, sortBy]);

  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="space-y-5 p-4 xl:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-slate-900">Email Template Library</p>
            <p className="mt-1 text-sm text-slate-600">Choose a template to get started or create a new email from scratch.</p>
          </div>

          <div className="flex min-w-[320px] flex-1 flex-wrap items-center justify-end gap-2">
            <label className="relative min-w-[260px] flex-1 md:max-w-[360px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3m1.8-5.2a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates..."
                className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <select
              value={categorySort}
              onChange={(event) => setCategorySort(event.target.value as "default" | "count")}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              aria-label="Sort categories"
            >
              <option value="default">Sort Categories</option>
              <option value="count">Most Used Categories</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "updatedDesc" | "updatedAsc" | "usedDesc" | "nameAsc")}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              aria-label="Sort templates"
            >
              <option value="updatedDesc">Updated</option>
              <option value="updatedAsc">Oldest Updated</option>
              <option value="usedDesc">Most Used</option>
              <option value="nameAsc">Name A-Z</option>
            </select>

            <WorkspaceAction href="/oyama-email/templates/new" tone="primary">+ New Email Template</WorkspaceAction>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {visibleCategories.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setCategory(label)}
              className={[
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold",
                category === label
                  ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <span>{label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{label === "All Templates" ? campaigns.length : categoryMap.get(label) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">No templates matched your filters.</p>
          <p className="mt-2 text-sm text-slate-600">Create a new email template to start the redesigned OyamaEmail flow.</p>
          <div className="mt-4 flex justify-center">
            <WorkspaceAction href="/oyama-email/templates/new" tone="primary">Create Blank Email</WorkspaceAction>
          </div>
        </div>
      ) : null}

      {sortedRows.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Link href="/oyama-email/templates/new" className="flex min-h-[330px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50/40">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-slate-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                </svg>
              </span>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Blank Email</p>
              <p className="mt-1 text-sm text-slate-500">Start from scratch</p>
            </Link>

            {pageRows.map((row) => {
              const categoryLabel = purposeLabel(row.purpose || "GENERAL");
              const usedCount = row.totalRecipients || 0;
              return (
                <article key={row.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between px-4 pb-2 pt-4">
                    <div>
                      <p className="line-clamp-1 text-[21px] font-semibold leading-snug tracking-tight text-slate-900">{row.name}</p>
                      <span className="mt-1 inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{categoryLabel}</span>
                    </div>
                    <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`More actions for ${row.name}`}>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M10 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                      </svg>
                    </button>
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
                      <Link href={`/oyama-email/templates/${row.id}/builder`} className="font-semibold text-slate-500 hover:text-emerald-700">Open</Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <WorkspaceAction href={`/oyama-email/templates/${row.id}/builder`}>Edit</WorkspaceAction>
                      <button type="button" onClick={() => onUseTemplate(row)} className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Use Template</button>
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
          <StatusBadge label={blockerCount === 0 ? "Ready" : `${blockerCount} blocker${blockerCount === 1 ? "" : "s"}`} tone={blockerCount === 0 ? "green" : "red"} />
        </div>
        {checks.map((check) => (
          <div key={check.key} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{check.label}</p>
              <p className="text-xs text-slate-600">{check.detail}</p>
            </div>
            <StatusBadge label={check.passed ? "Pass" : "Fix"} tone={check.passed ? "green" : check.required ? "red" : "amber"} />
          </div>
        ))}
      </aside>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <p className="text-sm text-slate-600">Email Preview</p>
            <p className="text-base font-semibold text-slate-900">{draft.subject || "Untitled subject"}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save Draft</button>
            <button type="button" onClick={onSendTest} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Send Test Email</button>
            <button type="button" onClick={onPublish} disabled={saving || blockerCount > 0} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">Publish Template</button>
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
          Publishing sets this template as Ready for Send workflows while preserving draft history in campaign records.
        </div>
      </aside>
    </section>
  );
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
  openWizard,
  wizardPageMode,
  preferredTemplateId,
  constituents,
  lists,
  onRefresh,
}: {
  campaigns: OyamaEmailCampaign[];
  stats: OyamaEmailStats | null;
  focusedCampaignId: string | null;
  initialTab: CampaignWorkspaceTab;
  openWizard: boolean;
  wizardPageMode: boolean;
  preferredTemplateId: string | null;
  constituents: OyamaEmailConstituent[];
  lists: OyamaEmailRecipientList[];
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [wizardVisible, setWizardVisible] = useState(openWizard);
  const [tab, setTab] = useState<CampaignWorkspaceTab>(initialTab);
  const [deliveryData, setDeliveryData] = useState<DeliveryEventsPayload | null>(null);
  const [activityRows, setActivityRows] = useState<CampaignActivityRow[]>([]);
  const [queueRows, setQueueRows] = useState<CampaignQueueRow[]>([]);
  const [audiencePreview, setAudiencePreview] = useState<CampaignAudiencePreviewResponse["audience"] | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((row) => row.id === focusedCampaignId) ?? null,
    [campaigns, focusedCampaignId],
  );

  useEffect(() => {
    setWizardVisible(openWizard);
  }, [openWizard]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, focusedCampaignId]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return campaigns.filter((row) => {
      if (!needle) return true;
      return `${row.name} ${row.subject || ""}`.toLowerCase().includes(needle);
    });
  }, [campaigns, search]);

  const draftRows = rows.filter((row) => ["DRAFT", "VALIDATING", "READY"].includes(row.status.toUpperCase()));
  const scheduledRows = rows.filter((row) => ["SCHEDULED", "QUEUED"].includes(row.status.toUpperCase()));
  const sendingRows = rows.filter((row) => ["SENDING"].includes(row.status.toUpperCase()));
  const recentRows = rows.filter((row) => ["SENT", "DELIVERED", "OPENED", "CLICKED", "FAILED", "BOUNCED", "UNSUBSCRIBED"].includes(row.status.toUpperCase()));
  const archivedRows = rows.filter((row) => ["ARCHIVED", "CANCELLED"].includes(row.status.toUpperCase()));

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
                <p className="text-2xl font-semibold text-slate-900">Campaigns</p>
                <p className="text-sm text-slate-600">New Campaign, Draft Campaigns, Scheduled Campaigns, Sending Now, Recently Sent, and Archived Campaigns.</p>
              </div>
              {wizardPageMode ? (
                <WorkspaceAction href="/oyama-email/campaigns">Back to Campaigns</WorkspaceAction>
              ) : (
                <WorkspaceAction href="/oyama-email/campaigns/new" tone="primary">New Campaign</WorkspaceAction>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns..." className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Campaigns tracked: <span className="font-semibold text-slate-900">{stats?.total ?? campaigns.length}</span>
              </div>
            </div>
          </div>

          {wizardVisible ? (
            <NewCampaignWizardPanel
              templates={campaigns}
              lists={lists}
              constituents={constituents}
              preferredTemplateId={preferredTemplateId}
              onCancel={() => {
                setWizardVisible(false);
                if (wizardPageMode) router.push("/oyama-email/campaigns");
              }}
              pageMode={wizardPageMode}
              onCreated={onCreatedCampaign}
            />
          ) : null}

          {!wizardPageMode ? <CampaignBoardSection title="Draft Campaigns" rows={draftRows} onOpen={openCampaign} /> : null}
          {!wizardPageMode ? <CampaignBoardSection title="Scheduled Campaigns" rows={scheduledRows} onOpen={openCampaign} /> : null}
          {!wizardPageMode ? <CampaignBoardSection title="Sending Now" rows={sendingRows} onOpen={openCampaign} /> : null}
          {!wizardPageMode ? <CampaignBoardSection title="Recently Sent" rows={recentRows} onOpen={openCampaign} /> : null}
          {!wizardPageMode ? <CampaignBoardSection title="Archived Campaigns" rows={archivedRows} onOpen={openCampaign} /> : null}
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
            const sentCount = row.sentAt ? String(row.totalRecipients || 0) : waitingMetric(row.status);
            const queuedCount = ["SCHEDULED", "QUEUED", "SENDING"].includes(row.status.toUpperCase())
              ? String(row.totalRecipients || 0)
              : waitingMetric(row.status);

            return (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="line-clamp-1 text-base font-semibold text-slate-900">{row.name || "Untitled Campaign"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.subject || "No subject line"}</p>
                  </div>
                  <StatusBadge label={row.status} tone={statusTone(row.status)} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MetricChip label="Template Used" value={row.preparationStatus === "READY" ? "Snapshot ready" : "Not tracked yet"} />
                  <MetricChip label="Audience Count" value={String(row.totalRecipients ?? 0)} />
                  <MetricChip label="Queued Count" value={queuedCount} />
                  <MetricChip label="Sent Count" value={sentCount} />
                  <MetricChip label="Delivered" value={trackedMetric(row.delivered, row.status)} />
                  <MetricChip label="Opened" value={trackedMetric(row.opened, row.status)} />
                  <MetricChip label="Clicked" value={trackedMetric(row.clicked, row.status)} />
                  <MetricChip label="Bounced" value={trackedMetric(row.bounced, row.status)} />
                  <MetricChip label="Unsubscribed" value={trackedMetric(row.unsubscribed, row.status)} />
                  <MetricChip label="Last Activity" value={formatDateTime(row.sentAt || row.updatedAt)} />
                  <MetricChip label="Owner" value={row.ownerId || "Not tracked yet"} />
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-700 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Open Campaign
                  </button>
                  <WorkspaceAction href={`/oyama-email/templates/${row.id}/builder`}>Edit Content</WorkspaceAction>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
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
}: {
  campaign: OyamaEmailCampaign;
  tab: CampaignWorkspaceTab;
  onTabChange: (next: CampaignWorkspaceTab) => void;
  onBack: () => void;
  deliveryData: DeliveryEventsPayload | null;
  activityRows: CampaignActivityRow[];
  queueRows: CampaignQueueRow[];
  audiencePreview: CampaignAudiencePreviewResponse["audience"] | null;
}) {
  const summary = deliveryData?.summary;
  const totalAudience = Math.max(campaign.totalRecipients || 0, summary?.queued ?? 0, summary?.delivered ?? 0);
  const completed = (summary?.delivered ?? 0) + (summary?.bounced ?? 0);
  const progressPercent = totalAudience > 0 ? Math.min(100, Math.round((completed / totalAudience) * 100)) : 0;
  const mergedActivity = useMemo(() => {
    const fromAudit = activityRows.map((row) => ({
      key: `audit-${row.id}`,
      ts: new Date(row.createdAt).getTime() || 0,
      label: `${formatDateTime(row.createdAt)} — ${row.action.replaceAll("_", " ")}${row.user?.name ? ` by ${row.user.name}` : ""}`,
    }));
    const fromDelivery = (deliveryData?.events ?? []).slice(0, 80).map((row) => ({
      key: `delivery-${row.id}`,
      ts: new Date(row.eventAt).getTime() || 0,
      label: `${formatDateTime(row.eventAt)} — ${row.eventType} ${row.recipientEmail}`,
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
            <StatusBadge label={campaign.status} tone={statusTone(campaign.status)} />
            <WorkspaceAction href={`/oyama-email/templates/${campaign.id}/builder`}>Edit / Confirm Email Content</WorkspaceAction>
          </div>
        </div>

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
                <MetricChip label="Delivered" value={String(summary?.delivered ?? 0)} />
                <MetricChip label="Opened" value={String(summary?.opened ?? 0)} />
                <MetricChip label="Clicked" value={String(summary?.clicked ?? 0)} />
                <MetricChip label="Bounced" value={String(summary?.bounced ?? 0)} />
                <MetricChip label="Failed" value="Not tracked yet" />
                <MetricChip label="Unsubscribed" value={trackedMetric(campaign.unsubscribed, campaign.status)} />
                <MetricChip label="Suppressed" value="Not tracked yet" />
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
          <p className="mt-1 text-sm text-slate-600">Queued = prepared by OyamaCRM. Delivered/Opened/Clicked only from provider/webhook events.</p>
          <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1220px] text-left text-xs">
              <thead className="bg-slate-50 uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-2 py-2">Recipient</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Last Event</th>
                  <th className="px-2 py-2">Attempt Count</th>
                  <th className="px-2 py-2">SMTP/Provider Response</th>
                  <th className="px-2 py-2">Queued At</th>
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
                    <td className="px-2 py-4 text-slate-500" colSpan={14}>Waiting for queue or delivery events.</td>
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
                <MetricChip label="Total Audience" value={String(campaign.totalRecipients ?? 0)} />
                <MetricChip label="Queued" value={String(summary?.queued ?? 0)} />
                <MetricChip label="Sent" value={campaign.sentAt ? String(campaign.totalRecipients ?? 0) : waitingMetric(campaign.status)} />
                <MetricChip label="Delivered" value={String(summary?.delivered ?? 0)} />
                <MetricChip label="Opened" value={String(summary?.opened ?? 0)} />
                <MetricChip label="Unique Opens" value={String(summary?.opened ?? 0)} />
                <MetricChip label="Clicked" value={String(summary?.clicked ?? 0)} />
                <MetricChip label="Unique Clicks" value={String(summary?.clicked ?? 0)} />
                <MetricChip label="Bounced" value={String(summary?.bounced ?? 0)} />
                <MetricChip label="Deferred" value="Not tracked yet" />
                <MetricChip label="Failed" value="Not tracked yet" />
                <MetricChip label="Unsubscribed" value={trackedMetric(campaign.unsubscribed, campaign.status)} />
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
    </div>
  );
}

function NewCampaignWizardPanel({
  templates,
  lists,
  constituents,
  preferredTemplateId,
  onCancel,
  pageMode,
  onCreated,
}: {
  templates: OyamaEmailCampaign[];
  lists: OyamaEmailRecipientList[];
  constituents: OyamaEmailConstituent[];
  preferredTemplateId: string | null;
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
  const [segmentType, setSegmentType] = useState("active");
  const [audienceReviewConfirmed, setAudienceReviewConfirmed] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<CampaignAudiencePreviewResponse["audience"] | null>(null);

  const [scheduleAt, setScheduleAt] = useState("");

  const selectedTemplate = templates.find((row) => row.id === templateId) ?? null;
  const selectedConstituentEmails = constituents
    .filter((row) => selectedConstituentIds.includes(row.id))
    .map((row) => (row.email || "").trim().toLowerCase())
    .filter(Boolean);
  const manualEmails = normalizeManualEmails(manualRecipientsText);

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
        validRecipients: selectedListIds.length > 0 ? "Waiting for validation" : "0",
        missingEmail: "Not tracked yet",
        invalidEmail: "Not tracked yet",
        duplicateEmail: "Not tracked yet",
        unsubscribed: "Not tracked yet",
        suppressed: "Not tracked yet",
        doNotEmail: "Not tracked yet",
        hardBounced: "Not tracked yet",
        softBounced: "Not tracked yet",
        missingMerge: "Not tracked yet",
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
  }, [audiencePreview, audienceSource, manualEmails, selectedConstituentEmails, selectedListIds.length]);

  const canContinueFromSetup = Boolean(campaignName.trim() && subjectLine.trim() && fromName.trim() && isEmailLike(fromEmail) && isEmailLike(replyToEmail));
  const canContinueFromAudience = Number(localAudienceSummary.validRecipients) > 0 && audienceReviewConfirmed;

  async function createOrSend(action: "save" | "queue" | "send" | "schedule" | "test") {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
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
        const toEmail = window.prompt("Send test to email address:", replyToEmail || fromEmail || "");
        if (toEmail) {
          await apiFetch(`/api/email-campaigns/${created.id}/send-test`, {
            method: "POST",
            body: JSON.stringify({ toEmail }),
          });
          setNotice(`Test email sent to ${toEmail}.`);
        }
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
          body: JSON.stringify(buildSendPayload(audienceSource, selectedListIds, manualEmails, selectedConstituentEmails, segmentType)),
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
          <p className="text-lg font-semibold text-slate-900">New Campaign Wizard</p>
          <p className="text-sm text-slate-600">Setup → Choose Template → Audience → Review & Compliance → Queue/Schedule/Send</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-100 bg-[linear-gradient(135deg,#f3fbf6,#ecf8ff)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Workflow</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <FlowNode label="Campaign Setup" active={step >= 1} />
          <FlowArrow />
          <FlowNode label="Choose Template" active={step >= 2} />
          <FlowArrow />
          <FlowNode label="Audience" active={step >= 3} />
          <FlowArrow />
          <FlowNode label="Review" active={step >= 4} />
          <FlowArrow />
          <FlowNode label="Queue / Send" active={step >= 5} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["Setup", "Choose Template", "Audience", "Review & Compliance", "Queue / Schedule / Send"].map((label, index) => {
          const active = step === (index + 1);
          return (
            <span key={label} className={["rounded-full border px-3 py-1 text-xs font-semibold", active ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"].join(" ")}>{index + 1}. {label}</span>
          );
        })}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {step === 1 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
          <p className="text-sm text-slate-600">Choose the template snapshot for this campaign.</p>
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
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_AUDIENCE_SOURCES.map((source) => (
              <button key={source} type="button" onClick={() => setAudienceSource(source)} className={["rounded-full border px-3 py-1 text-xs font-semibold", source === audienceSource ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>{source}</button>
            ))}
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
            <div className="max-h-[260px] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-wide text-slate-600"><tr><th className="px-2 py-2" /><th className="px-2 py-2">Name</th><th className="px-2 py-2">Email</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {constituents.slice(0, 160).map((person) => {
                    const selected = selectedConstituentIds.includes(person.id);
                    return (
                      <tr key={person.id}>
                        <td className="px-2 py-2"><input type="checkbox" checked={selected} onChange={() => setSelectedConstituentIds((prev) => selected ? prev.filter((id) => id !== person.id) : [...prev, person.id])} /></td>
                        <td className="px-2 py-2">{[person.firstName, person.lastName].filter(Boolean).join(" ") || person.id}</td>
                        <td className="px-2 py-2">{person.email || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          <label className="block text-xs font-semibold text-slate-700">Schedule Send (optional)
            <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void createOrSend("test")} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Send test email</button>
            <button type="button" onClick={() => void createOrSend("save")} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save draft</button>
            <button type="button" onClick={() => void createOrSend("schedule")} disabled={saving} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Schedule send</button>
            <button type="button" onClick={() => void createOrSend("queue")} disabled={saving} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60">Queue for review</button>
            <button type="button" onClick={() => void createOrSend("send")} disabled={saving} className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">Send now</button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={saving || step === 1}>Back</button>
        <button
          type="button"
          onClick={() => setStep((prev) => Math.min(5, prev + 1) as 1 | 2 | 3 | 4 | 5)}
          className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          disabled={saving || (step === 1 && !canContinueFromSetup) || (step === 3 && !canContinueFromAudience) || step === 5}
        >
          Next
        </button>
      </div>
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

function normalizeManualEmails(value: string): string[] {
  return Array.from(new Set(value
    .split(/[\n,;]+/)
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean)));
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
                  <td className="px-3 py-2"><WorkspaceAction href="/oyama-email/send">Use in Send Wizard</WorkspaceAction></td>
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

function QueueView({ campaigns }: { campaigns: OyamaEmailCampaign[] }) {
  const queueRows = campaigns.filter((row) => row.status === "SCHEDULED" || row.status === "SENDING");

  return (
    <section className="space-y-4 p-4 xl:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-2xl font-semibold text-slate-900">Queue</p>
        <p className="mt-1 text-sm text-slate-600">Monitor campaigns waiting to send and campaigns currently in send processing.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Scheduled</th>
              <th className="px-3 py-2">Recipients</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {queueRows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>No queued campaigns right now.</td>
              </tr>
            ) : null}
            {queueRows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.subject || "No subject"}</p>
                </td>
                <td className="px-3 py-2"><StatusBadge label={row.status} tone={statusTone(row.status)} /></td>
                <td className="px-3 py-2">{formatDateTime(row.scheduledAt || "")}</td>
                <td className="px-3 py-2">{row.totalRecipients}</td>
                <td className="px-3 py-2"><WorkspaceAction href={`/oyama-email/campaigns/${row.id}`}>Open</WorkspaceAction></td>
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

function SettingsView() {
  return (
    <section className="grid gap-4 p-4 xl:grid-cols-2 xl:p-6">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-slate-900">Email Delivery Settings</p>
        <p className="mt-2 text-sm text-slate-600">Manage sender details, SMTP setup, and organization-level communications defaults.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <WorkspaceAction href="/settings">Open CRM Settings</WorkspaceAction>
          <WorkspaceAction href="/settings/branding">Open Branding</WorkspaceAction>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-slate-900">Compliance and Domain Health</p>
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
    Audience: "M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    Queue: "M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01",
    Analytics: "M4 19h16M7 16V9m5 7V6m5 10v-4",
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
  if (view === "campaigns" || view === "send" || view === "audience" || view === "queue" || view === "analytics") return "Campaigns";
  return "Settings";
}

function workspaceSubtitle(view: OyamaEmailView, campaign: OyamaEmailCampaign | null): string {
  if (view === "builder") return `Design and configure your email template${campaign ? `: ${campaign.name}` : ""}.`;
  if (view === "publish") return "Review compliance checks and publish this template for send workflows.";
  if (view === "send") return "Use the New Campaign wizard inside Campaigns for one-direction flow.";
  if (view === "templates") return "Choose a template to get started or create a new email from scratch.";
  if (view === "campaigns" || view === "audience" || view === "queue" || view === "analytics") {
    return "Run real send activity through campaign-first workflow with internal tabs for Overview, Audience, Queue, Analytics, Activity Log, and Settings.";
  }
  return "Configure delivery defaults and compliance policy behavior.";
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  const normalized = status.toUpperCase();
  if (normalized === "SENT") return "green";
  if (normalized === "SCHEDULED" || normalized === "SENDING" || normalized === "DRAFT") return "amber";
  if (normalized === "CANCELLED" || normalized === "FAILED") return "red";
  return "slate";
}

function complianceChecks(draft: BuilderDraft): Array<{ key: string; label: string; detail: string; passed: boolean; required: boolean }> {
  const mergeFields = extractMergeTokens(draft.bodyHtml);
  return [
    { key: "subject", label: "Subject Line", detail: draft.subject || "Missing subject line", passed: Boolean(draft.subject.trim()), required: true },
    { key: "preview", label: "Preview Text", detail: draft.previewText || "Missing preview text", passed: Boolean(draft.previewText.trim()), required: true },
    { key: "fromName", label: "From Name", detail: draft.fromName || "Missing from name", passed: Boolean(draft.fromName.trim()), required: true },
    { key: "fromEmail", label: "From Email", detail: draft.fromEmail || "Missing from email", passed: /.+@.+\..+/.test(draft.fromEmail.trim()), required: true },
    { key: "reply", label: "Reply-To Email", detail: draft.replyToEmail || "Missing reply-to email", passed: /.+@.+\..+/.test(draft.replyToEmail.trim()), required: true },
    { key: "unsubscribe", label: "Unsubscribe Link", detail: "Include unsubscribe link in body/footer", passed: /unsubscribe/i.test(draft.bodyHtml), required: true },
    { key: "address", label: "Physical Address", detail: "Include physical mailing address in footer", passed: /(street|ave|road|st\.|po box|zip|[0-9]{5})/i.test(draft.bodyHtml), required: true },
    { key: "plainText", label: "Plain Text Version", detail: "Auto-generated plain text is available", passed: Boolean(htmlToText(draft.bodyHtml)), required: true },
    { key: "merge", label: "Merge Fields", detail: mergeFields.length > 0 ? `${mergeFields.length} merge fields detected` : "No merge fields used", passed: true, required: false },
  ];
}

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
