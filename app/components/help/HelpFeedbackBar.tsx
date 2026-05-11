// Lightweight feedback capture strip for Help App article usefulness prompts.
"use client";

import { useState } from "react";

/**
 * HelpFeedbackBar captures simple yes/no usefulness feedback for future analytics wiring.
 */
export default function HelpFeedbackBar() {
  const [response, setResponse] = useState<"yes" | "no" | null>(null);

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-700">Was this helpful?</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setResponse("yes")}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${response === "yes" ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setResponse("no")}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${response === "no" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            No
          </button>
        </div>
      </div>
      {response ? (
        <p className="mt-1 text-[11px] text-gray-500">
          Thanks for the feedback. Analytics capture can be connected in a future backend endpoint.
        </p>
      ) : null}
    </section>
  );
}
