"use client";

/**
 * TransactionLogTab intentionally avoids mock data until provider-backed APIs exist.
 */
export default function TransactionLogTab() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In development</p>
      <p className="mt-1 text-sm text-amber-800">
        Transaction log is hidden until a real `/api/payments/transactions` backend is implemented.
      </p>
      {/* TODO: backend API needed - replace this guard with real transaction data once `/api/payments/transactions` is live. */}
    </section>
  );
}
