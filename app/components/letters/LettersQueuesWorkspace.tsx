/** Unified queue workspace for production, print, and mail operations. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import GeneratedLettersList from "@/app/components/letters/GeneratedLettersList";
import LetterMailQueue from "@/app/components/letters/LetterMailQueue";
import LetterPrintQueue from "@/app/components/letters/LetterPrintQueue";
import type { LetterDashboardStats } from "@/app/components/letters/types";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonFrame from "@/app/components/workspace-ribbon/WorkspaceRibbonFrame";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import { apiFetch } from "@/app/lib/auth-client";

type QueueView = "production" | "print" | "mail";

const QUEUE_VIEWS: QueueView[] = ["production", "print", "mail"];

/** Normalizes view query param values into known queue views. */
function normalizeQueueView(value: string | null): QueueView {
  return QUEUE_VIEWS.find((entry) => entry === value) ?? "production";
}

/** Renders one compact queue metric card with optional navigation. */
function QueueMetricCard({
  label,
  value,
  href,
  active,
}: {
  label: string;
  value: number;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border bg-white px-4 py-3 transition-colors ${
        active ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </Link>
  );
}

/** Queue-focused workspace that replaces legacy standalone queue pages. */
export default function LettersQueuesWorkspace() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = normalizeQueueView(searchParams.get("view"));

  const [stats, setStats] = useState<LetterDashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setError(null);
    try {
      const result = await apiFetch<LetterDashboardStats>("/api/letters/dashboard");
      setStats(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load queue summary.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const buildViewHref = useCallback((nextView: QueueView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const productionFilters = useMemo(() => {
    const filters: string[] = [];
    const sourceTaskId = searchParams.get("sourceTaskId");
    const templateId = searchParams.get("templateId");
    const stewardPathEnrollmentId = searchParams.get("stewardPathEnrollmentId");

    if (sourceTaskId) filters.push(`Source Task: ${sourceTaskId}`);
    if (templateId) filters.push(`Template: ${templateId}`);
    if (stewardPathEnrollmentId) filters.push(`Steward Path: ${stewardPathEnrollmentId}`);

    return filters;
  }, [searchParams]);

  const queuedForProduction = (stats?.queuedForPrint ?? 0) + (stats?.queuedForMail ?? 0);

  return (
    <WorkspaceRibbonFrame
      title="Letters Queue Workspace"
      description="Unified production, print, and mail operations for donor letters and printable outputs."
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "OyamaLetters", href: "/oyama-letters" },
        { label: "Queues" },
      ]}
      statusLabel="Partially Working"
      metadata={`${queuedForProduction} in production flow · ${stats?.needsReview ?? 0} need review`}
      primaryAction={<WorkspaceRibbonButton label="Generate PDF" href="/oyama-letters/generate" variant="primary" />}
      ribbon={(
        <WorkspaceRibbon>
          <WorkspaceRibbonGroup label="Queues">
            <WorkspaceRibbonButton label="Production Queue" href={buildViewHref("production")} active={activeView === "production"} />
            <WorkspaceRibbonButton label="Print Queue" href={buildViewHref("print")} active={activeView === "print"} />
            <WorkspaceRibbonButton label="Mail Queue" href={buildViewHref("mail")} active={activeView === "mail"} />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Workspace">
            <WorkspaceRibbonButton label="OyamaLetters" href="/oyama-letters" />
            <WorkspaceRibbonButton label="Templates" href="/oyama-letters/templates" />
            <WorkspaceRibbonButton label="Run Generation" href="/oyama-letters/generate" />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Refresh">
            <WorkspaceRibbonButton label="Refresh Queue Counts" onClick={() => void loadStats()} />
            <WorkspaceRibbonButton label="Settings" href="/letters-printables/settings" />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>
      )}
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <QueueMetricCard
            label="Needs Review"
            value={loadingStats ? 0 : stats?.needsReview ?? 0}
            href={buildViewHref("production")}
            active={activeView === "production"}
          />
          <QueueMetricCard
            label="Print Queue"
            value={loadingStats ? 0 : stats?.queuedForPrint ?? 0}
            href={buildViewHref("print")}
            active={activeView === "print"}
          />
          <QueueMetricCard
            label="Mail Queue"
            value={loadingStats ? 0 : stats?.queuedForMail ?? 0}
            href={buildViewHref("mail")}
            active={activeView === "mail"}
          />
          <QueueMetricCard
            label="Address Issues"
            value={loadingStats ? 0 : stats?.addressIssues ?? 0}
            href={buildViewHref("mail")}
            active={activeView === "mail"}
          />
        </section>

        {activeView === "production" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Production Queue</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Review generated outputs, export PDFs, and push records into print and mail operations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={buildViewHref("print")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    Open Print Queue
                  </Link>
                  <Link href={buildViewHref("mail")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    Open Mail Queue
                  </Link>
                </div>
              </div>

              {productionFilters.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {productionFilters.map((filter) => (
                    <span key={filter} className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      {filter}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <GeneratedLettersList embedded />
          </section>
        )}

        {activeView === "print" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-base font-semibold text-gray-900">Print Queue</h2>
              <p className="mt-1 text-sm text-gray-600">
                Apply review and print-stage bulk transitions, then move records into mail-ready status.
              </p>
            </div>
            <LetterPrintQueue embedded />
          </section>
        )}

        {activeView === "mail" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-base font-semibold text-gray-900">Mail Queue</h2>
              <p className="mt-1 text-sm text-gray-600">
                Manage outbound mail transitions, log returned mail, and track address issues for follow-up.
              </p>
            </div>
            <LetterMailQueue embedded />
          </section>
        )}
      </div>
    </WorkspaceRibbonFrame>
  );
}
