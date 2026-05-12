"use client";

/**
 * WebhookEventsTab intentionally avoids static demo events until provider webhooks are implemented.
 */
export default function WebhookEventsTab() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In development</p>
      <p className="mt-1 text-sm text-amber-800">
        Webhook event viewing is hidden until payment webhook ingestion and persistence are implemented.
      </p>
      {/* TODO: backend API needed - implement `/api/payments/webhook-events` before exposing this tab. */}
    </section>
  );
}
