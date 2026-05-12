"use client";

/**
 * PayoutSettingsTab is hidden until processor-backed payout APIs are implemented.
 */
export default function PayoutSettingsTab() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In development</p>
      <p className="mt-1 text-sm text-amber-800">
        Payout settings are disabled until live processor integrations are available.
      </p>
      {/* TODO: backend API needed - implement `/api/payments/payout-settings` before enabling payout configuration UI. */}
    </section>
  );
}
