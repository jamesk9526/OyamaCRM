/**
 * PageInfoButton renders a compact topbar info trigger and modal for page legends and notes.
 */
"use client";

import { useState } from "react";
import { getEngagementStatusChipClass } from "@/app/lib/engagement-status";

interface PageInfoButtonProps {
  modalTitle: string;
  intro: string;
  legendTitle?: string;
  legendItems?: string[];
  notesTitle?: string;
  notes?: string[];
  buttonLabel?: string;
}

/** Opens a lightweight modal so page legends and developer notes do not occupy canvas space. */
export default function PageInfoButton({
  modalTitle,
  intro,
  legendTitle,
  legendItems = [],
  notesTitle = "Notes",
  notes = [],
  buttonLabel = "Info",
}: PageInfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        title="Open page legend and notes"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path d="M12 10v6" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="7" r="1" fill="currentColor" />
        </svg>
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">{modalTitle}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <p className="text-sm text-gray-600">{intro}</p>

              {legendItems.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {legendTitle ?? "Legend"}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {legendItems.map((item) => (
                      <span
                        key={item}
                        className={`rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium ${getEngagementStatusChipClass(item)}`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {notes.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{notesTitle}</h3>
                  <ul className="space-y-1.5 text-sm text-gray-600">
                    {notes.map((note) => (
                      <li key={note} className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
