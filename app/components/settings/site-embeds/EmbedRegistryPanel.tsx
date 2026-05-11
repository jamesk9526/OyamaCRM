// Registry overview panel listing current and planned embeddables with implementation status.
"use client";

import type { SiteEmbedRegistryEntry } from "@/app/components/settings/site-embeds/site-embed-types";

interface EmbedRegistryPanelProps {
  /** Full embed registry list from backend service. */
  registry: SiteEmbedRegistryEntry[];
}

/**
 * EmbedRegistryPanel surfaces the future-ready embed architecture and current implementation state.
 * It shows what is already available now and what remains in staged rollout.
 */
export default function EmbedRegistryPanel({ registry }: EmbedRegistryPanelProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Embed Registry</h2>
        <p className="mt-1 text-xs text-gray-500">
          Review all available embeddables and confirm implementation status before rollout.
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {registry.map((item) => (
          <article key={item.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-gray-800">{item.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.implemented ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                {item.implemented ? "Implemented" : "Planned"}
              </span>
            </div>
            <p className="mt-1 text-gray-600">{item.description}</p>
            <p className="mt-1 text-gray-500">Type: {item.type}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
