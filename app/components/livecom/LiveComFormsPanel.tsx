// Contact form operations panel for LiveCom website capture channels.
"use client";

import type { LiveComContactForm } from "@/app/components/livecom/livecom-types";

interface LiveComFormsPanelProps {
  forms: LiveComContactForm[];
}

/**
 * LiveComFormsPanel shows website form volumes and response performance indicators.
 */
export default function LiveComFormsPanel({ forms }: LiveComFormsPanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Contact Forms</h2>
        <p className="mt-0.5 text-xs text-gray-500">Track public website forms that should route directly to donor follow-up.</p>
      </div>

      <div className="space-y-3 px-5 py-4">
        {forms.map((form) => (
          <div key={form.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{form.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Source: {form.sourcePath}</p>
              </div>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                {form.newSubmissions} new
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <span>{form.averageResponseMinutes} min avg response</span>
              <span>{form.spamBlockedToday} blocked spam</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
