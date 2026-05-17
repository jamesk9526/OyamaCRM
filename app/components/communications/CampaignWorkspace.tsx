/** Campaign-specific communications workspace with rendering, send controls, and send log. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import CampaignRenderedEmail from "@/app/components/communications/CampaignRenderedEmail";
import CampaignSendWorkspace from "@/app/components/communications/CampaignSendWorkspace";
import CampaignSendLogTable from "@/app/components/communications/CampaignSendLogTable";
import CampaignDeliveryEventsPanel from "@/app/components/communications/CampaignDeliveryEventsPanel";
import EmailBuilderApp from "@/app/components/email-builder/EmailBuilderApp";
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

type CampaignWorkspaceMode = "overview" | "build" | "send" | "activity";

const WORKSPACE_MODES: Array<{ mode: CampaignWorkspaceMode; label: string }> = [
  { mode: "overview", label: "Preview" },
  { mode: "build", label: "Build" },
  { mode: "send", label: "Send" },
  { mode: "activity", label: "Activity" },
];

/** Returns a safe campaign workspace mode from the route query string. */
function parseWorkspaceMode(value: string | null): CampaignWorkspaceMode {
  if (value === "build" || value === "send" || value === "activity") return value;
  return "overview";
}

/** CampaignWorkspace is the primary operations surface for one individual mailing. */
export default function CampaignWorkspace({ campaignId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaign, setCampaign] = useState<WorkspaceCampaign | null>(null);
  const [preview, setPreview] = useState<WorkspacePreview | null>(null);
  const [sendLogs, setSendLogs] = useState<CampaignSendLogEntry[]>([]);
  const [deliveryEvents, setDeliveryEvents] = useState<DeliveryEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<CampaignWorkspaceMode>(() => parseWorkspaceMode(searchParams.get("mode")));

  useEffect(() => {
    setWorkspaceMode(parseWorkspaceMode(searchParams.get("mode")));
  }, [searchParams]);

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

  /** Keeps the selected workspace mode deep-linkable without leaving the campaign page. */
  function selectWorkspaceMode(nextMode: CampaignWorkspaceMode) {
    setWorkspaceMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "overview") {
      params.delete("mode");
    } else {
      params.set("mode", nextMode);
    }
    const query = params.toString();
    router.replace(query ? `/communications/${campaignId}?${query}` : `/communications/${campaignId}`);
  }

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
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Communications Workspace</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">{campaign.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">Build, review, send, and manage this email from one workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/communications"
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Back to Communications
          </Link>
          <button
            type="button"
            onClick={() => selectWorkspaceMode("build")}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Build Email
          </button>
          <a
            href={`/email-builder?campaign=${campaign.id}&returnTo=${encodeURIComponent(`/communications/${campaign.id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Open Builder Fullscreen
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

      <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-gray-200">
        {WORKSPACE_MODES.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => selectWorkspaceMode(item.mode)}
            className={[
              "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
              workspaceMode === item.mode
                ? "border-b-2 border-green-600 text-green-700"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {workspaceMode === "overview" && (
        <CampaignRenderedEmail preview={preview} loading={loading} />
      )}

      {workspaceMode === "build" && (
        <EmailBuilderApp
          campaignId={campaign.id}
          returnTo={`/communications/${campaign.id}`}
          embedded
          onSaved={refreshAll}
        />
      )}

      {workspaceMode === "send" && (
        <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <CampaignRenderedEmail preview={preview} loading={loading} />
          <CampaignSendWorkspace
            campaignId={campaign.id}
            status={campaign.status}
            scheduledAt={campaign.scheduledAt}
            defaultAudienceType={defaultAudienceType}
            campaignAudienceFilter={campaign.audienceFilter}
            onSent={refreshAll}
          />
        </section>
      )}

      {workspaceMode === "activity" && (
        <div className="space-y-5">
          <CampaignDeliveryEventsPanel
            data={deliveryEvents}
            loading={deliveryLoading}
            onRefresh={() => void loadDeliveryEvents()}
          />
          <CampaignSendLogTable logs={sendLogs} loading={logsLoading} onRefresh={() => void loadLogs()} />
        </div>
      )}
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
