"use client";

/**
 * ProcessorsTab intentionally hides provider onboarding UI until secure backend support exists.
 */
export default function ProcessorsTab() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In development</p>
      <p className="mt-1 text-sm text-amber-800">
        Payment processor onboarding is not yet available in production.
      </p>
      {/* TODO: backend API needed - implement `/api/payments/processors` with encrypted credential storage before exposing processor setup UI. */}
    </section>
  );
}
