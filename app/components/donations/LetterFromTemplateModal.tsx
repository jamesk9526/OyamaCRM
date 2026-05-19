"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { formatCurrency } from "@/app/components/donations/donation-utils";

interface LetterTemplateOption {
  id: string;
  name: string;
  category: string;
  status: string;
  updatedAt: string;
}

interface DonationContext {
  donationId: string;
  constituentId: string;
  donorName: string;
  amount: string;
  date: string;
}

interface Props {
  donation: DonationContext;
  onClose: () => void;
}

/**
 * LetterFromTemplateModal
 * Selects a letter template for one donation and opens the generate workspace prefilled
 * with template + constituent + donation context.
 */
export default function LetterFromTemplateModal({ donation, onClose }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState<LetterTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<LetterTemplateOption[]>("/api/letters/templates?status=ACTIVE");
        if (!cancelled) setTemplates(rows ?? []);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Failed to load letter templates.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => {
      return (
        template.name.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query)
      );
    });
  }, [search, templates]);

  function openLetterGenerator(templateId: string) {
    const params = new URLSearchParams({
      templateId,
      mode: "single",
      constituentId: donation.constituentId,
      donationId: donation.donationId,
    });
    router.push(`/letters-printables/generate?${params.toString()}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12 overflow-y-auto">
      <div
        ref={containerRef}
        tabIndex={-1}
        className="relative w-full max-w-3xl rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="flex items-start justify-between gap-3 rounded-t-xl bg-gradient-to-r from-green-700 to-green-500 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-100">Step 1 of 2</p>
            <h2 className="mt-0.5 text-lg font-bold text-white truncate">Letter From Template</h2>
            <p className="mt-0.5 text-sm text-green-100 truncate">Pick a template, then generate a donor-specific letter.</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-green-100 bg-green-50 px-6 py-2 text-xs text-green-900">
          <span>
            <span className="font-semibold">Donor:</span> {donation.donorName}
          </span>
          <span className="text-green-300">|</span>
          <span>
            <span className="font-semibold">Gift:</span> {formatCurrency(donation.amount)}
          </span>
          <span className="text-green-300">|</span>
          <span>
            <span className="font-semibold">Date:</span>{" "}
            {new Date(donation.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search letter templates..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((index) => (
                <div key={index} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && !error && (
            <>
              {filteredTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-10 text-center text-sm text-gray-500">
                  {search
                    ? "No letter templates match your search."
                    : "No active letter templates found. Activate one in Letters & Printables first."}
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => openLetterGenerator(template.id)}
                      className="group w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-green-400 hover:bg-green-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 group-hover:text-green-700">{template.name}</p>
                          <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-500">{template.category.replaceAll("_", " ")}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                          {template.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-right text-xs text-gray-400">
                {filteredTemplates.length} template{filteredTemplates.length === 1 ? "" : "s"} available
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
