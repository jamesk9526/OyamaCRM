"use client";

import { useState, useEffect, useCallback } from "react";
import NewCampaignModal from "@/app/components/communications/NewCampaignModal";
import { apiFetch } from "@/app/lib/auth-client";

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  ownerId?: string | null;
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

interface Stats {
  total: number;
  sent: number;
  scheduled: number;
  draft: number;
  totalRecipientsSent: number;
  avgOpenRate: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-600" },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  SENDING: { label: "Sending…", color: "bg-amber-100 text-amber-700" },
  SENT: { label: "Sent", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-600" },
};

function formatDate(v?: string) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function pct(n: number, d: number) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export default function CommunicationsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sharingUpdateId, setSharingUpdateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cResult, sResult] = await Promise.allSettled([
        apiFetch<EmailCampaign[]>("/api/email-campaigns"),
        apiFetch<Stats>("/api/email-campaigns/stats"),
      ]);
      if (cResult.status === "fulfilled") setCampaigns(cResult.value);
      if (sResult.status === "fulfilled") setStats(sResult.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  /** Opens the drag-and-drop email builder in a new tab for the given campaign. */
  function openEditor(id: string) {
    window.open(`/email-builder?campaign=${id}`, "_blank");
  }

  const filtered = statusFilter === "all" ? campaigns : campaigns.filter((c) => c.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Communications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Email campaigns, newsletters, and donor outreach</p>
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

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="📤" label="Campaigns Sent" value={String(stats?.sent ?? "—")} sub="All time" />
        <StatCard icon="📬" label="Avg Open Rate" value={stats ? `${stats.avgOpenRate}%` : "—"} sub="Across sent campaigns" highlight={stats != null && stats.avgOpenRate >= 25} />
        <StatCard icon="📝" label="Draft" value={String(stats?.draft ?? "—")} sub="Ready to send" />
        <StatCard icon="📅" label="Scheduled" value={String(stats?.scheduled ?? "—")} sub="Queued to send" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {["all", "DRAFT", "SCHEDULED", "SENT", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              statusFilter === s
                ? "text-green-700 border-b-2 border-green-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {s === "all" ? "All Campaigns" : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => setShowModal(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              sending={sending === c.id}
              sharingUpdating={sharingUpdateId === c.id}
              onSend={() => sendNow(c.id)}
              onEdit={() => openEditor(c.id)}
              onToggleSharing={() => toggleCampaignVisibility(c)}
              onDelete={() => deleteCampaign(c.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => { setShowModal(false); load(); openEditor(id); }}
        />
      )}
    </div>
  );
}

function CampaignCard({ campaign: c, sending, sharingUpdating, onSend, onEdit, onToggleSharing, onDelete }: {
  campaign: EmailCampaign;
  sending: boolean;
  sharingUpdating: boolean;
  onSend: () => void;
  /** Opens the email builder in a new tab for this campaign. */
  onEdit: () => void;
  onToggleSharing: () => void;
  onDelete: () => void;
}){
  const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.DRAFT;
  const isSent = c.status === "SENT";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{c.name}</h3>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.sharedWithOrganization ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              {c.sharedWithOrganization ? "Shared" : "Private"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            Subject: <span className="text-gray-700">{c.subject || <em className="text-gray-400">No subject</em>}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            From: {c.fromName} &lt;{c.fromEmail}&gt;
            {isSent && c.sentAt && <> · Sent {formatDate(c.sentAt)}</>}
            {c.status === "SCHEDULED" && c.scheduledAt && <> · Scheduled {formatDate(c.scheduledAt)}</>}
            {!isSent && c.status !== "SCHEDULED" && <> · Updated {formatDate(c.updatedAt)}</>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(c.status === "DRAFT" || c.status === "SCHEDULED") && (
            <button
              onClick={onSend}
              disabled={sending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send Now"}
            </button>
          )}
          {c.status === "DRAFT" && (
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={onToggleSharing}
            disabled={sharingUpdating}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {sharingUpdating ? "Saving..." : c.sharedWithOrganization ? "Make Private" : "Share"}
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

      {isSent && c.totalRecipients > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-4 gap-4">
          <MiniStat label="Recipients" value={c.totalRecipients.toLocaleString()} />
          <MiniStat label="Delivered" value={pct(c.delivered, c.totalRecipients)} sub={c.delivered.toLocaleString()} color="text-blue-600" />
          <MiniStat label="Opened" value={pct(c.opened, c.delivered)} sub={c.opened.toLocaleString()} color={c.opened / c.delivered > 0.25 ? "text-green-600" : "text-amber-600"} />
          <MiniStat label="Clicked" value={pct(c.clicked, c.opened)} sub={c.clicked.toLocaleString()} color="text-purple-600" />
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
        <span className="text-base">{icon}</span>
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

