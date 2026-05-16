/** Email project library with preview cards, compact cards, and list views for Communications. */
"use client";

import { useMemo, useState } from "react";

type CampaignPreparationStatus = "NOT_STARTED" | "DRAFT" | "READY";
type EmailProjectView = "cards" | "compact" | "list";

export interface EmailProjectCampaign {
  id: string;
  name: string;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  preparationStatus?: CampaignPreparationStatus;
  sharedWithOrganization?: boolean;
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

interface EmailProjectLibraryProps {
  campaigns: EmailProjectCampaign[];
  sendingId: string | null;
  sharingUpdateId: string | null;
  preparationUpdateId: string | null;
  onSend: (campaignId: string) => void;
  onBuild: (campaignId: string) => void;
  onOpen: (campaignId: string) => void;
  onToggleSharing: (campaign: EmailProjectCampaign) => void;
  onPreparationStatusChange: (campaign: EmailProjectCampaign, status: CampaignPreparationStatus) => void;
  onDelete: (campaignId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  SENDING: { label: "Sending", color: "bg-amber-100 text-amber-700" },
  SENT: { label: "Sent", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Canceled", color: "bg-red-100 text-red-700" },
};

const PREPARATION_STATUS_CONFIG: Record<CampaignPreparationStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", color: "bg-slate-100 text-slate-700" },
  DRAFT: { label: "Draft", color: "bg-amber-100 text-amber-700" },
  READY: { label: "Ready", color: "bg-emerald-100 text-emerald-700" },
};

/** Formats campaign timestamps for dense project metadata. */
function formatProjectDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Produces a safe preview document when a campaign has text but no rendered HTML yet. */
function getPreviewHtml(campaign: EmailProjectCampaign): string {
  if (campaign.bodyHtml?.trim()) return campaign.bodyHtml;

  const safeText = (campaign.bodyText || "No email content yet.")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#334155;"><div style="padding:28px;font-size:15px;line-height:1.55;white-space:pre-wrap;">${safeText}</div></body></html>`;
}

/** EmailProjectPreview renders a non-interactive thumbnail of the campaign body. */
function EmailProjectPreview({ campaign, compact = false }: { campaign: EmailProjectCampaign; compact?: boolean }) {
  const html = useMemo(() => getPreviewHtml(campaign), [campaign]);

  return (
    <div className={compact ? "h-28 overflow-hidden rounded-md bg-gray-100" : "h-44 overflow-hidden rounded-md bg-gray-100"}>
      <iframe
        title={`${campaign.name} email preview`}
        srcDoc={html}
        sandbox=""
        className="pointer-events-none origin-top-left border-0 bg-white"
        style={{
          width: compact ? 600 : 640,
          height: compact ? 520 : 700,
          transform: compact ? "scale(0.24)" : "scale(0.31)",
        }}
      />
    </div>
  );
}

/** EmailProjectLibrary gives staff a project-first way to choose and manage email campaigns. */
export default function EmailProjectLibrary({
  campaigns,
  sendingId,
  sharingUpdateId,
  preparationUpdateId,
  onSend,
  onBuild,
  onOpen,
  onToggleSharing,
  onPreparationStatusChange,
  onDelete,
}: EmailProjectLibraryProps) {
  const [view, setView] = useState<EmailProjectView>("cards");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Email Projects</h2>
          <p className="text-xs text-gray-500">Open an email, build it, review output, then send from the same project page.</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {[
            { id: "cards", label: "Cards" },
            { id: "compact", label: "Small Cards" },
            { id: "list", label: "List" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id as EmailProjectView)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                view === option.id ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {view === "cards" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <ProjectCard
              key={campaign.id}
              campaign={campaign}
              sending={sendingId === campaign.id}
              sharingUpdating={sharingUpdateId === campaign.id}
              preparationUpdating={preparationUpdateId === campaign.id}
              onSend={() => onSend(campaign.id)}
              onBuild={() => onBuild(campaign.id)}
              onOpen={() => onOpen(campaign.id)}
              onToggleSharing={() => onToggleSharing(campaign)}
              onPreparationStatusChange={(status) => onPreparationStatusChange(campaign, status)}
              onDelete={() => onDelete(campaign.id)}
            />
          ))}
        </div>
      )}

      {view === "compact" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {campaigns.map((campaign) => (
            <SmallProjectCard
              key={campaign.id}
              campaign={campaign}
              sending={sendingId === campaign.id}
              onSend={() => onSend(campaign.id)}
              onBuild={() => onBuild(campaign.id)}
              onOpen={() => onOpen(campaign.id)}
            />
          ))}
        </div>
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-[940px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Audience</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((campaign) => (
                <ProjectListRow
                  key={campaign.id}
                  campaign={campaign}
                  sending={sendingId === campaign.id}
                  onSend={() => onSend(campaign.id)}
                  onBuild={() => onBuild(campaign.id)}
                  onOpen={() => onOpen(campaign.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProjectBadges({ campaign }: { campaign: EmailProjectCampaign }) {
  const statusConfig = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT;
  const preparationConfig = PREPARATION_STATUS_CONFIG[campaign.preparationStatus ?? "DRAFT"];

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusConfig.color}`}>
        {statusConfig.label}
      </span>
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${preparationConfig.color}`}>
        {preparationConfig.label}
      </span>
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${campaign.sharedWithOrganization ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
        {campaign.sharedWithOrganization ? "Shared" : "Private"}
      </span>
    </div>
  );
}

function ProjectActions({
  campaign,
  sending,
  onSend,
  onBuild,
  onOpen,
}: {
  campaign: EmailProjectCampaign;
  sending: boolean;
  onSend: () => void;
  onBuild: () => void;
  onOpen: () => void;
}) {
  const canSend = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onOpen} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
        Open
      </button>
      {campaign.status === "DRAFT" && (
        <button onClick={onBuild} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
          Build
        </button>
      )}
      {canSend && (
        <button
          onClick={onSend}
          disabled={sending}
          className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send Now"}
        </button>
      )}
    </div>
  );
}

function ProjectCard({
  campaign,
  sending,
  sharingUpdating,
  preparationUpdating,
  onSend,
  onBuild,
  onOpen,
  onToggleSharing,
  onPreparationStatusChange,
  onDelete,
}: {
  campaign: EmailProjectCampaign;
  sending: boolean;
  sharingUpdating: boolean;
  preparationUpdating: boolean;
  onSend: () => void;
  onBuild: () => void;
  onOpen: () => void;
  onToggleSharing: () => void;
  onPreparationStatusChange: (status: CampaignPreparationStatus) => void;
  onDelete: () => void;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <EmailProjectPreview campaign={campaign} />
      </button>
      <div className="mt-3 space-y-2">
        <ProjectBadges campaign={campaign} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-900">{campaign.name}</h3>
          <p className="truncate text-xs text-gray-500">Subject: {campaign.subject || "No subject"}</p>
          <p className="truncate text-xs text-gray-400">From: {campaign.fromName} &lt;{campaign.fromEmail}&gt;</p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs">
          <p><span className="block font-semibold text-gray-900">{campaign.totalRecipients.toLocaleString()}</span><span className="text-gray-500">Recipients</span></p>
          <p><span className="block font-semibold text-gray-900">{campaign.opened.toLocaleString()}</span><span className="text-gray-500">Opens</span></p>
          <p><span className="block font-semibold text-gray-900">{campaign.clicked.toLocaleString()}</span><span className="text-gray-500">Clicks</span></p>
        </div>
        <ProjectActions campaign={campaign} sending={sending} onSend={onSend} onBuild={onBuild} onOpen={onOpen} />
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
          <select
            value={campaign.preparationStatus ?? "DRAFT"}
            onChange={(event) => onPreparationStatusChange(event.target.value as CampaignPreparationStatus)}
            disabled={preparationUpdating}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
            title="Campaign preparation status"
          >
            <option value="NOT_STARTED">Not Started</option>
            <option value="DRAFT">Draft</option>
            <option value="READY">Ready</option>
          </select>
          <button onClick={onToggleSharing} disabled={sharingUpdating} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {sharingUpdating ? "Saving..." : campaign.sharedWithOrganization ? "Make Private" : "Share"}
          </button>
          <button onClick={onDelete} className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function SmallProjectCard({
  campaign,
  sending,
  onSend,
  onBuild,
  onOpen,
}: {
  campaign: EmailProjectCampaign;
  sending: boolean;
  onSend: () => void;
  onBuild: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-gray-200 bg-white p-3">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <EmailProjectPreview campaign={campaign} compact />
      </button>
      <div className="mt-2 min-w-0">
        <ProjectBadges campaign={campaign} />
        <h3 className="mt-2 truncate text-sm font-semibold text-gray-900">{campaign.name}</h3>
        <p className="truncate text-xs text-gray-500">{campaign.subject || "No subject"}</p>
        <p className="mt-1 text-xs text-gray-400">Updated {formatProjectDate(campaign.updatedAt)}</p>
      </div>
      <div className="mt-3">
        <ProjectActions campaign={campaign} sending={sending} onSend={onSend} onBuild={onBuild} onOpen={onOpen} />
      </div>
    </article>
  );
}

function ProjectListRow({
  campaign,
  sending,
  onSend,
  onBuild,
  onOpen,
}: {
  campaign: EmailProjectCampaign;
  sending: boolean;
  onSend: () => void;
  onBuild: () => void;
  onOpen: () => void;
}) {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
            <EmailProjectPreview campaign={campaign} compact />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">{campaign.name}</p>
            <p className="truncate text-xs text-gray-500">{campaign.subject || "No subject"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><ProjectBadges campaign={campaign} /></td>
      <td className="px-4 py-3 text-xs text-gray-600">{campaign.totalRecipients.toLocaleString()} recipients</td>
      <td className="px-4 py-3 text-xs text-gray-600">{formatProjectDate(campaign.updatedAt)}</td>
      <td className="px-4 py-3">
        <ProjectActions campaign={campaign} sending={sending} onSend={onSend} onBuild={onBuild} onOpen={onOpen} />
      </td>
    </tr>
  );
}
