// Form card for capturing donor interactions and attaching them to constituent timelines.
"use client";

import { useMemo, useState } from "react";

import type {
  LiveComChannel,
  LiveComConstituentOption,
  LiveComCreateInteractionInput,
  LiveComPriority,
  LiveComConversationStatus,
} from "@/app/components/livecom/livecom-types";

interface LiveComInteractionCaptureCardProps {
  constituents: LiveComConstituentOption[];
  saving: boolean;
  onSubmit: (payload: LiveComCreateInteractionInput) => Promise<void>;
}

/**
 * LiveComInteractionCaptureCard captures one inbound donor interaction and syncs it into timeline records.
 */
export default function LiveComInteractionCaptureCard({
  constituents,
  saving,
  onSubmit,
}: LiveComInteractionCaptureCardProps) {
  const [constituentId, setConstituentId] = useState("");
  const [channel, setChannel] = useState<LiveComChannel>("WEB_CHAT");
  const [status, setStatus] = useState<LiveComConversationStatus>("NEW");
  const [priority, setPriority] = useState<LiveComPriority>("MEDIUM");
  const [owner, setOwner] = useState("Unassigned");
  const [eventLabel, setEventLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedConstituent = useMemo(
    () => constituents.find((item) => item.id === constituentId) ?? null,
    [constituentId, constituents],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!constituentId) {
      setLocalError("Select a constituent to attach this interaction.");
      return;
    }

    if (!detail.trim()) {
      setLocalError("Interaction detail is required.");
      return;
    }

    await onSubmit({
      constituentId,
      channel,
      status,
      priority,
      owner,
      eventLabel: eventLabel.trim() || undefined,
      detail: detail.trim(),
      messagePreview: detail.trim().slice(0, 140),
    });

    setDetail("");
    setEventLabel("");
    setStatus("NEW");
    setPriority("MEDIUM");
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Track Donor Interaction</h2>
        <p className="mt-0.5 text-xs text-gray-500">Saved interactions are attached directly to constituent timelines.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Constituent</span>
          <select
            value={constituentId}
            onChange={(event) => setConstituentId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select constituent</option>
            {constituents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.firstName} {item.lastName}
                {item.email ? ` - ${item.email}` : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedConstituent && (
          <p className="text-xs text-gray-500">
            Linked to: {selectedConstituent.firstName} {selectedConstituent.lastName}
          </p>
        )}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Channel</span>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value as LiveComChannel)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="WEB_CHAT">Web Chat</option>
              <option value="CONTACT_FORM">Contact Form</option>
              <option value="SURVEY">Survey</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as LiveComConversationStatus)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_ON_DONOR">Waiting On Donor</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as LiveComPriority)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Owner</span>
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="Unassigned"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Event Label</span>
          <input
            value={eventLabel}
            onChange={(event) => setEventLabel(event.target.value)}
            placeholder="Chat Started, Contact Form Submitted, Survey Completed..."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Interaction Detail</span>
          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={3}
            placeholder="Capture what the donor asked for and the context from chat/form/survey."
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            required
          />
        </label>

        {localError && (
          <p className="text-xs text-red-600">{localError}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Interaction"}
          </button>
        </div>
      </form>
    </section>
  );
}
