"use client";
/**
 * WebhookEventsTab — shows incoming webhook events from connected processors.
 * Allows configuring the OyamaCRM webhook endpoint URL and viewing recent events.
 * In production, events would be fetched from /api/payments/webhook-events.
 */

import { useState } from "react";

interface WebhookEvent {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  status: "processed" | "failed" | "skipped";
  payload: string;
}

const MOCK_EVENTS: WebhookEvent[] = [
  { id: "evt_001", timestamp: "2026-05-08 14:32:11", source: "Stripe", type: "payment_intent.succeeded", status: "processed", payload: '{"amount":50000,"currency":"usd"}' },
  { id: "evt_002", timestamp: "2026-05-08 12:10:05", source: "PayPal", type: "PAYMENT.CAPTURE.COMPLETED", status: "processed", payload: '{"id":"WH-001","amount":"250.00"}' },
  { id: "evt_003", timestamp: "2026-05-07 09:47:33", source: "Stripe", type: "charge.refunded", status: "processed", payload: '{"amount":25000,"reason":"requested_by_customer"}' },
  { id: "evt_004", timestamp: "2026-05-06 16:20:45", source: "Stripe", type: "payment_intent.payment_failed", status: "failed", payload: '{"error":"card_declined"}' },
  { id: "evt_005", timestamp: "2026-05-05 11:05:00", source: "Square", type: "payment.completed", status: "skipped", payload: '{"id":"sqp_001","note":"no matching donor"}' },
];

const STATUS_STYLE: Record<string, string> = {
  processed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-500",
};

export default function WebhookEventsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  // The base URL for the OyamaCRM webhook endpoint
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/payments/webhook`
    : "https://yourcrm.domain/api/payments/webhook";

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl);
  }

  return (
    <div className="space-y-5">
      {/* Webhook endpoint info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Your Webhook Endpoint</h3>
        <p className="text-xs text-gray-500">
          Add this URL to your payment processor&apos;s webhook settings to receive real-time payment events.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 truncate">
            {webhookUrl}
          </code>
          <button
            onClick={copyUrl}
            className="px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
          >
            Copy
          </button>
        </div>

        {/* Per-processor endpoints */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {["stripe", "paypal", "square"].map((p) => (
            <div key={p} className="text-xs flex items-center gap-2">
              <span className="text-gray-400 capitalize font-medium w-16">{p}</span>
              <code className="text-gray-500 font-mono bg-gray-50 border border-gray-100 rounded px-2 py-0.5 truncate flex-1">
                {webhookUrl}/{p}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Events log */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Recent Events</h3>
          <span className="text-xs text-gray-400">{MOCK_EVENTS.length} events</span>
        </div>

        <div className="divide-y divide-gray-100">
          {MOCK_EVENTS.map((evt) => (
            <div key={evt.id}>
              <button
                onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[evt.status]}`}>
                  {evt.status.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">{evt.type}</p>
                  <p className="text-[11px] text-gray-400">{evt.source} · {evt.timestamp}</p>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${expanded === evt.id ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded payload */}
              {expanded === evt.id && (
                <div className="px-4 pb-3 bg-gray-50">
                  <pre className="text-[11px] font-mono text-gray-600 bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(JSON.parse(evt.payload), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        // TODO: Wire up live webhook event storage and real-time push via SSE or WebSocket
      </p>
    </div>
  );
}
