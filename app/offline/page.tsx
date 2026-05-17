// Offline fallback page displayed by the service worker when navigation is unavailable.
"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-white to-emerald-50 px-5 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Offline Mode</p>
        <h1 className="mt-2 text-2xl font-semibold">You are currently offline</h1>
        <p className="mt-3 text-sm text-slate-600">
          OyamaCRM could not reach the network. You can continue reviewing cached screens or reconnect and retry.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Retry Connection
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back To Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
