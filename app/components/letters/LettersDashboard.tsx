/** Dashboard screen for the Donor CRM Letters & Printables workspace. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import type { LetterDashboardStats } from "@/app/components/letters/types";

/** Loads and renders top-level letters metrics and quick actions. */
export default function LettersDashboard() {
  const [stats, setStats] = useState<LetterDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<LetterDashboardStats>("/api/letters/dashboard");
      setStats(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load letters dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Letters & Printables</h1>
          <p className="mt-0.5 text-sm text-gray-500">Create polished donor letters, print packets, and email-ready drafts from one workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/letters-printables/templates/new"
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            New Template
          </Link>
          <Link
            href="/letters-printables/generate"
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
          >
            Generate Letter
          </Link>
        </div>
      </div>

      <LettersWorkspaceNav />

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Active Templates", value: stats?.activeTemplates },
          { label: "Generated This Month", value: stats?.generatedThisMonth },
          { label: "Thank-You Pending", value: stats?.thankYouPending },
          { label: "Tax Receipts", value: stats?.taxReceiptsGenerated },
          { label: "Email Drafts", value: stats?.emailDrafts },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? "-" : card.value ?? 0}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Recently Updated Templates</h2>
          <button onClick={() => void load()} className="text-xs text-gray-500 hover:text-gray-700">Refresh</button>
        </div>

        <div className="mt-3 space-y-2">
          {(stats?.recentlyUsedTemplates ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No template activity yet.</p>
          ) : (
            (stats?.recentlyUsedTemplates ?? []).map((template) => (
              <Link
                key={template.id}
                href={`/letters-printables/templates/${template.id}`}
                className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{template.name}</p>
                  <span className="text-xs text-gray-500">{template.category.replaceAll("_", " ")}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Status: {template.status}</p>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Implementation Status</p>
        <p className="mt-1 text-sm text-blue-900">
          Batch generation and server-side PDF export are partially implemented. Use single-letter generation and browser print/PDF as the current production path.
        </p>
      </section>
    </div>
  );
}
