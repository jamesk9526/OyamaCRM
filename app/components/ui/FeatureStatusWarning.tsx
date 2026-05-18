/** FeatureStatusWarning renders a reusable in-development warning banner and popup for partial features. */
"use client";

import { useState } from "react";

interface FeatureStatusWarningProps {
  status: "Partially Implemented" | "In Development" | "Planned";
  title: string;
  description: string;
}

/** FeatureStatusWarning communicates incomplete behavior so UI does not look production-ready. */
export default function FeatureStatusWarning({ status, title, description }: FeatureStatusWarningProps) {
  const [showPopup, setShowPopup] = useState(true);

  return (
    <>
      {showPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="feature-status-warning-title"
            className="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-5 shadow-2xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{status}</p>
            <h2 id="feature-status-warning-title" className="mt-1 text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <button
              type="button"
              onClick={() => setShowPopup(false)}
              className="mt-4 h-9 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Continue
            </button>
          </section>
        </div>
      ) : null}

      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{status}</p>
        <h2 className="text-sm font-semibold text-amber-900 mt-0.5">{title}</h2>
        <p className="text-xs text-amber-800 mt-1">{description}</p>
      </section>
    </>
  );
}
