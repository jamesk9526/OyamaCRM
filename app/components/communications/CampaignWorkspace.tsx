/** Campaign-specific communications workspace with rendering, send controls, and send log. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import CampaignRenderedEmail from "@/app/components/communications/CampaignRenderedEmail";
import CampaignSendWorkspace from "@/app/components/communications/CampaignSendWorkspace";
import CampaignSendLogTable from "@/app/components/communications/CampaignSendLogTable";
import CampaignDeliveryEventsPanel from "@/app/components/communications/CampaignDeliveryEventsPanel";
import type {
  CampaignSendLogEntry,
  DeliveryEventsResponse,
  WorkspaceCampaign,
  WorkspacePreview,
} from "@/app/components/communications/campaign-workspace-types";
import {
  formatWorkspaceDate,
  parseAudienceType,
} from "@/app/components/communications/campaign-workspace-utils";

interface Props {
  campaignId: string;
}

/** CampaignWorkspace is the primary operations surface for one individual mailing. */
export default function CampaignWorkspace({ campaignId }: Props) {
  const [campaign, setCampaign] = useState<WorkspaceCampaign | null>(null);
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [sendLogs, setSendLogs] = useState<CampaignSendLogEntry[]>([]);
  const [deliveryEvents, setDeliveryEvents] = useState<DeliveryEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const logs = await apiFetch<CampaignSendLogEntry[]>(`/api/email-campaigns/${campaignId}/send-log?limit=100`);
      setSendLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setSendLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [campaignId]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignPayload, previewPayload] = await Promise.all([
        apiFetch<WorkspaceCampaign>(`/api/email-campaigns/${campaignId}`),
        apiFetch<WorkspacePreview>(`/api/email-campaigns/${campaignId}/preview`, { method: "POST" }),
      ]);

      setCampaign(campaignPayload);
      setPreview(previewPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaign workspace.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const loadDeliveryEvents = useCallback(async () => {
    setDeliveryLoading(true);
    try {
      const payload = await apiFetch<DeliveryEventsResponse>(`/api/email-campaigns/${campaignId}/delivery-events?limit=200`);
      setDeliveryEvents(payload);
    } catch {
      setDeliveryEvents(null);
    } finally {
      setDeliveryLoading(false);
    }
  }, [campaignId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadWorkspace(), loadLogs(), loadDeliveryEvents()]);
  }, [loadDeliveryEvents, loadLogs, loadWorkspace]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const defaultAudienceType = useMemo(() => parseAudienceType(campaign?.audienceFilter), [campaign?.audienceFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-80 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error || "Campaign not found."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Communications Workspace</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">{campaign.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">Individual mailing workspace with rendering, send controls, and operational logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/communications"
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Back to Communications
          </Link>
          <a
            href={`/email-builder?campaign=${campaign.id}&returnTo=${encodeURIComponent(`/communications/${campaign.id}`)}`}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Open Builder
          </a>
          <button
            onClick={() => void refreshAll()}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            Refresh Workspace
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WorkspaceStat label="Status" value={campaign.status} />
        <WorkspaceStat label="Scheduled" value={formatWorkspaceDate(campaign.scheduledAt)} />
        <WorkspaceStat label="Sent" value={formatWorkspaceDate(campaign.sentAt)} />
        <WorkspaceStat label="Recipients" value={campaign.totalRecipients.toLocaleString()} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <CampaignRenderedEmail preview={preview} loading={loading} />
        <CampaignSendWorkspace
          campaignId={campaign.id}
          status={campaign.status}
          scheduledAt={campaign.scheduledAt}
          defaultAudienceType={defaultAudienceType}
          onSent={refreshAll}
        />
      </section>

      <CampaignDeliveryEventsPanel
        data={deliveryEvents}
        loading={deliveryLoading}
        onRefresh={() => void loadDeliveryEvents()}
      />

      <CampaignSendLogTable logs={sendLogs} loading={logsLoading} onRefresh={() => void loadLogs()} />
    </div>
  );
}

interface WorkspaceStatProps {
  label: string;
  value: string;
}

/** WorkspaceStat shows compact campaign-level metadata for quick send prep checks. */
function WorkspaceStat({ label, value }: WorkspaceStatProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
