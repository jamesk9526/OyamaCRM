// Inbox panel for live donor interactions across chat, forms, and surveys.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  LiveComConversation,
  LiveComConversationStatus,
  LiveComInboxFilter,
  LiveComPriority,
  LiveComUpdateInteractionInput,
} from "@/app/components/livecom/livecom-types";

interface LiveComInboxPanelProps {
  conversations: LiveComConversation[];
  activeFilter: LiveComInboxFilter;
  onFilterChange: (nextFilter: LiveComInboxFilter) => void;
  updatingConversationId?: string | null;
  onUpdateConversation?: (conversationId: string, updates: LiveComUpdateInteractionInput) => Promise<void>;
}

interface ConversationDraft {
  status: LiveComConversationStatus;
  priority: LiveComPriority;
  owner: string;
}

const FILTER_OPTIONS: Array<{ id: LiveComInboxFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "NEW", label: "New" },
  { id: "ACTIVE", label: "Active" },
  { id: "WAITING", label: "Waiting" },
];

/**
 * LiveComInboxPanel renders queue controls and the current inbound donor conversation table.
 */
export default function LiveComInboxPanel({
  conversations,
  activeFilter,
  onFilterChange,
  updatingConversationId,
  onUpdateConversation,
}: LiveComInboxPanelProps) {
  const [draftByConversationId, setDraftByConversationId] = useState<Record<string, ConversationDraft>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // Keep row edit state synchronized with incoming conversations while preserving in-progress edits.
  useEffect(() => {
    setDraftByConversationId((current) => {
      const next: Record<string, ConversationDraft> = {};

      for (const conversation of conversations) {
        const existing = current[conversation.id];
        next[conversation.id] = existing ?? {
          status: conversation.status,
          priority: conversation.priority,
          owner: conversation.owner,
        };
      }

      return next;
    });
  }, [conversations]);

  function updateDraft(conversationId: string, patch: Partial<ConversationDraft>) {
    setDraftByConversationId((current) => ({
      ...current,
      [conversationId]: {
        status: current[conversationId]?.status ?? "NEW",
        priority: current[conversationId]?.priority ?? "MEDIUM",
        owner: current[conversationId]?.owner ?? "Unassigned",
        ...patch,
      },
    }));
  }

  async function handleSave(conversation: LiveComConversation) {
    if (!onUpdateConversation) return;

    const draft = draftByConversationId[conversation.id] ?? {
      status: conversation.status,
      priority: conversation.priority,
      owner: conversation.owner,
    };

    setSaveError(null);
    try {
      await onUpdateConversation(conversation.id, {
        status: draft.status,
        priority: draft.priority,
        owner: normalizeOwner(draft.owner),
      });
    } catch {
      setSaveError("Could not update this interaction. Please try again.");
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Live Inbox</h2>
          <p className="mt-0.5 text-xs text-gray-500">Website chat, contact forms, and survey conversations in one queue.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeFilter === option.id
                  ? "bg-green-100 text-green-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {saveError && <p className="px-5 pt-3 text-xs text-red-600">{saveError}</p>}

      {conversations.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">No conversations in this queue.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Donor</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Channel</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Owner</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Received</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Save</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => {
                const draft = draftByConversationId[conversation.id] ?? {
                  status: conversation.status,
                  priority: conversation.priority,
                  owner: conversation.owner,
                };
                const hasChanges =
                  draft.status !== conversation.status ||
                  draft.priority !== conversation.priority ||
                  normalizeOwner(draft.owner) !== normalizeOwner(conversation.owner);
                const isSaving = updatingConversationId === conversation.id;

                return (
                  <tr key={conversation.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-2.5">
                      {conversation.constituentId ? (
                        <Link
                          href={`/constituents/${conversation.constituentId}`}
                          className="font-medium text-gray-900 hover:text-green-700"
                        >
                          {conversation.donorName}
                        </Link>
                      ) : (
                        <p className="font-medium text-gray-900">{conversation.donorName}</p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{conversation.messagePreview}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{channelLabel(conversation.channel)}</td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(conversation.status)}`}>
                          {statusLabel(conversation.status)}
                        </span>
                        <select
                          value={draft.status}
                          onChange={(event) => updateDraft(conversation.id, { status: event.target.value as LiveComConversationStatus })}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                        >
                          <option value="NEW">New</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="WAITING_ON_DONOR">Waiting On Donor</option>
                          <option value="RESOLVED">Resolved</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${priorityTone(conversation.priority)}`}>
                          {conversation.priority}
                        </span>
                        <select
                          value={draft.priority}
                          onChange={(event) => updateDraft(conversation.id, { priority: event.target.value as LiveComPriority })}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={draft.owner}
                        onChange={(event) => updateDraft(conversation.id, { owner: event.target.value })}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                        placeholder="Unassigned"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{formatRelativeTime(conversation.receivedAt)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => void handleSave(conversation)}
                        disabled={!hasChanges || isSaving}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function channelLabel(channel: LiveComConversation["channel"]): string {
  if (channel === "WEB_CHAT") return "Web Chat";
  if (channel === "CONTACT_FORM") return "Contact Form";
  return "Survey";
}

function statusLabel(status: LiveComConversationStatus): string {
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "WAITING_ON_DONOR") return "Waiting On Donor";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusTone(status: LiveComConversationStatus): string {
  if (status === "NEW") return "bg-green-100 text-green-700";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
  if (status === "WAITING_ON_DONOR") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function priorityTone(priority: LiveComPriority): string {
  if (priority === "HIGH") return "bg-red-100 text-red-700";
  if (priority === "MEDIUM") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function formatRelativeTime(value: string): string {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function normalizeOwner(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Unassigned";
}
