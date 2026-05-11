// Interaction timeline panel for cross-channel donor events in LiveCom.
"use client";

import type { LiveComInteractionEvent } from "@/app/components/livecom/livecom-types";

interface LiveComInteractionTimelineProps {
  events: LiveComInteractionEvent[];
}

/**
 * LiveComInteractionTimeline presents recent donor interaction events from all inbound channels.
 */
export default function LiveComInteractionTimeline({ events }: LiveComInteractionTimelineProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Interaction Timeline</h2>
        <p className="mt-0.5 text-xs text-gray-500">Real-time donor touchpoints from website chat, forms, and surveys.</p>
      </div>

      <div className="space-y-3 px-5 py-4">
        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
            No interaction events yet. Save a LiveCom interaction to start the timeline.
          </p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${channelTone(event.channel)}`}>
                    {channelLabel(event.channel)}
                  </span>
                  <p className="text-sm font-semibold text-gray-900">{event.eventLabel}</p>
                </div>
                <p className="text-xs text-gray-500">{formatEventTime(event.occurredAt)}</p>
              </div>
              <p className="mt-1 text-sm text-gray-700">{event.donorName}</p>
              <p className="mt-0.5 text-xs text-gray-500">{event.detail}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function channelLabel(channel: LiveComInteractionEvent["channel"]): string {
  if (channel === "WEB_CHAT") return "Web Chat";
  if (channel === "CONTACT_FORM") return "Contact Form";
  return "Survey";
}

function channelTone(channel: LiveComInteractionEvent["channel"]): string {
  if (channel === "WEB_CHAT") return "bg-blue-100 text-blue-700";
  if (channel === "CONTACT_FORM") return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
}

function formatEventTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
